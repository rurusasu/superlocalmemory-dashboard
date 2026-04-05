'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'

const BarChart = dynamic(() => import('recharts').then(m => m.BarChart), { ssr: false })
const Bar = dynamic(() => import('recharts').then(m => m.Bar), { ssr: false })
const XAxis = dynamic(() => import('recharts').then(m => m.XAxis), { ssr: false })
const YAxis = dynamic(() => import('recharts').then(m => m.YAxis), { ssr: false })
const Tooltip = dynamic(() => import('recharts').then(m => m.Tooltip), { ssr: false })
const ResponsiveContainer = dynamic(() => import('recharts').then(m => m.ResponsiveContainer), { ssr: false })

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

export default function DashboardPage() {
  const [health, setHealth] = useState<HealthData | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [dailyCounts, setDailyCounts] = useState<DailyCount[]>([])

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const res = await fetch('/dashboard/api/health')
        setHealth(await res.json())
      } catch { /* ignore */ }
    }
    fetchHealth()
    const interval = setInterval(fetchHealth, 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    fetch('/dashboard/api/stats')
      .then(r => r.json())
      .then(d => setDailyCounts(d.dailyCounts || []))
      .catch(() => {})
  }, [])

  const fetchConversations = async (q?: string) => {
    try {
      const url = q ? `/dashboard/api/conversations?q=${encodeURIComponent(q)}` : '/dashboard/api/conversations'
      const res = await fetch(url)
      const data = await res.json()
      const convs = Array.isArray(data.conversations) ? data.conversations : []
      setConversations(convs)
    } catch { /* ignore */ }
  }

  useEffect(() => { fetchConversations() }, [])

  const statusColor = (val: string, good: string) =>
    val === good ? 'bg-green-900/50 border-green-700' : 'bg-yellow-900/50 border-yellow-700'

  return (
    <main className="min-h-screen p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">SLM Dashboard</h1>
        <div className="text-sm text-gray-500">
          {health?.profile && <span className="mr-4">Profile: <span className="text-gray-300">{health.profile}</span></span>}
          {health?.mode && <span>Mode: <span className="text-gray-300">{health.mode.toUpperCase()}</span></span>}
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

      {/* Daily Memories Chart */}
      {dailyCounts.length > 0 && (
        <section className="mb-8 bg-gray-800/50 border border-gray-700 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Memories per Day (Last 30 days)</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={dailyCounts}>
              <XAxis dataKey="date" tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={(v: string) => v.slice(5)} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                labelStyle={{ color: '#9ca3af' }}
              />
              <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </section>
      )}

      {/* Search */}
      <section className="mb-8">
        <div className="flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchConversations(searchQuery)}
            placeholder="Search conversations..."
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-gray-100 focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={() => fetchConversations(searchQuery)}
            className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-lg transition-colors"
          >
            Search
          </button>
        </div>
      </section>

      {/* Conversations List */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Recent Conversations ({conversations.length})</h2>
        <div className="space-y-2">
          {conversations.length === 0 && (
            <div className="text-gray-500 text-sm py-4">No conversations found.</div>
          )}
          {conversations.map((conv, i) => (
            <div key={conv.id || i} className="bg-gray-800/50 border border-gray-700 p-4 rounded-lg">
              <div className="flex justify-between text-sm text-gray-400 mb-1">
                <span>{conv.source}</span>
                <span>{conv.timestamp}</span>
              </div>
              <div className="text-gray-200 line-clamp-2">{conv.content}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Last updated */}
      <div className="mt-8 text-xs text-gray-600 text-center">
        Last updated: {health?.timestamp ? new Date(health.timestamp).toLocaleString('ja-JP') : '...'}
      </div>
    </main>
  )
}
