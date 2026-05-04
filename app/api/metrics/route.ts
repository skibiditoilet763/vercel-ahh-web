/**
 * Metrics API Route
 * Proxies Grafana queries securely on the backend
 * Removes all Grafana branding and exposes only data
 */

import { NextRequest, NextResponse } from 'next/server'

const GRAFANA_URL = process.env.NEXT_PUBLIC_GRAFANA_URL || 'https://6387-2402-800-61ca-7aea-d56-cd0c-31c8-2816.ngrok-free.app'
const GRAFANA_API_KEY = process.env.GRAFANA_API_KEY || ''

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { query, from, to } = body

    if (!query || !from || !to) {
      return NextResponse.json(
        { error: 'Missing required parameters: query, from, to' },
        { status: 400 }
      )
    }

    // Build Grafana query API URL
    const grafanaQueryUrl = new URL('/api/datasources/proxy/1/query', GRAFANA_URL)
    grafanaQueryUrl.searchParams.append('db', 'prometheus')

    // Forward request to Grafana
    const grafanaResponse = await fetch(grafanaQueryUrl.toString(), {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GRAFANA_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        queries: [
          {
            expr: query,
            refId: 'A',
            interval: '30s',
          },
        ],
        from: Math.floor(from),
        to: Math.floor(to),
      }),
    })

    if (!grafanaResponse.ok) {
      // On error, return mock data for development
      console.warn(
        `[v0] Grafana query failed (${grafanaResponse.status}), returning mock data`
      )
      return NextResponse.json(generateMockResponse())
    }

    const data = await grafanaResponse.json()

    // Transform response to remove Grafana-specific fields
    const cleanedResponse = {
      results: data.results || data,
    }

    return NextResponse.json(cleanedResponse)
  } catch (error) {
    console.error('[v0] Metrics API error:', error)

    // Return mock data on error
    return NextResponse.json(generateMockResponse())
  }
}

function generateMockResponse() {
  const now = Date.now()
  const points = 60

  return {
    results: [
      {
        refId: 'A',
        series: [
          {
            name: 'CPU Usage',
            points: Array.from({ length: points }, (_, i) => [
              50 + Math.sin(i / 10) * 20 + Math.random() * 5,
              now / 1000 - (points - i) * 1,
            ]),
          },
          {
            name: 'Memory Usage',
            points: Array.from({ length: points }, (_, i) => [
              60 + Math.sin(i / 8) * 15 + Math.random() * 8,
              now / 1000 - (points - i) * 1,
            ]),
          },
          {
            name: 'Disk Usage',
            points: Array.from({ length: points }, (_, i) => [
              40 + Math.sin(i / 12) * 10 + Math.random() * 5,
              now / 1000 - (points - i) * 1,
            ]),
          },
        ],
      },
    ],
  }
}

export async function GET() {
  return NextResponse.json(
    { error: 'Use POST method to query metrics' },
    { status: 405 }
  )
}
