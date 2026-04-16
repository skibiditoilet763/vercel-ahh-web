"use client"

import { useState } from "react"
import { RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

// Your 3 Grafana panel URLs
const GRAFANA_PANELS = [
  {
    id: 1,
    title: "Panel 1",
    url: "https://7c50-2402-800-61ca-7aea-a4bf-dfcb-eb0e-a8bc.ngrok-free.app/d-solo/ad498n8/testing?orgId=1&theme=dark&refresh=5s&panelId=1",
  },
  {
    id: 2,
    title: "Panel 2",
    url: "https://7c50-2402-800-61ca-7aea-a4bf-dfcb-eb0e-a8bc.ngrok-free.app/d-solo/ad498n8/testing?orgId=1&theme=dark&refresh=5s&panelId=3",
  },
  {
    id: 3,
    title: "Panel 3",
    url: "https://7c50-2402-800-61ca-7aea-a4bf-dfcb-eb0e-a8bc.ngrok-free.app/d-solo/ad498n8/testing?orgId=1&theme=dark&refresh=5s&panelId=1",
  },
]

export default function GrafanaDashboard() {
  const [refreshKey, setRefreshKey] = useState(0)

  const handleRefreshAll = () => {
    setRefreshKey((prev) => prev + 1)
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
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleRefreshAll}
          className="gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh All
        </Button>
      </header>

      {/* Dashboard Grid */}
      <main className="flex-1 p-6">
        <div className="grid h-full gap-6 md:grid-cols-2 lg:grid-cols-3">
          {GRAFANA_PANELS.map((panel) => (
            <div
              key={panel.id}
              className="flex flex-col overflow-hidden rounded-lg border border-border bg-card"
            >
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <h2 className="text-sm font-medium text-foreground">{panel.title}</h2>
              </div>
              <div className="relative flex-1 min-h-[300px]">
                <iframe
                  key={`${panel.id}-${refreshKey}`}
                  src={panel.url}
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
