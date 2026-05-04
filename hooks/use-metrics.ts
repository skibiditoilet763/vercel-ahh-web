/**
 * useMetrics Hook
 * Custom hook for fetching and managing monitoring metrics
 * Handles polling, caching, and error states
 */

import { useState, useEffect, useCallback } from 'react'
import { MetricData, GrafanaResponse } from '@/lib/types'
import { GrafanaAdapter } from '@/lib/grafana-adapter'

interface UseMetricsOptions {
  pollInterval?: number
  enabled?: boolean
}

export function useMetrics(
  query: string,
  timeRange: { from: number; to: number },
  options: UseMetricsOptions = {}
) {
  const { pollInterval = 5000, enabled = true } = options

  const [metrics, setMetrics] = useState<MetricData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchMetrics = useCallback(async () => {
    if (!enabled || !query) {
      return
    }

    try {
      setLoading(true)
      setError(null)

      const response = await GrafanaAdapter.fetchMetrics(
        query,
        timeRange.from,
        timeRange.to
      )

      const transformed = GrafanaAdapter.transformMetrics(response)
      setMetrics(transformed)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch metrics'
      setError(errorMessage)
      console.error('[v0] Metrics fetch error:', err)

      // Fallback to mock data
      setMetrics([
        GrafanaAdapter.generateMockMetrics('System Load'),
        GrafanaAdapter.generateMockMetrics('Memory Pressure'),
      ])
    } finally {
      setLoading(false)
    }
  }, [query, timeRange, enabled])

  // Fetch on mount and when dependencies change
  useEffect(() => {
    if (!enabled) return

    fetchMetrics()
  }, [fetchMetrics, enabled])

  // Set up polling interval
  useEffect(() => {
    if (!enabled || pollInterval <= 0) return

    const interval = setInterval(fetchMetrics, pollInterval)
    return () => clearInterval(interval)
  }, [fetchMetrics, enabled, pollInterval])

  return {
    metrics,
    loading,
    error,
    refetch: fetchMetrics,
  }
}
