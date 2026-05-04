/**
 * MetricChart Component
 * Renders monitoring metrics as an interactive chart
 * Replaces iframe Grafana panels with real data
 */

'use client'

import React from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { MetricData } from '@/lib/types'
import { Skeleton } from '@/components/ui/skeleton'

interface MetricChartProps {
  metrics: MetricData[]
  loading?: boolean
  error?: string | null
  height?: number
  title?: string
}

const COLORS = ['#06b6d4', '#ec4899', '#8b5cf6', '#f59e0b', '#10b981']

export function MetricChart({
  metrics,
  loading = false,
  error = null,
  height = 300,
  title,
}: MetricChartProps) {
  if (error) {
    return (
      <div className="flex items-center justify-center p-4" style={{ height }}>
        <div className="text-center">
          <p className="text-sm text-red-500 mb-2">Error loading metrics</p>
          <p className="text-xs text-muted-foreground">{error}</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return <Skeleton style={{ height }} className="w-full rounded-md" />
  }

  if (!metrics || metrics.length === 0) {
    return (
      <div
        className="flex items-center justify-center bg-muted/10 rounded-md"
        style={{ height }}
      >
        <p className="text-sm text-muted-foreground">No data available</p>
      </div>
    )
  }

  // Merge all metric data points by timestamp
  const mergedData: Record<string, any> = {}

  metrics.forEach((metric, metricIndex) => {
    metric.data.forEach((point) => {
      if (!mergedData[point.timestamp]) {
        mergedData[point.timestamp] = { timestamp: point.timestamp }
      }
      mergedData[point.timestamp][metric.name] = point.value
    })
  })

  const chartData = Object.values(mergedData).sort(
    (a, b) => a.timestamp - b.timestamp
  )

  // Format timestamp for display
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
  }

  return (
    <div className="w-full">
      {title && (
        <h3 className="text-sm font-semibold mb-3 text-foreground">{title}</h3>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="timestamp"
            tickFormatter={formatTime}
            tick={{ fontSize: 12 }}
            stroke="#9ca3af"
          />
          <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1f2937',
              border: '1px solid #374151',
              borderRadius: '8px',
            }}
            labelFormatter={(label) => formatTime(label)}
            formatter={(value) => [
              typeof value === 'number' ? value.toFixed(2) : value,
              '',
            ]}
          />
          <Legend />
          {metrics.map((metric, index) => (
            <Line
              key={metric.name}
              type="monotone"
              dataKey={metric.name}
              stroke={metric.color || COLORS[index % COLORS.length]}
              dot={false}
              isAnimationActive={false}
              strokeWidth={2}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
