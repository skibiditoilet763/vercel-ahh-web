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
  FileText,
  WifiOff,
  Zap,
  Wind,
  Waves,
  Thermometer,
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

// ─── What each channel failure looks like, with a unique icon per fault type
const CHANNEL_FAULT_DESC: Record<string, {
  short: string
  detail: string
  icon: React.ElementType
}> = {
  "panel-5": {
    short: "Power feed anomaly",
    detail: "Voltage drop detected on Line 1. Current reading 34 A below nominal. PF degraded to 0.71. Possible contactor fault or loose terminal.",
    icon: Zap,
  },
  "panel-4": {
    short: "Air quality sensor offline",
    detail: "PM2.5 probe returned no data for 12 s. CO2 reading frozen at last known value. Possible I2C bus fault or sensor power loss.",
    icon: Wind,
  },
  "panel-3": {
    short: "Vibration threshold exceeded",
    detail: "Z-axis RMS envelope at 0.0412 g — 68% above safe limit. X-axis drift also elevated. Bearing wear or mounting looseness suspected.",
    icon: Waves,
  },
  "panel-1": {
    short: "Environment module fault",
    detail: "Temperature sensor disconnected (reads -127 °C). Humidity data unavailable. Module may require re-seating or firmware reset.",
    icon: Thermometer,
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
  icon: React.ElementType
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

  const [activeTab, setActiveTab] = useState<"dashboard" | "alerts">("dashboard")
  const [refreshKey, setRefreshKey] = useState(0)
  const [alertFilter, setAlertFilter] = useState<"all" | "in-progress" | "resolved">("all")
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

  // ─── Alerts
  const [alerts, setAlerts] = useState<Alert[]>([])

  // ─── Persist alerts to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem("kiln_incidents", JSON.stringify(alerts))
    } catch (_) {}
  }, [alerts])

  // ─── Restore alerts from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("kiln_incidents")
      if (saved) {
        const restored = JSON.parse(saved) as Alert[]
        setAlerts(restored)
      }
    } catch (_) {}
  }, [])

  // Derived: current system load
  const systemLoad = computeSystemLoad(activeChannels.size, productionLoad)

  // ─── Filter alerts by status
  const getFilteredAlerts = () => {
    switch (alertFilter) {
      case "in-progress":
        return alerts.filter((a) => !a.acknowledged && (a.reported || !a.reported))
      case "resolved":
        return alerts.filter((a) => a.acknowledged)
      case "all":
      default:
        return alerts
    }
  }
  const filteredAlerts = getFilteredAlerts()
  const inProgressCount = alerts.filter((a) => !a.acknowledged).length
  const resolvedCount = alerts.filter((a) => a.acknowledged).length

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

  // ─── Recovery timers keyed by alertId so we can cancel per-alert
  const recoveryTimers = useRef<Record<string, NodeJS.Timeout>>({})

  // ─── Random channel failure simulator (no auto-recovery — waits for Report)
  const triggerChannelEvent = useCallback(() => {
    const allIds = CHANNEL_DEFS.map((c) => c.id)
    const victim = allIds[Math.floor(Math.random() * allIds.length)]
    const faultInfo = CHANNEL_FAULT_DESC[victim]
    const alertId = `alert-${Date.now()}`

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
      icon: faultInfo.icon,
      ts: Date.now(),
      acknowledged: false,
      reported: false,
    }
    setAlerts((prev) => [newAlert, ...prev].slice(0, 10))
  }, [])

  // ─── Schedule random events every 20–40 s
  const scheduleNextEvent = useCallback(() => {
    const delay = 40000 + Math.random() * 20000
    eventTimerRef.current = setTimeout(() => {
      triggerChannelEvent()
      scheduleNextEvent()
    }, delay)
  }, [triggerChannelEvent])

  const handleReport = useCallback((id: string) => {
    // Mark as reported immediately (shows "monitoring recovery" text)
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, reported: true } : a))
    )

    // Recover the channel after 7–10 s
    const delay = 7000 + Math.random() * 3000
    recoveryTimers.current[id] = setTimeout(() => {
      setAlerts((prev) => {
        const alert = prev.find((a) => a.id === id)
        if (!alert) return prev
        // Re-add the channel
        setActiveChannels((ch) => {
          const next = new Set(ch)
          next.add(alert.channelId)
          return next
        })
        // Acknowledge the alert
        return prev.map((a) => (a.id === id ? { ...a, acknowledged: true } : a))
      })
      delete recoveryTimers.current[id]
    }, delay)
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

  // ─── Start fault scheduler whenever user is logged in (login OR session restore)
  useEffect(() => {
    if (!isLoggedIn) return
    scheduleNextEvent()
    return () => {
      if (eventTimerRef.current) clearTimeout(eventTimerRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn])

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
  }

  const handleLogout = () => {
    setIsLoggedIn(false)
    setCurrentUser("")
    setUserRole("")
    sessionStorage.removeItem("kiln_session")
    if (signalIntervalRef.current) clearInterval(signalIntervalRef.current)
    if (eventTimerRef.current) clearTimeout(eventTimerRef.current)
    Object.values(recoveryTimers.current).forEach(clearTimeout)
    recoveryTimers.current = {}
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
      Object.values(recoveryTimers.current).forEach(clearTimeout)
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
    <div className="flex h-screen w-full flex-col overflow-hidden bg-background font-sans">
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.025]"
        style={{
          backgroundImage:
            "linear-gradient(var(--factory-cyan) 1px, transparent 1px), linear-gradient(90deg, var(--factory-cyan) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      {/* ── Top bar ─────────────────────────────────────────────────── */}
      <header className="relative z-10 flex h-14 shrink-0 items-center border-b border-border bg-card px-3 gap-3 overflow-hidden">

        {/* Brand — always visible, no shrink */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex h-7 w-7 items-center justify-center rounded-sm border border-[var(--factory-cyan)]/40 bg-[var(--factory-panel)]">
            <Layers className="h-4 w-4 text-[var(--factory-cyan)]" />
          </div>
          <div className="hidden sm:flex flex-col leading-none">
            <span className="text-[11px] font-bold tracking-[0.2em] uppercase text-foreground">Kiln OS</span>
            <span className="text-[9px] tracking-widest uppercase text-muted-foreground">Operations Platform</span>
          </div>
        </div>

        <div className="h-6 w-px bg-border shrink-0" />

        {/* Tab nav — always visible */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`flex items-center gap-1.5 h-7 px-2.5 rounded-sm text-[10px] font-semibold tracking-widest uppercase transition-colors ${
              activeTab === "dashboard"
                ? "bg-[var(--factory-cyan)] text-[var(--background)]"
                : "text-muted-foreground hover:text-foreground hover:bg-[var(--factory-panel)]"
            }`}
          >
            <BarChart2 className="h-3 w-3" />
            <span className="hidden sm:inline">Dashboard</span>
          </button>
          <button
            onClick={() => setActiveTab("alerts")}
            className={`flex items-center gap-1.5 h-7 px-2.5 rounded-sm text-[10px] font-semibold tracking-widest uppercase transition-colors ${
              activeTab === "alerts"
                ? "bg-[var(--factory-orange)] text-white"
                : activeAlerts.length > 0
                ? "text-[var(--factory-orange)] hover:bg-[var(--factory-orange)]/10"
                : "text-muted-foreground hover:text-foreground hover:bg-[var(--factory-panel)]"
            }`}
          >
            <AlertTriangle className="h-3 w-3" />
            <span className="hidden sm:inline">Alerts</span>
            {activeAlerts.length > 0 && (
              <span className={`flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-bold ${
                activeTab === "alerts" ? "bg-white/20 text-white" : "bg-[var(--factory-orange)] text-white"
              }`}>
                {activeAlerts.length}
              </span>
            )}
          </button>
        </div>

        <div className="h-6 w-px bg-border shrink-0 hidden xl:block" />

        {/* Live stats — only on xl+ */}
        <div className="hidden xl:flex items-center gap-4 flex-1 min-w-0 overflow-hidden">
          <div className="flex items-center gap-1.5 shrink-0">
            <Radio className="h-3.5 w-3.5 text-[var(--factory-cyan)]" />
            <div className="flex flex-col leading-none">
              <span className="text-[9px] tracking-widest uppercase text-muted-foreground">Channels</span>
              <span className={`text-xs font-bold tabular-nums ${activeChannels.size < CHANNEL_DEFS.length ? "text-[var(--factory-amber)]" : "text-[var(--factory-cyan)]"}`}>
                {activeChannels.size} / {CHANNEL_DEFS.length}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 text-[var(--factory-green)]">
            <Activity className="h-3.5 w-3.5" />
            <div className="flex flex-col leading-none">
              <span className="text-[9px] tracking-widest uppercase text-muted-foreground">Sample</span>
              <span className="text-xs font-bold tabular-nums">5 s</span>
            </div>
          </div>
          <div className={`flex items-center gap-1.5 shrink-0 ${loadColor}`}>
            <Cpu className="h-3.5 w-3.5" />
            <div className="flex flex-col leading-none">
              <span className="text-[9px] tracking-widest uppercase text-muted-foreground">Load</span>
              <span className="text-xs font-bold tabular-nums">{systemLoad}%</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 text-[var(--factory-cyan)]">
            <Activity className="h-3.5 w-3.5" />
            <div className="flex flex-col leading-none">
              <span className="text-[9px] uppercase tracking-widest text-muted-foreground">Throughput</span>
              <span className="text-xs font-bold tabular-nums">{currentActiveSignals} sig/s</span>
            </div>
          </div>
        </div>

        {/* Controls — ml-auto pushes to right edge */}
        <div className="flex items-center gap-1 ml-auto shrink-0">
          {/* Time range — hidden on small */}
          <div className="hidden md:block">
            <TimeRangePicker timeRange={timeRange} onTimeRangeChange={handleTimeRangeChange} />
          </div>

          {/* Zoom — icon only always */}
          <Button variant="outline" size="icon" className="h-7 w-7 rounded-sm border-border shrink-0" onClick={handleZoomIn} title="Zoom In">
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
          <Button variant="outline" size="icon" className="h-7 w-7 rounded-sm border-border shrink-0" onClick={handleZoomOut} title="Zoom Out">
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>

          {/* Sync — text on md+, icon only on sm */}
          <Button variant="outline" size="sm" onClick={handleRefresh} className="h-7 rounded-sm border-border text-xs shrink-0 w-7 md:w-auto px-0 md:px-3 md:gap-1.5">
            <RefreshCw className="h-3 w-3" />
            <span className="hidden md:inline">Sync</span>
          </Button>

          {/* MotionIQ — hidden on md- */}
          <Link href="/motioniq" className="hidden lg:block shrink-0">
            <Button variant="outline" size="sm" className="h-7 gap-1.5 rounded-sm border-border text-xs">
              <Settings2 className="h-3 w-3" />
              MotionIQ
            </Button>
          </Link>

          {/* Telemetry Engine — always visible for admin, truncation-safe */}
          {userRole === "admin" && (
            <Button
              size="sm"
              className="h-7 gap-1.5 rounded-sm bg-[var(--factory-cyan)] text-[var(--background)] text-xs font-semibold hover:bg-[var(--factory-cyan)]/90 shrink-0"
              onClick={() => window.open(INTERNAL_ADMIN_URL, "_blank")}
            >
              <BarChart2 className="h-3 w-3 shrink-0" />
              <span className="hidden md:inline">Telemetry Engine</span>
              <ExternalLink className="h-2.5 w-2.5 opacity-60 shrink-0" />
            </Button>
          )}

          <div className="h-5 w-px bg-border mx-0.5 shrink-0" />

          {/* User info — name hidden on sm */}
          <div className="flex items-center gap-1">
            <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="hidden md:inline font-mono text-xs text-muted-foreground">{currentUser}</span>
            <span className="hidden lg:inline ml-0.5 rounded-sm border border-border px-1 py-0.5 text-[9px] uppercase tracking-wider text-muted-foreground">{userRole}</span>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-sm text-muted-foreground hover:text-foreground shrink-0" onClick={handleLogout} title="Sign out">
            <LogOut className="h-3.5 w-3.5" />
          </Button>
        </div>
      </header>

      {/* ── Status bar ───────────────────────���──────────────────────── */}
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

      {/* ── Main content ─────────────────────────────────────────────── */}
      <main className="relative z-10 flex-1 overflow-hidden">

        {/* Dashboard tab */}
        {activeTab === "dashboard" && (
          <div className="grid gap-3 grid-cols-1 md:grid-cols-2 h-full p-4 overflow-hidden">
            {CHANNEL_DEFS.map((panel) => {
              const isUp = activeChannels.has(panel.id)
              const fault = alerts.find((a) => a.channelId === panel.id && !a.acknowledged)
              const status = isUp ? "nominal" : "warning"
              return (
                <div
                  key={panel.id}
                  className={`group flex flex-col overflow-hidden rounded-sm border transition-colors duration-300 bg-card ${
                    isUp
                      ? "border-border hover:border-[var(--factory-cyan)]/40"
                      : "border-[var(--factory-amber)]/60"
                  }`}
                >
                  {/* Panel header */}
                  <div className={`flex items-center justify-between border-b px-3 py-2 ${
                    isUp ? "border-border bg-[var(--factory-panel)]" : "border-[var(--factory-amber)]/30 bg-[var(--factory-amber)]/5"
                  }`}>
                    <div className="flex items-center gap-2">
                      <StatusDot status={status} />
                      <div className="flex flex-col leading-none">
                        <span className="text-xs font-semibold tracking-wide text-foreground">{panel.title}</span>
                        <span className="text-[9px] tracking-widest uppercase text-muted-foreground">{panel.subtitle}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {!isUp && fault && (
                        <button
                          onClick={() => setActiveTab("alerts")}
                          className="flex items-center gap-1 rounded-sm border border-[var(--factory-amber)]/40 bg-[var(--factory-amber)]/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-widest text-[var(--factory-amber)] hover:bg-[var(--factory-amber)]/20 transition-colors"
                        >
                          <AlertTriangle className="h-2.5 w-2.5" />
                          {fault.title}
                        </button>
                      )}
                      <span className="font-mono text-[9px] text-muted-foreground">
                        {panel.id.toUpperCase().replace("-", "_")}
                      </span>
                    </div>
                  </div>

                  {/* Panel body */}
                  <div className="relative flex-1 min-h-[240px] bg-[var(--background)]">
                    {!isUp ? (
                      (() => {
                        const FaultIcon = fault?.icon ?? WifiOff
                        return (
                      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-[var(--background)]">
                        <FaultIcon className="h-9 w-9 text-[var(--factory-amber)]/70" />
                        <div className="flex flex-col items-center gap-1.5 text-center px-6">
                          <span className="text-sm font-semibold text-[var(--factory-amber)]">
                            {fault?.title ?? "Channel Offline"}
                          </span>
                          <span className="text-xs text-muted-foreground leading-relaxed max-w-[260px]">
                            {fault?.detail ?? "No data. Awaiting incident report."}
                          </span>
                        </div>
                        <button
                          onClick={() => setActiveTab("alerts")}
                          className="flex items-center gap-1.5 mt-1 rounded-sm border border-[var(--factory-amber)]/30 bg-[var(--factory-amber)]/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-[var(--factory-amber)] hover:bg-[var(--factory-amber)]/20 transition-colors"
                        >
                          <FileText className="h-3 w-3" />
                          View in Alerts
                        </button>
                      </div>
                        )
                      })()
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
        )}

        {/* Alerts tab */}
        {activeTab === "alerts" && (
          <div className="h-full overflow-y-auto">
          <div className="p-6 max-w-4xl mx-auto">
            <div className="mb-6 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex flex-col gap-0.5">
                  <h2 className="text-sm font-bold tracking-widest uppercase text-foreground">Incident Log</h2>
                  <p className="text-[10px] tracking-widest uppercase text-muted-foreground">
                    {inProgressCount} in progress &mdash; {resolvedCount} resolved
                  </p>
                </div>
                {inProgressCount === 0 && (
                  <div className="flex items-center gap-2 rounded-sm border border-[var(--factory-green)]/30 bg-[var(--factory-green)]/5 px-3 py-2">
                    <CheckCircle2 className="h-4 w-4 text-[var(--factory-green)]" />
                    <span className="text-xs text-[var(--factory-green)] font-semibold tracking-wide">All systems nominal</span>
                  </div>
                )}
              </div>

              {/* Filter buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => setAlertFilter("all")}
                  className={`flex items-center gap-1.5 h-7 px-3 rounded-sm text-[10px] font-semibold tracking-widest uppercase transition-colors ${
                    alertFilter === "all"
                      ? "bg-[var(--factory-cyan)] text-[var(--background)]"
                      : "border border-border text-muted-foreground hover:text-foreground hover:bg-[var(--factory-panel)]"
                  }`}
                >
                  All
                  <span className="text-[9px] font-mono">{alerts.length}</span>
                </button>
                <button
                  onClick={() => setAlertFilter("in-progress")}
                  className={`flex items-center gap-1.5 h-7 px-3 rounded-sm text-[10px] font-semibold tracking-widest uppercase transition-colors ${
                    alertFilter === "in-progress"
                      ? "bg-[var(--factory-amber)] text-white"
                      : inProgressCount > 0
                      ? "border border-[var(--factory-amber)]/40 text-[var(--factory-amber)] hover:bg-[var(--factory-amber)]/10"
                      : "border border-border text-muted-foreground"
                  }`}
                >
                  In Progress
                  <span className="text-[9px] font-mono">{inProgressCount}</span>
                </button>
                <button
                  onClick={() => setAlertFilter("resolved")}
                  className={`flex items-center gap-1.5 h-7 px-3 rounded-sm text-[10px] font-semibold tracking-widest uppercase transition-colors ${
                    alertFilter === "resolved"
                      ? "bg-[var(--factory-green)] text-white"
                      : resolvedCount > 0
                      ? "border border-[var(--factory-green)]/40 text-[var(--factory-green)] hover:bg-[var(--factory-green)]/10"
                      : "border border-border text-muted-foreground"
                  }`}
                >
                  Resolved
                  <span className="text-[9px] font-mono">{resolvedCount}</span>
                </button>
              </div>
            </div>

            {filteredAlerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
                {alertFilter === "all" ? (
                  <>
                    <CheckCircle2 className="h-12 w-12 text-[var(--factory-green)]/40" />
                    <div className="flex flex-col gap-1">
                      <span className="text-sm font-semibold text-muted-foreground">No incidents recorded</span>
                      <span className="text-xs text-muted-foreground">Incidents will appear here when channels report faults</span>
                    </div>
                  </>
                ) : alertFilter === "in-progress" ? (
                  <>
                    <CheckCircle2 className="h-12 w-12 text-[var(--factory-green)]/40" />
                    <div className="flex flex-col gap-1">
                      <span className="text-sm font-semibold text-muted-foreground">No active incidents</span>
                      <span className="text-xs text-muted-foreground">All channels operational</span>
                    </div>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-12 w-12 text-muted-foreground/30" />
                    <div className="flex flex-col gap-1">
                      <span className="text-sm font-semibold text-muted-foreground">No resolved incidents</span>
                      <span className="text-xs text-muted-foreground">Past incidents will show here</span>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {filteredAlerts.map((alert) => {
                  const channel = CHANNEL_DEFS.find((c) => c.id === alert.channelId)
                  const FaultIcon = alert.icon ?? WifiOff
                  return (
                    <div
                      key={alert.id}
                      className={`rounded-sm border bg-card transition-colors ${
                        alert.acknowledged
                          ? "border-border opacity-60"
                          : alert.reported
                          ? "border-[var(--factory-amber)]/40 bg-[var(--factory-amber)]/5"
                          : "border-[var(--factory-amber)]/60 bg-[var(--factory-amber)]/5"
                      }`}
                    >
                      {/* Alert header */}
                      <div className={`flex items-center justify-between border-b px-4 py-2.5 ${
                        alert.acknowledged ? "border-border" : "border-[var(--factory-amber)]/20"
                      }`}>
                        <div className="flex items-center gap-2.5">
                          {alert.acknowledged ? (
                            <CheckCircle2 className="h-4 w-4 shrink-0 text-[var(--factory-green)]" />
                          ) : (
                            <FaultIcon className={`h-4 w-4 shrink-0 text-[var(--factory-amber)] ${!alert.reported ? "animate-pulse" : ""}`} />
                          )}
                          <div className="flex flex-col leading-none gap-0.5">
                            <span className="text-xs font-bold text-foreground">{alert.title}</span>
                            <span className="text-[9px] tracking-widest uppercase text-muted-foreground">
                              {channel?.title ?? alert.channelId}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {alert.acknowledged && (
                            <span className="text-[9px] tracking-widest uppercase font-semibold text-[var(--factory-green)]">Resolved</span>
                          )}
                          {!alert.acknowledged && alert.reported && (
                            <div className="flex items-center gap-1.5">
                              <span className="h-1.5 w-1.5 rounded-full bg-[var(--factory-amber)] animate-pulse" />
                              <span className="text-[9px] tracking-widest uppercase text-[var(--factory-amber)]">Recovery in progress</span>
                            </div>
                          )}
                          <span className="font-mono text-[9px] text-muted-foreground">
                            {new Date(alert.ts).toLocaleTimeString("en-GB")} &nbsp;
                            {new Date(alert.ts).toLocaleDateString("en-GB")}
                          </span>
                        </div>
                      </div>

                      {/* Alert body */}
                      <div className="px-4 py-3 flex items-start justify-between gap-4">
                        <p className="text-xs text-muted-foreground leading-relaxed flex-1">{alert.detail}</p>
                        {!alert.acknowledged && !alert.reported && (
                          <Button
                            size="sm"
                            className="shrink-0 h-8 rounded-sm bg-[var(--factory-amber)]/10 border border-[var(--factory-amber)]/40 text-[var(--factory-amber)] text-[10px] tracking-widest uppercase hover:bg-[var(--factory-amber)]/20 font-semibold"
                            onClick={() => handleReport(alert.id)}
                          >
                            <FileText className="h-3.5 w-3.5 mr-1.5" />
                            Report Incident
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
          </div>
        )}

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
