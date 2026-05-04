/**
 * MetricPanel Component
 * Wrapper component that bridges the UI with the monitoring backend
 * Replaces iframe panels while maintaining the exact same layout
 */

'use client'

import React from 'react'
import { MetricChart } from './metric-chart'
import { useMetrics } from '@/hooks/use-metrics'
import { RefreshCw } from 'lucide-react'

interface MetricPanelProps {
  panelId: string
  title: string
  query: string
  timeRange: {
    from: number
    to: number
  }
  pollInterval?: number
}

export function MetricPanel({
  panelId,
  title,
  query,
  timeRange,
  pollInterval = 5000,
}: MetricPanelProps) {
  const { metrics, loading, error, refetch } = useMetrics(query, timeRange, {
    pollInterval,
  })

  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-border bg-card hover:border-cyan-500/50 transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3 bg-muted/20">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <button
          onClick={() => refetch()}
          disabled={loading}
          className="p-1 hover:bg-muted rounded transition-colors disabled:opacity-50"
          title="Refresh"
        >
          <RefreshCw
            className={`h-4 w-4 text-muted-foreground ${
              loading ? 'animate-spin' : ''
            }`}
          />
        </button>
      </div>

      {/* Chart Content */}
      <div className="relative flex-1 min-h-[250px] p-4">
        <MetricChart
          metrics={metrics}
          loading={loading}
          error={error}
          height={200}
        />
      </div>

      {/* Footer */}
      <div className="border-t border-border px-4 py-2 bg-muted/10 text-xs text-muted-foreground">
        <p>
          {loading
            ? 'Loading...'
            : error
              ? 'Error: Check connection'
              : `Updated: ${new Date().toLocaleTimeString()}`}
        </p>
      </div>
    </div>
  )
}
