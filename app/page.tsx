"use client"

import { useState, useCallback } from "react"
import { RefreshCw } from "lucide-react"
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

export default function GrafanaDashboard() {
  const [refreshKey, setRefreshKey] = useState(0)

  // Build panel URL
  const buildPanelUrl = useCallback((panelId: string) => {
    return `${BASE_URL}?orgId=1&from=now-1h&to=now&timezone=browser&refresh=5s&panelId=${panelId}&__feature.dashboardSceneSolo=true`
  }, [])

  // Refresh all panels
  const handleRefresh = useCallback(() => {
    setRefreshKey((prev) => prev + 1)
  }, [])

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

        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          className="gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh All
        </Button>
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
