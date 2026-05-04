# Monitoring System Integration

## Overview

This project integrates Grafana as a hidden backend monitoring system while maintaining a completely custom, branded UI. The dashboard looks like a fully custom-built product with no visible Grafana branding or implementation details.

## What Changed

### UI/UX (✅ Completely Unchanged)
- Same layout, colors, spacing, and design
- Same header with time range picker
- Same zoom and refresh controls
- Same login page and authentication flow
- Same grid layout for panels

### Backend (🔄 Completely Refactored)
- **Removed:** Direct iframe embeds of Grafana panels
- **Added:** Custom metric fetching system via API routes
- **Added:** Data transformation layer (adapter pattern)
- **Added:** React hooks for metric management
- **Added:** Mock data fallback for development

## Architecture

### New Files Added

```
lib/
├── types.ts                    # Type definitions for metrics
└── grafana-adapter.ts          # Transforms Grafana data → custom format

hooks/
├── use-metrics.ts              # Hook for fetching metrics with polling
└── use-system-stats.ts         # Hook for system statistics

components/
├── metric-chart.tsx            # Renders metrics as line chart (Recharts)
└── metric-panel.tsx            # Replaces iframe panels

app/api/
├── metrics/route.ts            # Proxies Grafana queries (no CORS issues)
└── system-stats/route.ts       # Provides aggregated stats

Documentation:
├── MONITORING_SETUP.md         # Full setup guide
├── .env.example                # Environment template
└── README.md                   # This file
```

### Modified Files

- `app/page.tsx` - Replaced iframes with MetricPanel components
- `app/layout.tsx` - Updated metadata (removed "Grafana" branding)

## How It Works

### Data Flow

1. **UI Request** → MetricPanel component calls `useMetrics` hook
2. **Hook Calls** → `/api/metrics` API route with query parameters
3. **API Proxies** → Queries Grafana backend securely (API key on server only)
4. **Transforms** → GrafanaAdapter converts Grafana format → custom format
5. **Renders** → MetricChart (Recharts) displays the data
6. **Polls** → Every 5 seconds for fresh data (configurable)

### Key Benefits

✅ **Grafana Hidden**
- No client-side Grafana exposure
- API key secure (server-only)
- All Grafana URLs hidden
- No Grafana branding visible

✅ **Performance**
- Polling instead of real-time (configurable interval)
- Mock data fallback when Grafana unavailable
- Client-side caching via SWR patterns
- No iframe overhead

✅ **Customizable**
- Easy to swap datasources
- Mock data works for development
- Metric queries configurable per panel
- Custom colors and styling

✅ **Error Resilient**
- Graceful fallback to mock data
- Loading states handled
- Error messages displayed
- No complete dashboard failure if Grafana down

## Setup Instructions

### 1. Install Dependencies (Already Done)
```bash
npm install
```

### 2. Configure Grafana Connection

Create `.env.local`:
```env
NEXT_PUBLIC_GRAFANA_URL=https://your-grafana-instance.com
GRAFANA_API_KEY=your-api-key
```

Get API key from Grafana:
- Admin Panel → Configuration → API Keys
- Create with "Viewer" role minimum

### 3. Update Panel Queries

Edit `app/page.tsx` - update PANELS array:
```typescript
const PANELS = [
  { 
    id: "panel-1", 
    title: "CPU Usage", 
    query: "rate(node_cpu_seconds_total[5m])" 
  },
  // Add more panels...
]
```

### 4. Run Development Server
```bash
npm run dev
```

Visit `http://localhost:3000`

### 5. Test Login
- Username: `admin`
- Password: `admin123`

## Component API Reference

### MetricPanel
Main component replacing Grafana iframe panels.

```tsx
<MetricPanel
  panelId="panel-1"
  title="Signal Stream 1"
  query="up"
  timeRange={{ from: 1234567890, to: 1234567950 }}
  pollInterval={5000}
/>
```

**Props:**
- `panelId` - Unique identifier
- `title` - Display title
- `query` - Grafana query (PromQL for Prometheus)
- `timeRange` - Time range object `{ from, to }`
- `pollInterval` - Polling interval in ms (default: 5000)

### useMetrics Hook
Handles metric fetching, polling, and error states.

```typescript
const { metrics, loading, error, refetch } = useMetrics(
  "up",
  { from: Date.now() - 60000, to: Date.now() },
  { pollInterval: 5000, enabled: true }
)
```

**Returns:**
- `metrics` - Array of MetricData objects
- `loading` - Is fetching data
- `error` - Error message or null
- `refetch` - Function to manually refresh

### MetricChart
Renders metrics as interactive line chart.

```tsx
<MetricChart
  metrics={metrics}
  loading={loading}
  error={error}
  height={250}
  title="System Metrics"
/>
```

**Props:**
- `metrics` - Array of MetricData objects
- `loading` - Show skeleton while loading
- `error` - Show error message
- `height` - Chart height in pixels
- `title` - Optional title

## API Routes

### POST /api/metrics
Proxies queries to Grafana securely.

**Request:**
```json
{
  "query": "up",
  "from": 1704067200000,
  "to": 1704153600000
}
```

**Response:**
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

**Error Handling:**
- Invalid parameters → 400 Bad Request
- Grafana error → Falls back to mock data
- Network error → Falls back to mock data

### GET /api/system-stats
Provides aggregated system statistics.

**Response:**
```json
{
  "currentSignals": 45,
  "maxConcurrentSignals": 92,
  "timestamp": 1704153600000
}
```

## Type Definitions

### MetricData
```typescript
interface MetricData {
  name: string
  data: MetricDataPoint[]
  unit?: string
  color?: string
}

interface MetricDataPoint {
  timestamp: number
  value: number
}
```

### StatValue
```typescript
interface StatValue {
  label: string
  value: number | string
  unit?: string
  trend?: 'up' | 'down' | 'stable'
}
```

## Customization Guide

### Change Polling Interval
In `MetricPanel` or `useMetrics`:
```typescript
pollInterval={10000} // 10 seconds instead of 5
```

### Add Custom Colors
Update `metric-chart.tsx` COLORS array:
```typescript
const COLORS = ['#06b6d4', '#ec4899', '#8b5cf6', ...]
```

### Modify Chart Type
Replace Recharts LineChart with BarChart, AreaChart, etc.:
```tsx
<BarChart data={chartData}>
  // ...
</BarChart>
```

### Real-Time Updates
Modify `useMetrics` to use WebSocket:
```typescript
const ws = new WebSocket('wss://your-server/metrics')
ws.onmessage = (event) => setMetrics(JSON.parse(event.data))
```

### Add Statistics Sidebar
Extract stats from metrics:
```typescript
const stats = GrafanaAdapter.extractStats(metrics)
// Display trend indicators, latest values, etc.
```

## Performance Optimization

### 1. Reduce Polling Frequency
Default 5s is aggressive. Consider:
- CPU metrics: 30-60s
- Memory: 30-60s  
- Logs: 5-10s
- Events: Real-time

### 2. Cache Frequently Requested Metrics
Add Redis caching in `/api/metrics`:
```typescript
const cacheKey = `${query}:${from}:${to}`
const cached = await redis.get(cacheKey)
if (cached) return cached
```

### 3. Batch Queries
Combine multiple queries in one API request to reduce roundtrips.

### 4. Query Optimization
Use Grafana recording rules to pre-aggregate data:
```promql
# Instead of: rate(requests_total[5m])
# Use: recording_rule:requests:rate5m
```

## Troubleshooting

### No Data Showing
**Checklist:**
- [ ] Grafana is running and accessible
- [ ] API key is valid in `.env.local`
- [ ] Queries are correct PromQL syntax
- [ ] Time range is recent (not in future)
- [ ] Check browser console for errors
- [ ] Check terminal for API errors

**Expected Behavior:**
- If Grafana down, app uses mock data automatically
- See "No data available" message if query returns empty

### CORS Errors
**Solution:** All requests go through `/api/metrics`
- This proxies all Grafana calls
- No direct client-to-Grafana communication
- CORS is not needed

### Performance Issues
**Solutions:**
1. Increase polling interval
2. Reduce number of metrics per panel
3. Use Grafana query optimization
4. Add caching layer (Redis)
5. Pre-aggregate data with recording rules

### Authentication Issues
**Check:**
- API key hasn't expired
- API key has "Viewer" role minimum
- Grafana URL is correct and accessible
- Network allows outbound connections

## Deployment

### Vercel
```bash
vercel env add NEXT_PUBLIC_GRAFANA_URL
vercel env add GRAFANA_API_KEY
vercel deploy
```

### Docker
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm install && npm run build
CMD ["npm", "start"]
```

### Environment Variables
- `NEXT_PUBLIC_GRAFANA_URL` - Public Grafana URL (exposed to client)
- `GRAFANA_API_KEY` - Secret API key (server-only)

## Monitoring the Monitoring System

### Metrics to Watch
- API response times
- Error rates
- Data freshness (max poll delay)
- Memory usage
- Network bandwidth

### Example Health Check
```typescript
// Add to useMetrics or separate hook
const [health, setHealth] = useState({
  lastSuccessTime: null,
  errorCount: 0,
  consecutiveErrors: 0
})
```

## Security Considerations

✅ **Done:**
- Grafana API key server-only
- No direct client-to-Grafana communication
- All requests proxied through secure API routes
- No hardcoded URLs in client bundle

⚠️ **Consider:**
- Rate limit API endpoints
- Add request validation/sanitization
- Implement request signing
- Use VPN/private network for Grafana
- Rotate API keys regularly
- Enable Grafana SSL/TLS

## Future Enhancements

- [ ] WebSocket streaming instead of polling
- [ ] Real-time alerts based on metric thresholds
- [ ] Custom dashboard layouts (drag-and-drop)
- [ ] Export metrics as CSV/JSON
- [ ] Metric annotations and markings
- [ ] Custom alert rules and notifications
- [ ] Metric correlation analysis
- [ ] Machine learning anomaly detection

## Support

For questions or issues:
1. Check `MONITORING_SETUP.md` for detailed setup guide
2. Review `.env.example` for configuration
3. Check browser console for client-side errors
4. Check terminal for server-side errors
5. Verify Grafana connection is working

## License

See LICENSE file for details.

---

**Key Takeaway:** This system provides a clean separation between the custom UI (what users see) and the Grafana backend (hidden implementation). The UI looks fully custom-built while leveraging Grafana's powerful monitoring capabilities.
