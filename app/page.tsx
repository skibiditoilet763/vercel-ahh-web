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
} from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { TimeRangePicker } from "@/components/time-range-picker"

// ─── Data source (embedded panels — internal telemetry engine)
const BASE_URL =
  "https://a65b-116-96-46-5.ngrok-free.app/d-solo/ad498n8/testing"
const INTERNAL_ADMIN_URL = "https://a65b-116-96-46-5.ngrok-free.app"

const TEST_USERS = [
  { username: "admin", password: "admin123", role: "admin" },
  { username: "user", password: "user123", role: "operator" },
]

// Panel definitions — presented as "Process Channels"
const PANELS = [
  {
    id: "panel-5",
    title: "Power Consumption",
    subtitle: "Voltage · Current · Power · PF",
    status: "nominal",
  },
  {
    id: "panel-4",
    title: "Air Quality",
    subtitle: "PM2.5 · PM10 · CO2 · VOC",
    status: "nominal",
  },
  {
    id: "panel-3",
    title: "XYZ Vibration",
    subtitle: "Tri-axis RMS envelope",
    status: "warning",
  },
  {
    id: "panel-1",
    title: "Environment",
    subtitle: "Temperature · Humidity · Vibration",
    status: "nominal",
  },
]

// Quick-stat definitions
const QUICK_STATS = [
  { label: "Active Channels", value: "4 / 4", icon: Radio, color: "cyan" },
  { label: "Sampling Rate", value: "5 s", icon: Activity, color: "green" },
  { label: "System Load", value: "32 %", icon: Cpu, color: "amber" },
  { label: "Alerts", value: "1", icon: AlertTriangle, color: "orange" },
]

interface SignalRecord {
  timestamp: number
  activeSignals: number
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

// ─── Per-panel iframe with custom loading overlay
function TelemetryFrame({ src, title }: { src: string; title: string }) {
  const [loaded, setLoaded] = useState(false)

  return (
    <div className="relative h-full w-full">
      {/* Loading overlay — hidden once iframe fires onLoad */}
      {!loaded && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-[var(--background)]">
          {/* Animated ring */}
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

// ─── Status indicator
function StatusDot({ status }: { status: string }) {
  const map: Record<string, string> = {
    nominal: "bg-[var(--factory-green)]",
    warning: "bg-[var(--factory-amber)]",
    error: "bg-[var(--factory-orange)]",
    offline: "bg-border",
  }
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full ${map[status] ?? "bg-border"} shadow-sm`}
      aria-label={status}
    />
  )
}

// ─── Clock widget
function LiveClock() {
  const [time, setTime] = useState("")
  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString("en-GB"))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])
  return (
    <span className="font-mono text-xs text-muted-foreground tabular-nums">
      {time}
    </span>
  )
}

// ─── Tiny sparkline bar (signal history)
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

export default function KilnOS() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [currentUser, setCurrentUser] = useState("")
  const [userRole, setUserRole] = useState("")
  const [error, setError] = useState("")

  const [refreshKey, setRefreshKey] = useState(0)
  const [timeRange, setTimeRange] = useState({
    from: Date.now() - 60 * 60 * 1000,
    to: Date.now(),
  })
  const animationRef = useRef<number | null>(null)

  const [signalHistory, setSignalHistory] = useState<SignalRecord[]>([])
  const [maxConcurrentSignals, setMaxConcurrentSignals] = useState(0)
  const signalIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Load signal history
  useEffect(() => {
    const stored = localStorage.getItem("fos_signal_history")
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        setSignalHistory(parsed)
        setMaxConcurrentSignals(
          Math.max(...parsed.map((r: SignalRecord) => r.activeSignals))
        )
      } catch (_) {}
    }
  }, [])

  const startSignalTracking = useCallback(() => {
    signalIntervalRef.current = setInterval(() => {
      const randomSignals = Math.floor(Math.random() * 100) + 1
      const newRecord: SignalRecord = {
        timestamp: Date.now(),
        activeSignals: randomSignals,
      }
      setSignalHistory((prev) => {
        const updated = [...prev, newRecord]
        if (updated.length > 30) updated.shift()
        const mx = Math.max(...updated.map((r) => r.activeSignals))
        setMaxConcurrentSignals(mx)
        localStorage.setItem("fos_signal_history", JSON.stringify(updated))
        return updated
      })
    }, 2000)
  }, [])

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
    startSignalTracking()
  }

  const handleLogout = () => {
    setIsLoggedIn(false)
    setCurrentUser("")
    setUserRole("")
    if (signalIntervalRef.current) clearInterval(signalIntervalRef.current)
    setSignalHistory([])
    setMaxConcurrentSignals(0)
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
    (newRange: { from: number; to: number }) =>
      animateToRange(newRange.from, newRange.to),
    [animateToRange]
  )

  const currentActiveSignals =
    signalHistory.length > 0
      ? signalHistory[signalHistory.length - 1].activeSignals
      : 0

  // ─── Login screen
  if (!isLoggedIn) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        {/* Background grid lines */}
        <div
          className="pointer-events-none fixed inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(var(--factory-cyan) 1px, transparent 1px), linear-gradient(90deg, var(--factory-cyan) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />

        <div className="relative w-full max-w-sm">
          {/* Corner brackets */}
          <span className="absolute -top-3 -left-3 h-5 w-5 border-t-2 border-l-2 border-[var(--factory-cyan)]" />
          <span className="absolute -top-3 -right-3 h-5 w-5 border-t-2 border-r-2 border-[var(--factory-cyan)]" />
          <span className="absolute -bottom-3 -left-3 h-5 w-5 border-b-2 border-l-2 border-[var(--factory-cyan)]" />
          <span className="absolute -bottom-3 -right-3 h-5 w-5 border-b-2 border-r-2 border-[var(--factory-cyan)]" />

          <div className="rounded-sm border border-border bg-card p-8 shadow-2xl">
            {/* Logo + brand */}
            <div className="mb-8 flex flex-col items-center gap-4">
              <div className="flex items-center justify-center h-14 w-14 rounded-sm border border-[var(--factory-cyan)]/30 bg-[var(--factory-panel)]">
                <Layers className="h-7 w-7 text-[var(--factory-cyan)]" />
              </div>
              <div className="text-center">
                <h1 className="text-xl font-bold tracking-widest uppercase text-foreground">
                  Kiln OS
                </h1>
                <p className="mt-1 text-xs tracking-widest uppercase text-muted-foreground">
                  Industrial Operations Platform
                </p>
              </div>
            </div>

            {/* Divider */}
            <div className="mb-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-[10px] tracking-widest uppercase text-muted-foreground">
                Secure Access
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <form onSubmit={handleLogin} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label
                  htmlFor="username"
                  className="text-xs tracking-widest uppercase text-muted-foreground"
                >
                  Operator ID
                </Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="Enter operator ID"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  className="border-border bg-[var(--factory-panel)] font-mono text-sm"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label
                  htmlFor="password"
                  className="text-xs tracking-widest uppercase text-muted-foreground"
                >
                  Access Code
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter access code"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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

            {/* Test credentials hint */}
            <div className="mt-5 rounded-sm border border-border bg-[var(--factory-panel)] p-3">
              <p className="mb-1.5 text-[10px] tracking-widest uppercase text-muted-foreground">
                Dev credentials
              </p>
              <div className="flex flex-col gap-1 font-mono text-xs">
                <span className="text-muted-foreground">
                  admin /{" "}
                  <span className="text-[var(--factory-cyan)]">admin123</span>
                </span>
                <span className="text-muted-foreground">
                  user /{" "}
                  <span className="text-[var(--factory-cyan)]">user123</span>
                </span>
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
      {/* Subtle grid background */}
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.025]"
        style={{
          backgroundImage:
            "linear-gradient(var(--factory-cyan) 1px, transparent 1px), linear-gradient(90deg, var(--factory-cyan) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      {/* ── Top bar ────────────────────────────────────────────── */}
      <header className="relative z-10 flex h-14 shrink-0 items-center border-b border-border bg-card px-4 gap-3">
        {/* Brand */}
        <div className="flex items-center gap-2.5 min-w-0 mr-4">
          <div className="flex h-7 w-7 items-center justify-center rounded-sm border border-[var(--factory-cyan)]/40 bg-[var(--factory-panel)]">
            <Layers className="h-4 w-4 text-[var(--factory-cyan)]" />
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-[11px] font-bold tracking-[0.2em] uppercase text-foreground">
              Kiln OS
            </span>
            <span className="text-[9px] tracking-widest uppercase text-muted-foreground">
              Operations Platform
            </span>
          </div>
        </div>

        {/* Divider */}
        <div className="h-6 w-px bg-border" />

        {/* Live stats row */}
        <div className="hidden md:flex items-center gap-4 flex-1 px-2">
          {QUICK_STATS.map((s) => {
            const Icon = s.icon
            const colorMap: Record<string, string> = {
              cyan: "text-[var(--factory-cyan)]",
              green: "text-[var(--factory-green)]",
              amber: "text-[var(--factory-amber)]",
              orange: "text-[var(--factory-orange)]",
            }
            return (
              <div key={s.label} className="flex items-center gap-1.5">
                <Icon className={`h-3.5 w-3.5 ${colorMap[s.color]}`} />
                <div className="flex flex-col leading-none">
                  <span className="text-[9px] tracking-widest uppercase text-muted-foreground">
                    {s.label}
                  </span>
                  <span
                    className={`text-xs font-bold tabular-nums ${colorMap[s.color]}`}
                  >
                    {s.value}
                  </span>
                </div>
              </div>
            )
          })}

          {/* Sparkline */}
          <div className="flex items-center gap-2 ml-2">
            <SignalSparkline history={signalHistory} />
            {signalHistory.length > 0 && (
              <div className="flex flex-col leading-none">
                <span className="text-[9px] uppercase tracking-widest text-muted-foreground">
                  Throughput
                </span>
                <span className="text-xs font-bold text-[var(--factory-cyan)] tabular-nums">
                  {currentActiveSignals} sig/s
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1.5 ml-auto">
          <TimeRangePicker
            timeRange={timeRange}
            onTimeRangeChange={handleTimeRangeChange}
          />

          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7 rounded-sm border-border"
            onClick={handleZoomIn}
            title="Zoom In"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7 rounded-sm border-border"
            onClick={handleZoomOut}
            title="Zoom Out"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            className="h-7 gap-1.5 rounded-sm border-border text-xs"
          >
            <RefreshCw className="h-3 w-3" />
            Sync
          </Button>

          <Link href="/motioniq">
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1.5 rounded-sm border-border text-xs hidden lg:flex"
            >
              <Settings2 className="h-3 w-3" />
              MotionIQ
            </Button>
          </Link>

          {/* Admin: raw telemetry engine access */}
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
              <span className="ml-0.5 rounded-sm border border-border px-1 py-0.5 text-[9px] uppercase tracking-wider">
                {userRole}
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-sm text-muted-foreground hover:text-foreground"
              onClick={handleLogout}
              title="Sign out"
            >
              <LogOut className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </header>

      {/* ── Status bar ─────────────────────────────────────────── */}
      <div className="relative z-10 flex h-7 items-center justify-between border-b border-border bg-[var(--factory-panel)] px-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3 w-3 text-[var(--factory-green)]" />
            <span className="text-[10px] tracking-widest uppercase text-muted-foreground">
              System Operational
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Circle className="h-2 w-2 fill-[var(--factory-cyan)] text-[var(--factory-cyan)] animate-pulse" />
            <span className="text-[10px] tracking-widest uppercase text-muted-foreground">
              Live Feed — 5s refresh
            </span>
          </div>
          <div className="hidden sm:flex items-center gap-1.5">
            <Gauge className="h-3 w-3 text-[var(--factory-amber)]" />
            <span className="text-[10px] tracking-widest uppercase text-muted-foreground">
              Peak: {maxConcurrentSignals} sig/s
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] tracking-widest uppercase text-muted-foreground hidden sm:block">
            Process Monitoring — 4 Channels Active
          </span>
          <LiveClock />
        </div>
      </div>

      {/* ── Channel grid ───────────────────────────────────────── */}
      <main className="relative z-10 flex-1 p-4 overflow-auto">
        <div className="grid gap-3 grid-cols-1 md:grid-cols-2 h-full">
          {PANELS.map((panel) => (
            <div
              key={panel.id}
              className="group flex flex-col overflow-hidden rounded-sm border border-border bg-card hover:border-[var(--factory-cyan)]/40 transition-colors duration-200"
            >
              {/* Panel header */}
              <div className="flex items-center justify-between border-b border-border bg-[var(--factory-panel)] px-3 py-2">
                <div className="flex items-center gap-2">
                  <StatusDot status={panel.status} />
                  <div className="flex flex-col leading-none">
                    <span className="text-xs font-semibold tracking-wide text-foreground">
                      {panel.title}
                    </span>
                    <span className="text-[9px] tracking-widest uppercase text-muted-foreground">
                      {panel.subtitle}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {panel.status === "warning" && (
                    <span className="flex items-center gap-1 rounded-sm border border-[var(--factory-amber)]/30 bg-[var(--factory-amber)]/5 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-widest text-[var(--factory-amber)]">
                      <AlertTriangle className="h-2.5 w-2.5" />
                      Threshold
                    </span>
                  )}
                  <span className="font-mono text-[9px] text-muted-foreground">
                    {panel.id.toUpperCase().replace("-", "_")}
                  </span>
                </div>
              </div>

              {/* Embedded telemetry panel */}
              <div className="relative flex-1 min-h-[240px] bg-[var(--background)]">
                <TelemetryFrame
                  key={`${panel.id}-${refreshKey}`}
                  src={buildPanelUrl(panel.id)}
                  title={panel.title}
                />
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* ── Footer bar ─────────────────────────────────────────── */}
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
