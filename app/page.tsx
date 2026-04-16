"use client"

import { useState } from "react"
import { Settings, RefreshCw, Maximize2, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

// Your Grafana dashboard URL via ngrok tunnel
const DEFAULT_GRAFANA_URL = "https://ce6a-2402-800-61ca-7aea-a4bf-dfcb-eb0e-a8bc.ngrok-free.app/?orgId=1&from=now-6h&to=now&timezone=browser"

export default function GrafanaDashboard() {
  const [grafanaUrl, setGrafanaUrl] = useState(DEFAULT_GRAFANA_URL)
  const [tempUrl, setTempUrl] = useState(grafanaUrl)
  const [refreshKey, setRefreshKey] = useState(0)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const handleRefresh = () => {
    setRefreshKey((prev) => prev + 1)
  }

  const handleSaveUrl = () => {
    setGrafanaUrl(tempUrl)
    setIsSettingsOpen(false)
    handleRefresh()
  }

  const handleFullscreen = () => {
    const iframe = document.getElementById("grafana-iframe")
    if (iframe) {
      if (document.fullscreenElement) {
        document.exitFullscreen()
        setIsFullscreen(false)
      } else {
        iframe.requestFullscreen()
        setIsFullscreen(true)
      }
    }
  }

  const handleOpenExternal = () => {
    window.open(grafanaUrl, "_blank")
  }

  return (
    <div className="flex h-screen w-full flex-col bg-background">
      {/* Minimal Header */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-card px-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-orange-500">
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
          <h1 className="text-sm font-medium text-foreground">Grafana Dashboard</h1>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            title="Refresh dashboard"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleFullscreen}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            title="Fullscreen"
          >
            <Maximize2 className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleOpenExternal}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            title="Open in new tab"
          >
            <ExternalLink className="h-4 w-4" />
          </Button>

          <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                title="Settings"
              >
                <Settings className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Dashboard Settings</DialogTitle>
                <DialogDescription>
                  Enter your Grafana dashboard URL. Add <code className="rounded bg-muted px-1 py-0.5 text-xs">&kiosk</code> to the URL for a cleaner view.
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-4 py-4">
                <div className="flex flex-col gap-2">
                  <label htmlFor="grafana-url" className="text-sm font-medium text-foreground">
                    Grafana URL
                  </label>
                  <Input
                    id="grafana-url"
                    value={tempUrl}
                    onChange={(e) => setTempUrl(e.target.value)}
                    placeholder="http://localhost:3000/d/..."
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Example: http://localhost:3000/d/abc123/my-dashboard?orgId=1&kiosk
                  </p>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsSettingsOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleSaveUrl}>Save & Reload</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      {/* Embedded Grafana Dashboard */}
      <main className="relative flex-1">
        <iframe
          id="grafana-iframe"
          key={refreshKey}
          src={grafanaUrl}
          className="h-full w-full border-0"
          title="Grafana Dashboard"
          allow="fullscreen"
        />
        

      </main>
    </div>
  )
}
