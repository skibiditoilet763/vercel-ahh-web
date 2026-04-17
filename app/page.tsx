"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { RefreshCw, ZoomIn, ZoomOut } from "lucide-react"
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
  { label: "1H", value: 3600000 },
  { label: "6H", value: 21600000 },
  { label: "24H", value: 86400000 },
]

// Easing function for smooth transitions
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

export default function GrafanaDashboard() {
  const [timeRange, setTimeRange] = useState({ from: Date.now() - 3600000, to: Date.now() })
  const [isAnimating, setIsAnimating] = useState(false)
  const [activePreset, setActivePreset] = useState<string>("1H")
  const animationRef = useRef<number | null>(null)
  const iframeRefs = useRef<(HTMLIFrameElement | null)[]>([])

  // Build panel URL with current time range
  const buildPanelUrl = useCallback((panelId: string, from: number, to: number) => {
    return `${BASE_URL}?orgId=1&from=${Math.floor(from)}&to=${Math.floor(to)}&timezone=browser&refresh=5s&panelId=${panelId}&__feature.dashboardSceneSolo=true`
  }, [])

  // Update all panel iframes
  const updatePanels = useCallback((from: number, to: number) => {
    iframeRefs.current.forEach((iframe, index) => {
      if (iframe) {
        const newUrl = buildPanelUrl(PANELS[index].id, from, to)
        iframe.src = newUrl
      }
    })
  }, [buildPanelUrl])

  // Animate between time ranges
  const animateRange = useCallback((
    startFrom: number,
    startTo: number,
    endFrom: number,
    endTo: number,
    duration: number = 400
  ) => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
    }

    setIsAnimating(true)
    const startTime = performance.now()

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / duration, 1)
      const easedProgress = easeInOutCubic(progress)

      const currentFrom = startFrom + (endFrom - startFrom) * easedProgress
      const currentTo = startTo + (endTo - startTo) * easedProgress

      setTimeRange({ from: currentFrom, to: currentTo })

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate)
      } else {
        setIsAnimating(false)
        animationRef.current = null
        // Final update to ensure exact values
        updatePanels(endFrom, endTo)
      }
    }

    animationRef.current = requestAnimationFrame(animate)
  }, [updatePanels])

  // Zoom in: reduce time range by 50%, centered
  const zoomIn = useCallback(() => {
    if (isAnimating) return
    
    const currentRange = timeRange.to - timeRange.from
    const center = (timeRange.from + timeRange.to) / 2
    const newRange = currentRange * 0.5
    const newFrom = center - newRange / 2
    const newTo = center + newRange / 2

    setActivePreset("")
    animateRange(timeRange.from, timeRange.to, newFrom, newTo)
  }, [timeRange, isAnimating, animateRange])

  // Zoom out: increase time range by 100%, centered
  const zoomOut = useCallback(() => {
    if (isAnimating) return
    
    const currentRange = timeRange.to - timeRange.from
    const center = (timeRange.from + timeRange.to) / 2
    const newRange = currentRange * 2
    const newFrom = center - newRange / 2
    const newTo = center + newRange / 2

    setActivePreset("")
    animateRange(timeRange.from, timeRange.to, newFrom, newTo)
  }, [timeRange, isAnimating, animateRange])

  // Set specific time range from presets
  const setTimeRangePreset = useCallback((rangeMs: number, label: string) => {
    if (isAnimating) return
    
    const now = Date.now()
    const newFrom = now - rangeMs
    const newTo = now

    setActivePreset(label)
    animateRange(timeRange.from, timeRange.to, newFrom, newTo)
  }, [timeRange, isAnimating, animateRange])

  // Refresh all panels
  const handleRefresh = useCallback(() => {
    const now = Date.now()
    const range = timeRange.to - timeRange.from
    const newFrom = now - range
    const newTo = now

    setTimeRange({ from: newFrom, to: newTo })
    updatePanels(newFrom, newTo)
  }, [timeRange, updatePanels])

  // Update panels when time range changes (debounced during animation)
  useEffect(() => {
    if (!isAnimating) {
      updatePanels(timeRange.from, timeRange.to)
    }
  }, [timeRange, isAnimating, updatePanels])

  // Cleanup animation on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [])

  // Format time range for display
  const formatTimeRange = () => {
    const rangeMs = timeRange.to - timeRange.from
    if (rangeMs < 3600000) {
      return `${Math.round(rangeMs / 60000)}m`
    } else if (rangeMs < 86400000) {
      return `${(rangeMs / 3600000).toFixed(1)}h`
    } else {
      return `${(rangeMs / 86400000).toFixed(1)}d`
    }
  }

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
          <span className="ml-2 rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            Range: {formatTimeRange()}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Zoom Controls */}
          <div className="flex items-center rounded-md border border-border">
            <Button
              variant="ghost"
              size="sm"
              onClick={zoomIn}
              disabled={isAnimating}
              className="rounded-r-none border-r border-border"
              title="Zoom In"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={zoomOut}
              disabled={isAnimating}
              className="rounded-l-none"
              title="Zoom Out"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
          </div>

          {/* Time Presets */}
          <div className="flex items-center rounded-md border border-border">
            {TIME_PRESETS.map((preset, index) => (
              <Button
                key={preset.label}
                variant={activePreset === preset.label ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setTimeRangePreset(preset.value, preset.label)}
                disabled={isAnimating}
                className={`${index < TIME_PRESETS.length - 1 ? "border-r border-border rounded-r-none" : ""} ${index > 0 ? "rounded-l-none" : ""} ${index > 0 && index < TIME_PRESETS.length - 1 ? "rounded-none" : ""}`}
              >
                {preset.label}
              </Button>
            ))}
          </div>

          {/* Refresh */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isAnimating}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isAnimating ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </header>

      {/* Dashboard Grid */}
      <main className="flex-1 p-6">
        <div className="grid h-full gap-4 grid-cols-2">
          {PANELS.map((panel, index) => (
            <div
              key={panel.id}
              className="flex flex-col overflow-hidden rounded-lg border border-border bg-card"
            >
              <div className="flex items-center justify-between border-b border-border px-4 py-2">
                <h2 className="text-sm font-medium text-foreground">{panel.title}</h2>
              </div>
              <div className="relative flex-1 min-h-[200px]">
                <iframe
                  ref={(el) => { iframeRefs.current[index] = el }}
                  src={buildPanelUrl(panel.id, timeRange.from, timeRange.to)}
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
