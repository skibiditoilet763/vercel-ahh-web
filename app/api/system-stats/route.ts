/**
 * System Stats API Route
 * Provides aggregated system statistics
 */

import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    // In a real scenario, this would query Grafana for system metrics
    // For now, return realistic mock data
    
    const now = Date.now()
    const hour = 60 * 60 * 1000
    
    // Simulate varying load patterns
    const timeOfDay = new Date().getHours()
    const baseLoad = 30 + (timeOfDay % 24) * 2
    const currentSignals = Math.round(
      baseLoad + Math.sin(now / 10000) * 20 + Math.random() * 15
    )
    const maxConcurrentSignals = Math.round(baseLoad + 50)

    return NextResponse.json({
      currentSignals: Math.max(0, currentSignals),
      maxConcurrentSignals: Math.max(currentSignals, maxConcurrentSignals),
      timestamp: now,
    })
  } catch (error) {
    console.error('[v0] System stats error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch system stats' },
      { status: 500 }
    )
  }
}
