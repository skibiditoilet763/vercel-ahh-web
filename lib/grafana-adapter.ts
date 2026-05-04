/**
 * Grafana Data Adapter
 * Transforms Grafana API responses into custom data format
 * This layer abstracts Grafana implementation details
 */

import { MetricData, MetricDataPoint, StatValue, GrafanaResponse } from './types'

const GRAFANA_URL = process.env.NEXT_PUBLIC_GRAFANA_URL || 'https://6387-2402-800-61ca-7aea-d56-cd0c-31c8-2816.ngrok-free.app'
const GRAFANA_API_KEY = process.env.GRAFANA_API_KEY || ''

export class GrafanaAdapter {
  /**
   * Fetch raw metrics from Grafana proxy
   */
  static async fetchMetrics(
    query: string,
    from: number,
    to: number
  ): Promise<GrafanaResponse> {
    try {
      const response = await fetch('/api/metrics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          from,
          to,
        }),
      })

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      console.error('[v0] Error fetching metrics:', error)
      throw error
    }
  }

  /**
   * Transform Grafana series data into MetricData format
   */
  static transformMetrics(grafanaData: GrafanaResponse): MetricData[] {
    const metrics: MetricData[] = []

    grafanaData.results.forEach((result) => {
      result.series?.forEach((series) => {
        const dataPoints: MetricDataPoint[] = series.points
          .map(([value, timestamp]) => ({
            timestamp: timestamp * 1000, // Convert to ms
            value: typeof value === 'number' ? value : parseFloat(value),
          }))
          .sort((a, b) => a.timestamp - b.timestamp)

        metrics.push({
          name: series.name,
          data: dataPoints,
        })
      })
    })

    return metrics
  }

  /**
   * Extract stat values from metrics
   */
  static extractStats(metrics: MetricData[]): StatValue[] {
    return metrics.map((metric) => {
      const latestValue = metric.data[metric.data.length - 1]?.value ?? 0
      const previousValue = metric.data[metric.data.length - 2]?.value ?? latestValue

      let trend: 'up' | 'down' | 'stable' = 'stable'
      if (latestValue > previousValue) trend = 'up'
      if (latestValue < previousValue) trend = 'down'

      return {
        label: metric.name,
        value: Math.round(latestValue * 100) / 100,
        unit: metric.unit || '',
        trend,
      }
    })
  }

  /**
   * Generate mock data for development/testing
   */
  static generateMockMetrics(name: string, points: number = 60): MetricData {
    const now = Date.now()
    const interval = 1000 // 1 second between points
    const data: MetricDataPoint[] = []

    for (let i = 0; i < points; i++) {
      const timestamp = now - (points - i) * interval
      const baseValue = 50 + Math.sin(i / 10) * 30 + Math.random() * 10
      data.push({
        timestamp,
        value: Math.round(baseValue * 100) / 100,
      })
    }

    return {
      name,
      data,
      unit: 'units',
      color: '#06b6d4', // cyan
    }
  }
}
