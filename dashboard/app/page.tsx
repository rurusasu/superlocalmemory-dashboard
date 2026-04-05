'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'

const BarChart = dynamic(() => import('recharts').then((m) => m.BarChart), { ssr: false })
const Bar = dynamic(() => import('recharts').then((m) => m.Bar), { ssr: false })
const XAxis = dynamic(() => import('recharts').then((m) => m.XAxis), { ssr: false })
const YAxis = dynamic(() => import('recharts').then((m) => m.YAxis), { ssr: false })
const Tooltip = dynamic(() => import('recharts').then((m) => m.Tooltip), { ssr: false })
const ResponsiveContainer = dynamic(() => import('recharts').then((m) => m.ResponsiveContainer), {
  ssr: false,
})
const PieChart = dynamic(() => import('recharts').then((m) => m.PieChart), { ssr: false })
const Pie = dynamic(() => import('recharts').then((m) => m.Pie), { ssr: false })
const Cell = dynamic(() => import('recharts').then((m) => m.Cell), { ssr: false })

interface HealthData {
  status: string
  ollama: string
  database: string
  diskUsage: string
  factCount: number
  entityCount: number
  mode: string
  profile: string
  dbSize: string
  timestamp: string
}

interface Conversation {
  id: string
  content: string
  source: string
  timestamp: string
}

interface DailyCount {
  date: string
  count: number
}

const BASE_POLL_INTERVAL = 30_000
const MAX_POLL_INTERVAL = 120_000
const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

export default function DashboardPage() {
  const [health, setHealth] = useState<HealthData | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [dailyCounts, setDailyCounts] = useState<DailyCount[]>([])
  const [sourceCounts, setSourceCounts] = useState<{ name: string; value: number }[]>([])
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [total, setTotal] = useState(0)
  const [sourceFilter, setSourceFilter] = useState<string>('')
  const limit = 50
  const pollInterval = useRef(BASE_POLL_INTERVAL)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>

    const fetchHealth = async () => {
      if (document.visibilityState === 'hidden') {
        timer = setTimeout(fetchHealth, pollInterval.current)
        return
      }
      try {
        const res = await fetch('/dashboard/api/health')
        setHealth(await res.json())
        pollInterval.current = BASE_POLL_INTERVAL
      } catch {
        pollInterval.current = Math.min(pollInterval.current * 2, MAX_POLL_INTERVAL)
      }
      timer = setTimeout(fetchHealth, pollInterval.current)
    }

    fetchHealth()
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    fetch('/dashboard/api/stats')
      .then((r) => r.json())
      .then((d) => {
        setDailyCounts(d.dailyCounts || [])
        if (d.sourceCounts) {
          const entries = Object.entries(d.sourceCounts as Record<string, number>)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
          setSourceCounts(entries)
        }
      })
      .catch(() => {})
  }, [])

  const fetchConversations = useCallback(async (q?: string, newOffset = 0) => {
    try {
      const params = new URLSearchParams({ limit: String(limit), offset: String(newOffset) })
      if (q) params.set('q', q)
      const res = await fetch(`/dashboard/api/conversations?${params}`)
      const data = await res.json()
      const convs = Array.isArray(data.conversations) ? data.conversations : []
      setConversations(convs)
      setOffset(newOffset)
      setHasMore(data.hasMore ?? false)
      setTotal(data.total ?? convs.length)
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    fetchConversations()
  }, [fetchConversations])

  const currentPage = Math.floor(offset / limit) + 1
  const filteredConversations = sourceFilter
    ? conversations.filter((c) => c.source === sourceFilter)
    : conversations

  const statusColor = (val: string, good: string) =>
    val === good ? 'bg-green-900/50 border-green-700' : 'bg-yellow-900/50 border-yellow-700'

  return (
    <main className="min-h-screen p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">SLM Dashboard</h1>
        <div className="text-sm text-gray-500">
          {health?.profile && (
            <span className="mr-4">
              Profile: <span className="text-gray-300">{health.profile}</span>
            </span>
          )}
          {health?.mode && (
            <span>
              Mode: <span className="text-gray-300">{health.mode.toUpperCase()}</span>
            </span>
          )}
        </div>
      </div>

      {/* Health Status Cards */}
      <section className="mb-8 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <div className={`p-4 rounded-lg border ${statusColor(health?.status || '', 'healthy')}`}>
          <div className="text-xs text-gray-400 uppercase tracking-wide">Status</div>
          <div className="text-lg font-semibold mt-1">{health?.status || '...'}</div>
        </div>
        <div className={`p-4 rounded-lg border ${statusColor(health?.ollama || '', 'connected')}`}>
          <div className="text-xs text-gray-400 uppercase tracking-wide">Ollama</div>
          <div className="text-lg font-semibold mt-1">{health?.ollama || '...'}</div>
        </div>
        <div className={`p-4 rounded-lg border ${statusColor(health?.database || '', 'ok')}`}>
          <div className="text-xs text-gray-400 uppercase tracking-wide">Database</div>
          <div className="text-lg font-semibold mt-1">{health?.database || '...'}</div>
        </div>
        <div className="p-4 rounded-lg border border-gray-700 bg-gray-800/50">
          <div className="text-xs text-gray-400 uppercase tracking-wide">Facts</div>
          <div className="text-lg font-semibold mt-1">{health?.factCount ?? '...'}</div>
        </div>
        <div className="p-4 rounded-lg border border-gray-700 bg-gray-800/50">
          <div className="text-xs text-gray-400 uppercase tracking-wide">Entities</div>
          <div className="text-lg font-semibold mt-1">{health?.entityCount ?? '...'}</div>
        </div>
        <div className="p-4 rounded-lg border border-gray-700 bg-gray-800/50">
          <div className="text-xs text-gray-400 uppercase tracking-wide">Disk</div>
          <div className="text-lg font-semibold mt-1">{health?.diskUsage || '...'}</div>
        </div>
      </section>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
        {/* Daily Memories Chart */}
        {dailyCounts.length > 0 && (
          <section className="lg:col-span-2 bg-gray-800/50 border border-gray-700 rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Memories per Day (Last 30 days)</h2>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={dailyCounts}>
                <XAxis
                  dataKey="date"
                  tick={{ fill: '#9ca3af', fontSize: 11 }}
                  tickFormatter={(v: string) => v.slice(5)}
                />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1f2937',
                    border: '1px solid #374151',
                    borderRadius: '8px',
                  }}
                  labelStyle={{ color: '#9ca3af' }}
                />
                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </section>
        )}

        {/* Source Breakdown */}
        {sourceCounts.length > 0 && (
          <section className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Source Breakdown</h2>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={sourceCounts}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={70}
                  label={({ name, percent }: { name: string; percent: number }) =>
                    `${name} (${(percent * 100).toFixed(0)}%)`
                  }
                >
                  {sourceCounts.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1f2937',
                    border: '1px solid #374151',
                    borderRadius: '8px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </section>
        )}
      </div>

      {/* Search & Filter */}
      <section className="mb-8">
        <div className="flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setOffset(0)
                fetchConversations(searchQuery, 0)
              }
            }}
            placeholder="Search conversations..."
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-gray-100 focus:outline-none focus:border-blue-500"
          />
          {sourceCounts.length > 0 && (
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-100 focus:outline-none focus:border-blue-500"
            >
              <option value="">All sources</option>
              {sourceCounts.map((s) => (
                <option key={s.name} value={s.name}>
                  {s.name} ({s.value})
                </option>
              ))}
            </select>
          )}
          <button
            onClick={() => {
              setOffset(0)
              fetchConversations(searchQuery, 0)
            }}
            className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-lg transition-colors"
          >
            Search
          </button>
        </div>
      </section>

      {/* Conversations List */}
      <section>
        <h2 className="text-lg font-semibold mb-4">
          Conversations (
          {total > 0
            ? `${offset + 1}-${offset + filteredConversations.length} of ${total}+`
            : filteredConversations.length}
          )
        </h2>
        <div className="space-y-2">
          {filteredConversations.length === 0 && (
            <div className="text-gray-500 text-sm py-4">No conversations found.</div>
          )}
          {filteredConversations.map((conv, i) => (
            <div
              key={conv.id || i}
              className="bg-gray-800/50 border border-gray-700 p-4 rounded-lg"
            >
              <div className="flex justify-between text-sm text-gray-400 mb-1">
                <span className="px-2 py-0.5 bg-gray-700 rounded text-xs">{conv.source}</span>
                <span>{conv.timestamp}</span>
              </div>
              <div className="text-gray-200 line-clamp-2">{conv.content}</div>
            </div>
          ))}
        </div>

        {/* Pagination */}
        {(offset > 0 || hasMore) && (
          <div className="flex items-center justify-center gap-4 mt-4">
            <button
              onClick={() => fetchConversations(searchQuery, Math.max(0, offset - limit))}
              disabled={offset === 0}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              Previous
            </button>
            <span className="text-sm text-gray-400">Page {currentPage}</span>
            <button
              onClick={() => fetchConversations(searchQuery, offset + limit)}
              disabled={!hasMore}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              Next
            </button>
          </div>
        )}
      </section>

      {/* Last updated */}
      <div className="mt-8 text-xs text-gray-600 text-center">
        Last updated:{' '}
        {health?.timestamp ? new Date(health.timestamp).toLocaleString('ja-JP') : '...'}
      </div>
    </main>
  )
}
