"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { RefreshCw, ZoomIn, ZoomOut, LogOut, User, ExternalLink, TrendingUp, Settings2 } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
// Grafana dashboard URLs
const GRAFANA_PANELS = [
  {
    id: "panel-5",
    title: "Signal Stream 1",
    src: "https://821d-116-96-46-5.ngrok-free.app/d-solo/ad498n8/testing?orgId=1&from=1777920202740&to=1777920232740&timezone=browser&refresh=5s&panelId=panel-5&__feature.dashboardSceneSolo=true",
  },
  {
    id: "panel-4",
    title: "Signal Stream 2",
    src: "https://821d-116-96-46-5.ngrok-free.app/d-solo/ad498n8/testing?orgId=1&from=1777920208178&to=1777920238178&timezone=browser&refresh=5s&panelId=panel-4&__feature.dashboardSceneSolo=true",
  },
  {
    id: "panel-3",
    title: "Signal Stream 3",
    src: "https://821d-116-96-46-5.ngrok-free.app/d-solo/ad498n8/testing?orgId=1&from=1777920217740&to=1777920247740&timezone=browser&refresh=5s&panelId=panel-3&__feature.dashboardSceneSolo=true",
  },
  {
    id: "panel-1",
    title: "Signal Stream 4",
    src: "https://821d-116-96-46-5.ngrok-free.app/d-solo/ad498n8/testing?orgId=1&from=1777920222729&to=1777920252729&timezone=browser&refresh=5s&panelId=panel-1&__feature.dashboardSceneSolo=true",
  },
]

// Grafana main page URL (admin only)
const GRAFANA_MAIN_URL = "https://821d-116-96-46-5.ngrok-free.app"

// Test credentials (no database yet)
const TEST_USERS = [
  { username: "admin", password: "admin123", role: "admin" },
  { username: "user", password: "user123", role: "customer" },
]



interface SignalRecord {
  timestamp: number
  activeSignals: number
}

export default function DucsDashboard() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [currentUser, setCurrentUser] = useState("")
  const [userRole, setUserRole] = useState("")
  const [error, setError] = useState("")
  const [refreshKey, setRefreshKey] = useState(0)

  // Signal history tracking (admin only)
  const [signalHistory, setSignalHistory] = useState<SignalRecord[]>([])
  const [maxConcurrentSignals, setMaxConcurrentSignals] = useState(0)
  const signalIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Load signal history from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem("duc_signal_history")
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        setSignalHistory(parsed)
        const max = Math.max(...parsed.map((r: SignalRecord) => r.activeSignals))
        setMaxConcurrentSignals(max)
      } catch (e) {
        console.log("[v0] Error loading signal history:", e)
      }
    }
  }, [])

  // Simple login handler with hardcoded test credentials
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!username.trim() || !password.trim()) {
      setError("Please enter both username and password")
      return
    }

    // Check against test credentials
    const user = TEST_USERS.find(
      (u) => u.username === username && u.password === password
    )

    if (!user) {
      setError("Invalid username or password")
      return
    }

    setCurrentUser(user.username)
    setUserRole(user.role)
    setIsLoggedIn(true)
    setUsername("")
    setPassword("")

    // Start tracking signals after login
    startSignalTracking()
  }

  // Start tracking signal count
  const startSignalTracking = useCallback(() => {
    // Generate random signal count every 2 seconds
    signalIntervalRef.current = setInterval(() => {
      const randomSignals = Math.floor(Math.random() * 100) + 1
      const newRecord: SignalRecord = {
        timestamp: Date.now(),
        activeSignals: randomSignals,
      }

      setSignalHistory((prev) => {
        const updated = [...prev, newRecord]
        // Keep last 30 records (1 minute of data)
        if (updated.length > 30) updated.shift()

        // Update max concurrent signals
        const max = Math.max(...updated.map((r) => r.activeSignals))
        setMaxConcurrentSignals(max)

        // Save to localStorage
        localStorage.setItem("duc_signal_history", JSON.stringify(updated))

        return updated
      })
    }, 2000)
  }, [])

  // Logout handler
  const handleLogout = () => {
    setIsLoggedIn(false)
    setCurrentUser("")
    setUserRole("")

    // Clear signal tracking
    if (signalIntervalRef.current) {
      clearInterval(signalIntervalRef.current)
    }
    setSignalHistory([])
    setMaxConcurrentSignals(0)
  }

  // Animate time range changes
  // Refresh all panels
  const handleRefresh = useCallback(() => {
    setRefreshKey((prev) => prev + 1)
  }, [])

  // Zoom in - not used with iframes
  const handleZoomIn = useCallback(() => {
    handleRefresh()
  }, [handleRefresh])

  // Zoom out - not used with iframes
  const handleZoomOut = useCallback(() => {
    handleRefresh()
  }, [handleRefresh])

  // Get current active signals
  const currentActiveSignals = signalHistory.length > 0
    ? signalHistory[signalHistory.length - 1].activeSignals
    : 0

  // Login page
  if (!isLoggedIn) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6 shadow-lg">
          <div className="mb-6 flex flex-col items-center gap-3">
            <img
              src="/ducs-logo.jpg"
              alt="Duc's Dashboard Logo"
              className="h-16 w-16 rounded-lg object-cover"
            />
            <h1 className="text-2xl font-bold text-cyan-400">Duc&apos;s Dashboard</h1>
            <p className="text-sm text-muted-foreground">Real-Time Signal Monitoring</p>
          </div>

          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>

            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}

            <Button type="submit" className="w-full bg-cyan-500 hover:bg-cyan-600 text-black font-semibold">
              Sign In
            </Button>

            <div className="mt-2 rounded-md bg-muted p-3 text-xs text-muted-foreground">
              <p className="font-medium mb-1">Test Credentials:</p>
              <p>Admin: <span className="font-mono text-cyan-400">admin</span> / <span className="font-mono text-cyan-400">admin123</span></p>
              <p>User: <span className="font-mono text-cyan-400">user</span> / <span className="font-mono text-cyan-400">user123</span></p>
            </div>
          </form>
        </div>
      </div>
    )
  }

  // Dashboard (after login)
  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      {/* Header */}
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-card px-6 gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <img
            src="/ducs-logo.jpg"
            alt="Logo"
            className="h-10 w-10 rounded-lg object-cover flex-shrink-0"
          />
          <div className="flex flex-col gap-0 min-w-0">
            <h1 className="text-lg font-bold text-cyan-400 truncate">Duc&apos;s Dashboard</h1>
            <p className="text-xs text-muted-foreground">Real-Time Signal Monitor</p>
          </div>
        </div>

        {/* Signal Stats */}
        <div className="flex items-center gap-3 px-4 py-2 rounded-lg bg-muted/30 border border-cyan-500/20">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-cyan-400" />
            <div className="flex flex-col gap-0">
              <span className="text-xs text-muted-foreground">Current Signals</span>
              <span className="text-sm font-bold text-cyan-400">{currentActiveSignals}</span>
            </div>
          </div>
          <div className="w-px h-6 bg-border" />
          <div className="flex flex-col gap-0">
            <span className="text-xs text-muted-foreground">Max Concurrent</span>
            <span className="text-sm font-bold text-cyan-400">{maxConcurrentSignals}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 ml-auto">
          {/* Zoom Controls */}
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={handleZoomIn}
              title="Zoom In"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={handleZoomOut}
              title="Zoom Out"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
          </div>

          {/* Refresh */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>

          {/* MotionIQ Commissioning */}
          <Link href="/motioniq">
            <Button variant="outline" size="sm" className="gap-2">
              <Settings2 className="h-4 w-4" />
              MotionIQ Commissioning
            </Button>
          </Link>

          {/* Admin: Open Grafana */}
          {userRole === "admin" && (
            <Button
              variant="default"
              size="sm"
              className="gap-2 bg-cyan-500 hover:bg-cyan-600 text-black font-semibold"
              onClick={() => window.open(GRAFANA_MAIN_URL, "_blank")}
            >
              <ExternalLink className="h-4 w-4" />
              Grafana
            </Button>
          )}

          {/* User & Logout */}
          <div className="ml-2 flex items-center gap-2 border-l border-border pl-4">
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <User className="h-4 w-4" />
              <span>{currentUser}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="gap-1.5 text-muted-foreground hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Dashboard Grid */}
      <main className="flex-1 p-6 overflow-auto">
        <div className="grid h-full gap-4 grid-cols-1 md:grid-cols-2 auto-rows-max">
          {GRAFANA_PANELS.map((panel) => (
            <div
              key={panel.id}
              className="flex flex-col overflow-hidden rounded-lg border border-border bg-card hover:border-cyan-500/50 transition-colors"
            >
              <div className="flex items-center border-b border-border px-4 py-3 bg-muted/20">
                <h2 className="text-sm font-semibold text-foreground">{panel.title}</h2>
              </div>
              <div className="relative flex-1 min-h-[250px]">
                <iframe
                  src={panel.src}
                  className="absolute inset-0 h-full w-full border-0"
                  title={panel.title}
                  allow="fullscreen"
                />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
