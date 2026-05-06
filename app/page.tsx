"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import {
  RefreshCw,
  ZoomIn,
  ZoomOut,
  LogOut,
  User,
  Settings2,
  Activity,
  Cpu,
  Gauge,
  Radio,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Circle,
  BarChart2,
  Layers,
  ExternalLink,
  X,
  FileText,
  WifiOff,
} from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { TimeRangePicker } from "@/components/time-range-picker"

// ─── Data source
const BASE_URL = "https://a65b-116-96-46-5.ngrok-free.app/d-solo/ad498n8/testing"
const INTERNAL_ADMIN_URL = "https://a65b-116-96-46-5.ngrok-free.app"

const TEST_USERS = [
  { username: "admin", password: "admin123", role: "admin" },
  { username: "user", password: "user123", role: "operator" },
]

// ─── Channel definitions (not "A/B/C/D" — real names)
const CHANNEL_DEFS = [
  { id: "panel-5", title: "Power Consumption", subtitle: "Voltage · Current · Power · PF" },
  { id: "panel-4", title: "Air Quality",        subtitle: "PM2.5 · PM10 · CO2 · VOC" },
  { id: "panel-3", title: "XYZ Vibration",      subtitle: "Tri-axis RMS envelope" },
  { id: "panel-1", title: "Environment",         subtitle: "Temperature · Humidity · Vibration" },
]

// ─── What each channel failure looks like
const CHANNEL_FAULT_DESC: Record<string, { short: string; detail: string }> = {
  "panel-5": {
    short: "Power feed anomaly",
    detail: "Voltage drop detected on Line 1. Current reading 34 A below nominal. PF degraded to 0.71. Possible contactor fault or loose terminal.",
  },
  "panel-4": {
    short: "Air quality sensor offline",
    detail: "PM2.5 probe returned no data for 12 s. CO2 reading frozen at last known value. Possible I2C bus fault or sensor power loss.",
  },
  "panel-3": {
    short: "Vibration threshold exceeded",
    detail: "Z-axis RMS envelope at 0.0412 g — 68 % above safe limit. X-axis drift also elevated. Bearing wear or mounting looseness suspected.",
  },
  "panel-1": {
    short: "Environment module fault",
    detail: "Temperature sensor disconnected (reads -127 °C). Humidity data unavailable. Module may require re-seating or firmware reset.",
  },
}

// ─── System load model factors
// Base load from channels being active + small production trend
function computeSystemLoad(activeCount: number, productionLoad: number): number {
  // Each active channel contributes ~15–18 % base
  const channelLoad = activeCount * 16
  // Production throughput adds on top
  const combined = channelLoad + productionLoad
  return Math.min(Math.max(Math.round(combined), 0), 100)
}

interface SignalRecord { timestamp: number; activeSignals: number }
interface Alert {
  id: string
  channelId: string
  title: string
  detail: string
  ts: number
  acknowledged: boolean
  reported: boolean
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

// ─── Per-panel iframe with custom loading overlay
function TelemetryFrame({ src, title }: { src: string; title: string }) {
  const [loaded, setLoaded] = useState(false)
  return (
    <div className="relative h-full w-full">
      {!loaded && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-[var(--background)]">
          <div className="relative flex h-10 w-10 items-center justify-center">
            <span className="absolute inline-block h-10 w-10 rounded-full border-2 border-[var(--factory-cyan)]/20" />
            <span className="absolute inline-block h-10 w-10 animate-spin rounded-full border-2 border-transparent border-t-[var(--factory-cyan)]" />
            <span className="h-2 w-2 rounded-full bg-[var(--factory-cyan)] animate-pulse" />
          </div>
          <span className="font-mono text-[10px] tracking-widest uppercase text-muted-foreground">
            Acquiring signal...
          </span>
        </div>
      )}
      <iframe
        src={src}
        title={title}
        allow="fullscreen"
        className="absolute inset-0 h-full w-full border-0"
        onLoad={() => setLoaded(true)}
      />
    </div>
  )
}

// ─── Status dot
function StatusDot({ status }: { status: string }) {
  const map: Record<string, string> = {
    nominal: "bg-[var(--factory-green)]",
    warning: "bg-[var(--factory-amber)] animate-pulse",
    error:   "bg-[var(--factory-orange)] animate-pulse",
    offline: "bg-border",
  }
  return <span className={`inline-block h-2 w-2 rounded-full ${map[status] ?? "bg-border"} shadow-sm`} aria-label={status} />
}

// ─── Clock
function LiveClock() {
  const [time, setTime] = useState("")
  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString("en-GB"))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])
  return <span className="font-mono text-xs text-muted-foreground tabular-nums">{time}</span>
}

// ─── Sparkline
function SignalSparkline({ history }: { history: SignalRecord[] }) {
  if (history.length < 2) return null
  const max = Math.max(...history.map((r) => r.activeSignals), 1)
  return (
    <div className="flex items-end gap-px h-6">
      {history.slice(-20).map((r, i) => (
        <div
          key={i}
          className="w-1 rounded-sm bg-[var(--factory-cyan)] opacity-70"
          style={{ height: `${Math.round((r.activeSignals / max) * 100)}%` }}
        />
      ))}
    </div>
  )
}

// ─── System load sparkline (amber)
function LoadSparkline({ history }: { history: number[] }) {
  if (history.length < 2) return null
  const max = 100
  return (
    <div className="flex items-end gap-px h-6">
      {history.slice(-20).map((v, i) => (
        <div
          key={i}
          className={`w-1 rounded-sm ${v > 75 ? "bg-[var(--factory-orange)]" : v > 50 ? "bg-[var(--factory-amber)]" : "bg-[var(--factory-green)]"} opacity-80`}
          style={{ height: `${Math.round((v / max) * 100)}%` }}
        />
      ))}
    </div>
  )
}

// ─── Alerts hover panel
function AlertBadge({ alerts, onReport }: { alerts: Alert[]; onReport: (id: string) => void }) {
  const [open, setOpen] = useState(false)
  const active = alerts.filter((a) => !a.acknowledged)
  const count = active.length

  return (
    <div className="relative" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <div
        className={`flex items-center gap-1.5 cursor-default select-none ${count > 0 ? "text-[var(--factory-orange)]" : "text-[var(--factory-green)]"}`}
      >
        <AlertTriangle className="h-3.5 w-3.5" />
        <div className="flex flex-col leading-none">
          <span className="text-[9px] tracking-widest uppercase text-muted-foreground">Alerts</span>
          <span className="text-xs font-bold tabular-nums">{count}</span>
        </div>
        {count > 0 && (
          <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-[var(--factory-orange)] animate-ping opacity-75" />
        )}
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 w-80 rounded-sm border border-border bg-card shadow-2xl">
          {/* Arrow */}
          <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 h-3 w-3 rotate-45 border-l border-t border-border bg-card" />

          <div className="p-3 border-b border-border">
            <span className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground">
              Active Incidents
            </span>
          </div>

          {active.length === 0 ? (
            <div className="flex items-center gap-2 p-4">
              <CheckCircle2 className="h-4 w-4 text-[var(--factory-green)]" />
              <span className="text-xs text-muted-foreground">All systems nominal</span>
            </div>
          ) : (
            <ul className="flex flex-col divide-y divide-border max-h-64 overflow-y-auto">
              {active.map((alert) => (
                <li key={alert.id} className="p-3 flex flex-col gap-2">
                  <div className="flex items-start gap-2">
                    <WifiOff className="h-3.5 w-3.5 shrink-0 mt-0.5 text-[var(--factory-orange)]" />
                    <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                      <span className="text-xs font-semibold text-foreground leading-tight">{alert.title}</span>
                      <span className="text-[10px] text-muted-foreground leading-relaxed">{alert.detail}</span>
                      <span className="text-[9px] text-muted-foreground font-mono mt-0.5">
                        {new Date(alert.ts).toLocaleTimeString("en-GB")}
                      </span>
                    </div>
                  </div>
                  {!alert.reported && (
                    <Button
                      size="sm"
                      className="h-6 w-full rounded-sm bg-[var(--factory-orange)]/10 border border-[var(--factory-orange)]/30 text-[var(--factory-orange)] text-[10px] tracking-widest uppercase hover:bg-[var(--factory-orange)]/20"
                      onClick={() => onReport(alert.id)}
                    >
                      <FileText className="h-3 w-3 mr-1" />
                      Report Incident
                    </Button>
                  )}
                  {alert.reported && (
                    <span className="text-[9px] tracking-widest uppercase text-muted-foreground text-center">
                      Incident logged — monitoring recovery
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Active channels badge with hover
function ChannelBadge({
  activeChannels,
  total,
  alerts,
}: {
  activeChannels: Set<string>
  total: number
  alerts: Alert[]
}) {
  const [open, setOpen] = useState(false)
  const count = activeChannels.size

  return (
    <div className="relative" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <div className="flex items-center gap-1.5 cursor-default select-none text-[var(--factory-cyan)]">
        <Radio className="h-3.5 w-3.5" />
        <div className="flex flex-col leading-none">
          <span className="text-[9px] tracking-widest uppercase text-muted-foreground">Active Channels</span>
          <span className={`text-xs font-bold tabular-nums ${count < total ? "text-[var(--factory-amber)]" : "text-[var(--factory-cyan)]"}`}>
            {count} / {total}
          </span>
        </div>
      </div>

      {open && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 w-64 rounded-sm border border-border bg-card shadow-2xl">
          <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 h-3 w-3 rotate-45 border-l border-t border-border bg-card" />
          <div className="p-3 border-b border-border">
            <span className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground">Channel Status</span>
          </div>
          <ul className="flex flex-col divide-y divide-border">
            {CHANNEL_DEFS.map((ch) => {
              const isUp = activeChannels.has(ch.id)
              const fault = alerts.find((a) => a.channelId === ch.id && !a.acknowledged)
              return (
                <li key={ch.id} className="flex items-center gap-2.5 px-3 py-2">
                  <span className={`h-2 w-2 rounded-full shrink-0 ${isUp ? "bg-[var(--factory-green)]" : "bg-[var(--factory-orange)] animate-pulse"}`} />
                  <div className="flex flex-col leading-none flex-1 min-w-0">
                    <span className="text-xs text-foreground">{ch.title}</span>
                    {!isUp && fault && (
                      <span className="text-[10px] text-[var(--factory-orange)] mt-0.5 truncate">{fault.title}</span>
                    )}
                    {isUp && (
                      <span className="text-[9px] text-muted-foreground mt-0.5">Nominal</span>
                    )}
                  </div>
                  <span className={`text-[9px] font-mono uppercase tracking-wide ${isUp ? "text-[var(--factory-green)]" : "text-[var(--factory-orange)]"}`}>
                    {isUp ? "UP" : "DOWN"}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}

export default function KilnOS() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [currentUser, setCurrentUser] = useState("")
  const [userRole, setUserRole] = useState("")
  const [error, setError] = useState("")
  const [sessionChecked, setSessionChecked] = useState(false)

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem("kiln_session")
      if (saved) {
        const { user, role } = JSON.parse(saved)
        setCurrentUser(user)
        setUserRole(role)
        setIsLoggedIn(true)
      }
    } catch (_) {}
    setSessionChecked(true)
  }, [])

  const [refreshKey, setRefreshKey] = useState(0)
  const [timeRange, setTimeRange] = useState({
    from: Date.now() - 60 * 60 * 1000,
    to: Date.now(),
  })
  const animationRef = useRef<number | null>(null)
  const signalIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const eventTimerRef = useRef<NodeJS.Timeout | null>(null)

  // ─── Throughput sparkline
  const [signalHistory, setSignalHistory] = useState<SignalRecord[]>([])
  const [maxConcurrentSignals, setMaxConcurrentSignals] = useState(0)

  // ─── Active channels (all up by default)
  const [activeChannels, setActiveChannels] = useState<Set<string>>(
    new Set(CHANNEL_DEFS.map((c) => c.id))
  )

  // ─── System load
  const [productionLoad, setProductionLoad] = useState(18) // base production contribution
  const [loadHistory, setLoadHistory] = useState<number[]>([])

  // ─── Alerts
  const [alerts, setAlerts] = useState<Alert[]>([])

  // Derived: current system load
  const systemLoad = computeSystemLoad(activeChannels.size, productionLoad)

  // ─── Production load drifts slightly over time (realistic)
  useEffect(() => {
    const id = setInterval(() => {
      setProductionLoad((prev) => {
        const delta = (Math.random() - 0.5) * 3
        return Math.min(Math.max(prev + delta, 8), 32)
      })
    }, 4000)
    return () => clearInterval(id)
  }, [])

  // ─── Record load history
  useEffect(() => {
    const id = setInterval(() => {
      setLoadHistory((prev) => {
        const next = [...prev, systemLoad]
        if (next.length > 30) next.shift()
        return next
      })
    }, 2000)
    return () => clearInterval(id)
  }, [systemLoad])

  // ─── Random channel failure simulator
  const triggerChannelEvent = useCallback(() => {
    // Pick a random channel to drop
    const allIds = CHANNEL_DEFS.map((c) => c.id)
    const victim = allIds[Math.floor(Math.random() * allIds.length)]
    const faultInfo = CHANNEL_FAULT_DESC[victim]
    const alertId = `alert-${Date.now()}`

    // Drop channel + raise alert
    setActiveChannels((prev) => {
      const next = new Set(prev)
      next.delete(victim)
      return next
    })

    const newAlert: Alert = {
      id: alertId,
      channelId: victim,
      title: faultInfo.short,
      detail: faultInfo.detail,
      ts: Date.now(),
      acknowledged: false,
      reported: false,
    }
    setAlerts((prev) => [newAlert, ...prev].slice(0, 10))

    // Auto-recover after 5–7 s
    const recoveryDelay = 5000 + Math.random() * 2000
    eventTimerRef.current = setTimeout(() => {
      setActiveChannels((prev) => {
        const next = new Set(prev)
        next.add(victim)
        return next
      })
      // Acknowledge the alert (mark resolved)
      setAlerts((prev) =>
        prev.map((a) => (a.id === alertId ? { ...a, acknowledged: true } : a))
      )
    }, recoveryDelay)
  }, [])

  // ─── Schedule random events every 20–40 s
  const scheduleNextEvent = useCallback(() => {
    const delay = 20000 + Math.random() * 20000
    eventTimerRef.current = setTimeout(() => {
      triggerChannelEvent()
      scheduleNextEvent()
    }, delay)
  }, [triggerChannelEvent])

  const handleReport = useCallback((id: string) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, reported: true } : a))
    )
  }, [])

  const startSignalTracking = useCallback(() => {
    signalIntervalRef.current = setInterval(() => {
      const base = activeChannels.size * 22
      const jitter = Math.floor((Math.random() - 0.5) * 15)
      const val = Math.max(base + jitter, 0)
      const newRecord: SignalRecord = { timestamp: Date.now(), activeSignals: val }
      setSignalHistory((prev) => {
        const updated = [...prev, newRecord]
        if (updated.length > 30) updated.shift()
        setMaxConcurrentSignals(Math.max(...updated.map((r) => r.activeSignals)))
        return updated
      })
    }, 2000)
  }, [activeChannels.size])

  // Restart signal tracker when channel count changes
  useEffect(() => {
    if (!isLoggedIn) return
    if (signalIntervalRef.current) clearInterval(signalIntervalRef.current)
    startSignalTracking()
  }, [isLoggedIn, activeChannels.size, startSignalTracking])

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (!username.trim() || !password.trim()) {
      setError("Username and password are required.")
      return
    }
    const user = TEST_USERS.find(
      (u) => u.username === username && u.password === password
    )
    if (!user) {
      setError("Invalid credentials.")
      return
    }
    setCurrentUser(user.username)
    setUserRole(user.role)
    setIsLoggedIn(true)
    setUsername("")
    setPassword("")
    sessionStorage.setItem("kiln_session", JSON.stringify({ user: user.username, role: user.role }))
    scheduleNextEvent()
  }

  const handleLogout = () => {
    setIsLoggedIn(false)
    setCurrentUser("")
    setUserRole("")
    sessionStorage.removeItem("kiln_session")
    if (signalIntervalRef.current) clearInterval(signalIntervalRef.current)
    if (eventTimerRef.current) clearTimeout(eventTimerRef.current)
    setSignalHistory([])
    setAlerts([])
    setActiveChannels(new Set(CHANNEL_DEFS.map((c) => c.id)))
  }

  const animateToRange = useCallback(
    (targetFrom: number, targetTo: number) => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
      const startFrom = timeRange.from
      const startTo = timeRange.to
      const startTime = performance.now()
      const duration = 400
      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime
        const progress = Math.min(elapsed / duration, 1)
        const eased = easeInOutCubic(progress)
        setTimeRange({
          from: startFrom + (targetFrom - startFrom) * eased,
          to: startTo + (targetTo - startTo) * eased,
        })
        if (progress < 1) {
          animationRef.current = requestAnimationFrame(animate)
        } else {
          setRefreshKey((p) => p + 1)
        }
      }
      animationRef.current = requestAnimationFrame(animate)
    },
    [timeRange]
  )

  useEffect(() => {
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
      if (signalIntervalRef.current) clearInterval(signalIntervalRef.current)
      if (eventTimerRef.current) clearTimeout(eventTimerRef.current)
    }
  }, [])

  const buildPanelUrl = useCallback(
    (panelId: string) =>
      `${BASE_URL}?orgId=1&from=${Math.floor(timeRange.from)}&to=${Math.floor(
        timeRange.to
      )}&timezone=browser&refresh=5s&panelId=${panelId}&__feature.dashboardSceneSolo=true&ngrok-skip-browser-warning=true`,
    [timeRange]
  )

  const handleRefresh = useCallback(() => {
    const range = timeRange.to - timeRange.from
    const now = Date.now()
    setTimeRange({ from: now - range, to: now })
    setRefreshKey((p) => p + 1)
  }, [timeRange])

  const handleZoomIn = useCallback(() => {
    const center = (timeRange.from + timeRange.to) / 2
    const halfRange = (timeRange.to - timeRange.from) / 4
    animateToRange(center - halfRange, center + halfRange)
  }, [timeRange, animateToRange])

  const handleZoomOut = useCallback(() => {
    const center = (timeRange.from + timeRange.to) / 2
    const halfRange = timeRange.to - timeRange.from
    animateToRange(center - halfRange, center + halfRange)
  }, [timeRange, animateToRange])

  const handleTimeRangeChange = useCallback(
    (newRange: { from: number; to: number }) => animateToRange(newRange.from, newRange.to),
    [animateToRange]
  )

  const currentActiveSignals =
    signalHistory.length > 0 ? signalHistory[signalHistory.length - 1].activeSignals : 0

  const activeAlerts = alerts.filter((a) => !a.acknowledged)
  const loadColor =
    systemLoad > 75 ? "text-[var(--factory-orange)]"
    : systemLoad > 50 ? "text-[var(--factory-amber)]"
    : "text-[var(--factory-green)]"

  // ─── Session gate
  if (!sessionChecked) return null

  // ─── Login screen
  if (!isLoggedIn) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div
          className="pointer-events-none fixed inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(var(--factory-cyan) 1px, transparent 1px), linear-gradient(90deg, var(--factory-cyan) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
        <div className="relative w-full max-w-sm">
          <span className="absolute -top-3 -left-3 h-5 w-5 border-t-2 border-l-2 border-[var(--factory-cyan)]" />
          <span className="absolute -top-3 -right-3 h-5 w-5 border-t-2 border-r-2 border-[var(--factory-cyan)]" />
          <span className="absolute -bottom-3 -left-3 h-5 w-5 border-b-2 border-l-2 border-[var(--factory-cyan)]" />
          <span className="absolute -bottom-3 -right-3 h-5 w-5 border-b-2 border-r-2 border-[var(--factory-cyan)]" />

          <div className="rounded-sm border border-border bg-card p-8 shadow-2xl">
            <div className="mb-8 flex flex-col items-center gap-4">
              <div className="flex items-center justify-center h-14 w-14 rounded-sm border border-[var(--factory-cyan)]/30 bg-[var(--factory-panel)]">
                <Layers className="h-7 w-7 text-[var(--factory-cyan)]" />
              </div>
              <div className="text-center">
                <h1 className="text-xl font-bold tracking-widest uppercase text-foreground">Kiln OS</h1>
                <p className="mt-1 text-xs tracking-widest uppercase text-muted-foreground">Industrial Operations Platform</p>
              </div>
            </div>

            <div className="mb-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-[10px] tracking-widest uppercase text-muted-foreground">Secure Access</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <form onSubmit={handleLogin} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="username" className="text-xs tracking-widest uppercase text-muted-foreground">Operator ID</Label>
                <Input
                  id="username" type="text" placeholder="Enter operator ID"
                  value={username} onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  className="border-border bg-[var(--factory-panel)] font-mono text-sm"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="password" className="text-xs tracking-widest uppercase text-muted-foreground">Access Code</Label>
                <Input
                  id="password" type="password" placeholder="Enter access code"
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="border-border bg-[var(--factory-panel)] font-mono text-sm"
                />
              </div>
              {error && (
                <div className="flex items-center gap-2 rounded-sm border border-[var(--factory-orange)]/30 bg-[var(--factory-orange)]/5 px-3 py-2">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-[var(--factory-orange)]" />
                  <p className="text-xs text-[var(--factory-orange)]">{error}</p>
                </div>
              )}
              <Button
                type="submit"
                className="mt-2 w-full rounded-sm bg-[var(--factory-cyan)] font-semibold uppercase tracking-widest text-[var(--background)] hover:bg-[var(--factory-cyan)]/90"
              >
                Authenticate
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </form>

            <div className="mt-5 rounded-sm border border-border bg-[var(--factory-panel)] p-3">
              <p className="mb-1.5 text-[10px] tracking-widest uppercase text-muted-foreground">Dev credentials</p>
              <div className="flex flex-col gap-1 font-mono text-xs">
                <span className="text-muted-foreground">admin / <span className="text-[var(--factory-cyan)]">admin123</span></span>
                <span className="text-muted-foreground">user / <span className="text-[var(--factory-cyan)]">user123</span></span>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ─── Main OS shell
  return (
    <div className="flex min-h-screen w-full flex-col bg-background font-sans">
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.025]"
        style={{
          backgroundImage:
            "linear-gradient(var(--factory-cyan) 1px, transparent 1px), linear-gradient(90deg, var(--factory-cyan) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      {/* ── Top bar ─────────────────────────────────────────────────── */}
      <header className="relative z-10 flex h-14 shrink-0 items-center border-b border-border bg-card px-4 gap-3">
        {/* Brand */}
        <div className="flex items-center gap-2.5 min-w-0 mr-4">
          <div className="flex h-7 w-7 items-center justify-center rounded-sm border border-[var(--factory-cyan)]/40 bg-[var(--factory-panel)]">
            <Layers className="h-4 w-4 text-[var(--factory-cyan)]" />
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-[11px] font-bold tracking-[0.2em] uppercase text-foreground">Kiln OS</span>
            <span className="text-[9px] tracking-widest uppercase text-muted-foreground">Operations Platform</span>
          </div>
        </div>

        <div className="h-6 w-px bg-border" />

        {/* Live stats row */}
        <div className="hidden md:flex items-center gap-5 flex-1 px-2">

          {/* Active channels — interactive */}
          <ChannelBadge
            activeChannels={activeChannels}
            total={CHANNEL_DEFS.length}
            alerts={alerts}
          />

          {/* Sampling rate — static */}
          <div className="flex items-center gap-1.5 text-[var(--factory-green)]">
            <Activity className="h-3.5 w-3.5" />
            <div className="flex flex-col leading-none">
              <span className="text-[9px] tracking-widest uppercase text-muted-foreground">Sampling Rate</span>
              <span className="text-xs font-bold tabular-nums">5 s</span>
            </div>
          </div>

          {/* System load — driven by channel count + production */}
          <div className={`flex items-center gap-1.5 ${loadColor}`}>
            <Cpu className="h-3.5 w-3.5" />
            <div className="flex flex-col leading-none">
              <span className="text-[9px] tracking-widest uppercase text-muted-foreground">System Load</span>
              <span className="text-xs font-bold tabular-nums">{systemLoad} %</span>
            </div>
            <LoadSparkline history={loadHistory} />
          </div>

          {/* Alerts — hover to see detail */}
          <AlertBadge alerts={alerts} onReport={handleReport} />

          {/* Throughput sparkline */}
          <div className="flex items-center gap-2 ml-2">
            <SignalSparkline history={signalHistory} />
            {signalHistory.length > 0 && (
              <div className="flex flex-col leading-none">
                <span className="text-[9px] uppercase tracking-widest text-muted-foreground">Throughput</span>
                <span className="text-xs font-bold text-[var(--factory-cyan)] tabular-nums">{currentActiveSignals} sig/s</span>
              </div>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1.5 ml-auto">
          <TimeRangePicker timeRange={timeRange} onTimeRangeChange={handleTimeRangeChange} />
          <Button variant="outline" size="icon" className="h-7 w-7 rounded-sm border-border" onClick={handleZoomIn} title="Zoom In">
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
          <Button variant="outline" size="icon" className="h-7 w-7 rounded-sm border-border" onClick={handleZoomOut} title="Zoom Out">
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
          <Button variant="outline" size="sm" onClick={handleRefresh} className="h-7 gap-1.5 rounded-sm border-border text-xs">
            <RefreshCw className="h-3 w-3" />
            Sync
          </Button>

          <Link href="/motioniq">
            <Button variant="outline" size="sm" className="h-7 gap-1.5 rounded-sm border-border text-xs hidden lg:flex">
              <Settings2 className="h-3 w-3" />
              MotionIQ
            </Button>
          </Link>

          {userRole === "admin" && (
            <Button
              size="sm"
              className="h-7 gap-1.5 rounded-sm bg-[var(--factory-cyan)] text-[var(--background)] text-xs font-semibold hover:bg-[var(--factory-cyan)]/90 hidden lg:flex"
              onClick={() => window.open(INTERNAL_ADMIN_URL, "_blank")}
            >
              <BarChart2 className="h-3 w-3" />
              Telemetry Engine
              <ExternalLink className="h-2.5 w-2.5 opacity-60" />
            </Button>
          )}

          <div className="h-5 w-px bg-border mx-1" />

          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <User className="h-3.5 w-3.5" />
              <span className="font-mono">{currentUser}</span>
              <span className="ml-0.5 rounded-sm border border-border px-1 py-0.5 text-[9px] uppercase tracking-wider">{userRole}</span>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-sm text-muted-foreground hover:text-foreground" onClick={handleLogout} title="Sign out">
              <LogOut className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </header>

      {/* ── Status bar ──────────────────────────────────────────────── */}
      <div className="relative z-10 flex h-7 items-center justify-between border-b border-border bg-[var(--factory-panel)] px-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            {activeAlerts.length === 0 ? (
              <CheckCircle2 className="h-3 w-3 text-[var(--factory-green)]" />
            ) : (
              <AlertTriangle className="h-3 w-3 text-[var(--factory-orange)] animate-pulse" />
            )}
            <span className="text-[10px] tracking-widest uppercase text-muted-foreground">
              {activeAlerts.length === 0 ? "System Operational" : `${activeAlerts.length} Active Incident${activeAlerts.length > 1 ? "s" : ""}`}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Circle className="h-2 w-2 fill-[var(--factory-cyan)] text-[var(--factory-cyan)] animate-pulse" />
            <span className="text-[10px] tracking-widest uppercase text-muted-foreground">Live Feed — 5s refresh</span>
          </div>
          <div className="hidden sm:flex items-center gap-1.5">
            <Gauge className="h-3 w-3 text-[var(--factory-amber)]" />
            <span className="text-[10px] tracking-widest uppercase text-muted-foreground">Peak: {maxConcurrentSignals} sig/s</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] tracking-widest uppercase text-muted-foreground hidden sm:block">
            Process Monitoring — {activeChannels.size} / {CHANNEL_DEFS.length} Channels Active
          </span>
          <LiveClock />
        </div>
      </div>

      {/* ── Channel grid ─────────────────────────────────────────────── */}
      <main className="relative z-10 flex-1 p-4 overflow-auto">
        <div className="grid gap-3 grid-cols-1 md:grid-cols-2 h-full">
          {CHANNEL_DEFS.map((panel) => {
            const isUp = activeChannels.has(panel.id)
            const fault = alerts.find((a) => a.channelId === panel.id && !a.acknowledged)
            const status = isUp ? "nominal" : "error"
            return (
              <div
                key={panel.id}
                className={`group flex flex-col overflow-hidden rounded-sm border transition-colors duration-300 bg-card ${
                  isUp
                    ? "border-border hover:border-[var(--factory-cyan)]/40"
                    : "border-[var(--factory-orange)]/50 hover:border-[var(--factory-orange)]/70"
                }`}
              >
                {/* Panel header */}
                <div className={`flex items-center justify-between border-b px-3 py-2 ${isUp ? "border-border bg-[var(--factory-panel)]" : "border-[var(--factory-orange)]/30 bg-[var(--factory-orange)]/5"}`}>
                  <div className="flex items-center gap-2">
                    <StatusDot status={status} />
                    <div className="flex flex-col leading-none">
                      <span className="text-xs font-semibold tracking-wide text-foreground">{panel.title}</span>
                      <span className="text-[9px] tracking-widest uppercase text-muted-foreground">{panel.subtitle}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!isUp && fault && (
                      <span className="flex items-center gap-1 rounded-sm border border-[var(--factory-orange)]/30 bg-[var(--factory-orange)]/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-widest text-[var(--factory-orange)]">
                        <AlertTriangle className="h-2.5 w-2.5" />
                        {fault.title}
                      </span>
                    )}
                    <span className="font-mono text-[9px] text-muted-foreground">
                      {panel.id.toUpperCase().replace("-", "_")}
                    </span>
                  </div>
                </div>

                {/* Channel down overlay */}
                <div className="relative flex-1 min-h-[240px] bg-[var(--background)]">
                  {!isUp ? (
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-[var(--background)]">
                      <WifiOff className="h-8 w-8 text-[var(--factory-orange)]/60" />
                      <div className="flex flex-col items-center gap-1 text-center px-6">
                        <span className="text-xs font-semibold text-[var(--factory-orange)]">
                          {fault?.title ?? "Channel Offline"}
                        </span>
                        <span className="text-[10px] text-muted-foreground leading-relaxed max-w-[240px]">
                          {fault?.detail ?? "No data. Channel recovery in progress."}
                        </span>
                      </div>
                      <span className="font-mono text-[9px] tracking-widest uppercase text-muted-foreground animate-pulse">
                        Awaiting recovery...
                      </span>
                    </div>
                  ) : (
                    <TelemetryFrame
                      key={`${panel.id}-${refreshKey}`}
                      src={buildPanelUrl(panel.id)}
                      title={panel.title}
                    />
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </main>

      {/* ── Footer bar ──────────────────────────────────────────────── */}
      <footer className="relative z-10 flex h-6 shrink-0 items-center justify-between border-t border-border bg-[var(--factory-panel)] px-4">
        <span className="text-[9px] tracking-widest uppercase text-muted-foreground">
          Kiln OS v2.1.0 — Industrial Operations Platform
        </span>
        <span className="font-mono text-[9px] text-muted-foreground">
          DATA RETENTION: 30 d &nbsp;|&nbsp; ENCRYPTION: AES-256 &nbsp;|&nbsp; UPTIME: 99.97%
        </span>
      </footer>
    </div>
  )
}
