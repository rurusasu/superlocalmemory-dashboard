import { NextResponse } from 'next/server'
import { execFileSync } from 'child_process'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const log = logger.child({ route: '/api/stats' })

export async function GET() {
  let dailyCounts: { date: string; count: number }[] = []
  const sourceCounts: Record<string, number> = {}

  try {
    const result = execFileSync('slm', ['list', '--limit', '500', '--json'], { timeout: 15000 })
    const memories: unknown[] = JSON.parse(result.toString())
    if (Array.isArray(memories)) {
      const byDate: Record<string, number> = {}
      for (const m of memories as Record<string, string>[]) {
        const ts = m.timestamp || m.created_at || m.date
        if (ts) {
          const date = new Date(ts).toISOString().slice(0, 10)
          byDate[date] = (byDate[date] || 0) + 1
        }
        const source = m.source || 'unknown'
        sourceCounts[source] = (sourceCounts[source] || 0) + 1
      }
      dailyCounts = Object.entries(byDate)
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-30)
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'unknown error'
    log.warn({ err: message }, 'Failed to fetch stats')
  }

  return NextResponse.json({ dailyCounts, sourceCounts })
}
