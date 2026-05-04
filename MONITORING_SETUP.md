# Monitoring System Setup Guide

This dashboard integrates with Grafana while hiding all Grafana branding and implementation details. The UI remains unchanged, but now powered by real metrics.

## Architecture

```
┌─────────────────┐
│   UI (React)    │  - Shows the same dashboard layout
└────────┬────────┘
         │
┌────────▼────────────────────┐
│   Metric Panel Components   │  - New components that fetch real data
│   (metric-panel.tsx)        │  - Handle loading/error states
└────────┬────────────────────┘
         │
┌────────▼──────────────────────┐
│   useMetrics Hook             │  - Polling and caching logic
│   (hooks/use-metrics.ts)      │  - Transforms data for UI
└────────┬──────────────────────┘
         │
┌────────▼──────────────────────┐
│   API Route: /api/metrics     │  - Proxy to Grafana (server-side)
│   (app/api/metrics/route.ts)  │  - Removes Grafana branding
└────────┬──────────────────────┘
         │
┌────────▼──────────────────────┐
│   GrafanaAdapter              │  - Data transformation layer
│   (lib/grafana-adapter.ts)    │  - Adapter pattern
└────────┬──────────────────────┘
         │
┌────────▼──────────────────────┐
│   Grafana Backend             │  - Hidden from frontend
│   (Queries, Datasources)      │  - Full Grafana complexity
└───────────────────────────────┘
```

## Configuration

### 1. Add Environment Variables

Create a `.env.local` file with your Grafana details:

```env
NEXT_PUBLIC_GRAFANA_URL=https://your-grafana-instance.com
GRAFANA_API_KEY=your-api-key-here
```

Get your API key from Grafana:
1. Go to Grafana Admin Panel
2. Configuration → API Keys
3. Create a new API key with "Viewer" role minimum

### 2. Update Panel Queries

Edit `app/page.tsx` and update the `PANELS` array with your Grafana metrics:

```typescript
const PANELS = [
  { id: "panel-1", title: "CPU Usage", query: "rate(node_cpu_seconds_total[5m])" },
  { id: "panel-2", title: "Memory", query: "node_memory_MemAvailable_bytes" },
  // Add more panels...
]
```

## Key Features

### ✅ UI Unchanged
- Same layout, colors, spacing
- Same header with time range picker
- Same zoom controls and refresh buttons
- No visual changes to the dashboard

### ✅ Grafana Hidden
- No Grafana logos or branding
- No direct iframe embeds
- All queries proxied through API routes
- Grafana URL never exposed to client

### ✅ Real Metrics
- Live data from Grafana
- Polling every 5 seconds (configurable)
- Loading states and error handling
- Fallback to mock data if Grafana unavailable

### ✅ Performance Optimized
- Client-side caching with SWR patterns
- Batched API requests
- Configurable polling intervals
- No unnecessary re-renders

## Component Reference

### MetricPanel Component
Replaces iframe Grafana panels. Maintains exact same appearance.

```tsx
<MetricPanel
  panelId="panel-1"
  title="CPU Usage"
  query="rate(node_cpu_seconds_total[5m])"
  timeRange={timeRange}
  pollInterval={5000}
/>
```

### useMetrics Hook
Manages metric fetching, polling, and caching.

```tsx
const { metrics, loading, error, refetch } = useMetrics(
  "up",
  { from: Date.now() - 60000, to: Date.now() },
  { pollInterval: 5000 }
)
```

### MetricChart Component
Renders metrics as interactive Recharts line chart.

```tsx
<MetricChart
  metrics={metrics}
  loading={loading}
  error={error}
  height={250}
  title="System Metrics"
/>
```

## API Routes

### POST /api/metrics
Proxies queries to Grafana backend.

Request:
```json
{
  "query": "up",
  "from": 1704067200000,
  "to": 1704153600000
}
```

Response:
```json
{
  "results": [
    {
      "refId": "A",
      "series": [
        {
          "name": "Metric Name",
          "points": [[value, timestamp], ...]
        }
      ]
    }
  ]
}
```

## Troubleshooting

### No Data Appearing
1. Check Grafana API key in `.env.local`
2. Verify Grafana URL is accessible
3. Check browser console for errors
4. The app falls back to mock data if Grafana is unreachable

### CORS Errors
- All Grafana requests are proxied through `/api/metrics`
- No direct client-to-Grafana calls (this prevents CORS)

### Performance Issues
- Reduce `pollInterval` carefully (default: 5000ms)
- Consider caching data in Redis for high-frequency queries
- Use Grafana query rules to pre-aggregate data

## Extending the System

### Add Custom Queries
Edit `lib/grafana-adapter.ts` to add query templates:

```typescript
static queries = {
  cpuUsage: 'rate(node_cpu_seconds_total[5m])',
  memoryUsage: 'node_memory_MemAvailable_bytes',
  diskUsage: 'node_filesystem_avail_bytes',
}
```

### Add Statistics
Update `MetricPanel` to show aggregate stats:

```tsx
const stats = GrafanaAdapter.extractStats(metrics)
```

### Real-Time Updates
Switch from polling to WebSocket streaming in `useMetrics`:

```typescript
const connection = new WebSocket('wss://your-server/metrics')
connection.onmessage = (event) => setMetrics(JSON.parse(event.data))
```

## Branding Removal Checklist

- ✅ No "Grafana" text in UI
- ✅ No Grafana logos or watermarks
- ✅ No Grafana-specific styling
- ✅ No direct Grafana URLs exposed
- ✅ All requests proxied through API
- ✅ Metadata updated to custom branding
- ✅ Component names reflect custom system (MetricPanel, not GrafanaPanel)

## Next Steps

1. Configure Grafana API key
2. Update panel queries with your metrics
3. Customize colors in `metric-chart.tsx` if needed
4. Deploy to production
5. Monitor performance and adjust polling intervals

---

**Note:** The system gracefully handles Grafana downtime by falling back to mock data. This is useful for development and testing.
