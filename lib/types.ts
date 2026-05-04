/**
 * Monitoring System Type Definitions
 * Adapter pattern for transforming Grafana data into custom format
 */

export interface MetricDataPoint {
  timestamp: number
  value: number
}

export interface MetricData {
  name: string
  data: MetricDataPoint[]
  unit?: string
  color?: string
}

export interface StatValue {
  label: string
  value: number | string
  unit?: string
  trend?: 'up' | 'down' | 'stable'
}

export interface PanelData {
  panelId: string
  title: string
  type: 'chart' | 'stat' | 'table' | 'gauge'
  metrics?: MetricData[]
  stats?: StatValue[]
  rows?: Record<string, any>[]
  loading?: boolean
  error?: string | null
}

export interface GrafanaMetric {
  target: string
  datapoints: Array<[number, number]> // [value, timestamp]
}

export interface GrafanaResponse {
  results: Array<{
    refId: string
    series: Array<{
      name: string
      points: Array<[number, number]>
    }>
    tables?: Array<{
      columns: Array<{ text: string }>
      rows: any[]
    }>
  }>
}
