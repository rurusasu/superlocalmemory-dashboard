import { NextResponse } from 'next/server'
import { execSync } from 'child_process'

export const dynamic = 'force-dynamic'

export async function GET() {
  // Get recent memories grouped by date for chart
  let dailyCounts: { date: string; count: number }[] = []
  try {
    const result = execSync('slm list --limit 500 --json 2>/dev/null || echo "[]"', { timeout: 15000 })
    const memories = JSON.parse(result.toString())
    if (Array.isArray(memories)) {
      const byDate: Record<string, number> = {}
      for (const m of memories) {
        const ts = m.timestamp || m.created_at || m.date
        if (ts) {
          const date = new Date(ts).toISOString().slice(0, 10)
          byDate[date] = (byDate[date] || 0) + 1
        }
      }
      dailyCounts = Object.entries(byDate)
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-30) // Last 30 days
    }
  } catch { /* ignore */ }

  return NextResponse.json({ dailyCounts })
}
