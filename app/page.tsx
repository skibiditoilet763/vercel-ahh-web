"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { RefreshCw, ZoomIn, ZoomOut, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"

// Base URL for Grafana panels
const BASE_URL = "https://c54e-2402-800-61ca-7aea-7dee-f491-8847-8e3a.ngrok-free.app/d-solo/ad498n8/testing"

// Panel configurations
const PANELS = [
  { id: "panel-1", title: "Panel 1" },
  { id: "panel-4", title: "Panel 4" },
  { id: "panel-3", title: "Panel 3" },
  { id: "panel-5", title: "Panel 5" },
]

// Time presets in milliseconds
const TIME_PRESETS = [
  { label: "15m", value: 15 * 60 * 1000 },
  { label: "1H", value: 60 * 60 * 1000 },
  { label: "6H", value: 6 * 60 * 60 * 1000 },
  { label: "24H", value: 24 * 60 * 60 * 1000 },
]

// Cubic easing function for smooth animations
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

export default function GrafanaDashboard() {
  const [refreshKey, setRefreshKey] = useState(0)
  const [timeRange, setTimeRange] = useState({
    from: Date.now() - 60 * 60 * 1000, // 1 hour ago
    to: Date.now(),
  })
  const [activePreset, setActivePreset] = useState("1H")
  const animationRef = useRef<number | null>(null)

  // Animate time range changes
  const animateToRange = useCallback((targetFrom: number, targetTo: number, presetLabel?: string) => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
    }

    const startFrom = timeRange.from
    const startTo = timeRange.to
    const startTime = performance.now()
    const duration = 400

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = easeInOutCubic(progress)

      const newFrom = startFrom + (targetFrom - startFrom) * eased
      const newTo = startTo + (targetTo - startTo) * eased

      setTimeRange({ from: newFrom, to: newTo })

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate)
      } else {
        if (presetLabel) setActivePreset(presetLabel)
        setRefreshKey((prev) => prev + 1)
      }
    }

    animationRef.current = requestAnimationFrame(animate)
  }, [timeRange])

  // Cleanup animation on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [])

  // Build panel URL with current time range
  const buildPanelUrl = useCallback((panelId: string) => {
    return `${BASE_URL}?orgId=1&from=${Math.floor(timeRange.from)}&to=${Math.floor(timeRange.to)}&timezone=browser&refresh=5s&panelId=${panelId}&__feature.dashboardSceneSolo=true`
  }, [timeRange])

  // Refresh all panels
  const handleRefresh = useCallback(() => {
    const range = timeRange.to - timeRange.from
    const now = Date.now()
    setTimeRange({ from: now - range, to: now })
    setRefreshKey((prev) => prev + 1)
  }, [timeRange])

  // Zoom in (reduce time range by 50%)
  const handleZoomIn = useCallback(() => {
    const center = (timeRange.from + timeRange.to) / 2
    const halfRange = (timeRange.to - timeRange.from) / 4
    animateToRange(center - halfRange, center + halfRange)
    setActivePreset("")
  }, [timeRange, animateToRange])

  // Zoom out (increase time range by 100%)
  const handleZoomOut = useCallback(() => {
    const center = (timeRange.from + timeRange.to) / 2
    const halfRange = (timeRange.to - timeRange.from)
    animateToRange(center - halfRange, center + halfRange)
    setActivePreset("")
  }, [timeRange, animateToRange])

  // Apply time preset
  const handlePreset = useCallback((preset: { label: string; value: number }) => {
    const now = Date.now()
    animateToRange(now - preset.value, now, preset.label)
  }, [animateToRange])

  // Format time range for display
  const formatTimeRange = useCallback(() => {
    const range = timeRange.to - timeRange.from
    if (range < 60 * 1000) return `${Math.round(range / 1000)}s`
    if (range < 60 * 60 * 1000) return `${Math.round(range / (60 * 1000))}m`
    if (range < 24 * 60 * 60 * 1000) return `${(range / (60 * 60 * 1000)).toFixed(1)}h`
    return `${(range / (24 * 60 * 60 * 1000)).toFixed(1)}d`
  }, [timeRange])

  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      {/* Header */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-500">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="h-5 w-5 text-white"
              stroke="currentColor"
              strokeWidth="2"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M3 9h18" />
              <path d="M9 21V9" />
            </svg>
          </div>
          <h1 className="text-lg font-semibold text-foreground">Grafana Dashboard</h1>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          {/* Time Range Indicator */}
          <div className="flex items-center gap-1.5 rounded-md bg-muted px-3 py-1.5 text-sm text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span>{formatTimeRange()}</span>
          </div>

          {/* Time Presets */}
          <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/50 p-1">
            {TIME_PRESETS.map((preset) => (
              <Button
                key={preset.label}
                variant={activePreset === preset.label ? "default" : "ghost"}
                size="sm"
                className="h-7 px-2.5 text-xs"
                onClick={() => handlePreset(preset)}
              >
                {preset.label}
              </Button>
            ))}
          </div>

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
        </div>
      </header>

      {/* Dashboard Grid */}
      <main className="flex-1 p-6">
        <div className="grid h-full gap-4 grid-cols-1 md:grid-cols-2">
          {PANELS.map((panel) => (
            <div
              key={panel.id}
              className="flex flex-col overflow-hidden rounded-lg border border-border bg-card"
            >
              <div className="flex items-center border-b border-border px-4 py-2">
                <h2 className="text-sm font-medium text-foreground">{panel.title}</h2>
              </div>
              <div className="relative flex-1 min-h-[200px]">
                <iframe
                  key={`${panel.id}-${refreshKey}`}
                  src={buildPanelUrl(panel.id)}
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
