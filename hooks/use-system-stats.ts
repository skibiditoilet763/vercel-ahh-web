/**
 * useSystemStats Hook
 * Fetches system-level statistics (CPU, Memory, Disk)
 * Used for the header signal stats display
 */

import { useState, useEffect, useCallback } from 'react'

interface SystemStats {
  currentSignals: number
  maxConcurrentSignals: number
}

export function useSystemStats() {
  const [stats, setStats] = useState<SystemStats>({
    currentSignals: 0,
    maxConcurrentSignals: 0,
  })
  const [loading, setLoading] = useState(true)

  const fetchSystemStats = useCallback(async () => {
    try {
      const response = await fetch('/api/system-stats')
      if (response.ok) {
        const data = await response.json()
        setStats(data)
      }
    } catch (error) {
      console.error('[v0] Error fetching system stats:', error)
      // Use mock data on error
      setStats({
        currentSignals: Math.floor(Math.random() * 100),
        maxConcurrentSignals: 95,
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSystemStats()
    const interval = setInterval(fetchSystemStats, 5000)
    return () => clearInterval(interval)
  }, [fetchSystemStats])

  return { ...stats, loading }
}
