'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import Sidebar from './components/Sidebar'
import { useLocale } from './i18n/LocaleContext'

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
  const { locale, t } = useLocale()
  const [health, setHealth] = useState<HealthData | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [dailyCounts, setDailyCounts] = useState<DailyCount[]>([])
  const [sourceCounts, setSourceCounts] = useState<{ name: string; value: number }[]>([])
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [total, setTotal] = useState(0)
  const [sourceFilter, setSourceFilter] = useState<string>('')
  const [activeSection, setActiveSection] = useState('dashboard')
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

  const handleNavigate = (id: string) => {
    setActiveSection(id)
  }

  const currentPage = Math.floor(offset / limit) + 1
  const filteredConversations = sourceFilter
    ? conversations.filter((c) => c.source === sourceFilter)
    : conversations

  const statusColor = (val: string, good: string) =>
    val === good
      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
      : 'bg-amber-500/10 border-amber-500/30 text-amber-400'

  const statusDot = (val: string, good: string) =>
    val === good ? 'bg-emerald-400' : 'bg-amber-400'

  const tv = (val: string) => t(`value.${val}`) || val

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar activeSection={activeSection} onNavigate={handleNavigate} health={health} />

      <main className="flex-1 overflow-y-auto">
        {/* Header */}
        <header className="sticky top-0 z-10 bg-gray-950/80 backdrop-blur-md border-b border-gray-800">
          <div className="flex items-center justify-between px-8 h-14">
            <h1 className="text-lg font-semibold">SLM Dashboard</h1>
            <div className="flex items-center gap-4 text-sm text-gray-500">
              {health?.profile && (
                <span>
                  {t('header.profile')}: <span className="text-gray-300">{health.profile}</span>
                </span>
              )}
              {health?.mode && (
                <span className="px-2 py-0.5 rounded bg-gray-800 text-gray-300 text-xs font-medium">
                  {health.mode.toUpperCase()}
                </span>
              )}
              {health?.timestamp && (
                <span className="text-xs text-gray-600">
                  {new Date(health.timestamp).toLocaleString(locale === 'ja' ? 'ja-JP' : 'en-US')}
                </span>
              )}
            </div>
          </div>
        </header>

        <div className="p-8 max-w-7xl mx-auto space-y-6">
          {/* Dashboard Tab: Health Cards + Charts */}
          {activeSection === 'dashboard' && (
            <>
              <section
                id="section-health"
                className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3"
              >
                <div
                  className={`p-4 rounded-xl border ${statusColor(health?.status || '', 'healthy')}`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className={`w-2 h-2 rounded-full ${statusDot(health?.status || '', 'healthy')} animate-pulse`}
                    />
                    <span className="text-xs text-gray-400 uppercase tracking-wider">
                      {t('health.status')}
                    </span>
                  </div>
                  <div className="text-lg font-semibold text-gray-100">
                    {health?.status ? tv(health.status) : '...'}
                  </div>
                </div>

                <div
                  className={`p-4 rounded-xl border ${statusColor(health?.ollama || '', 'connected')}`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className={`w-2 h-2 rounded-full ${statusDot(health?.ollama || '', 'connected')} animate-pulse`}
                    />
                    <span className="text-xs text-gray-400 uppercase tracking-wider">
                      {t('health.ollama')}
                    </span>
                  </div>
                  <div className="text-lg font-semibold text-gray-100">
                    {health?.ollama ? tv(health.ollama) : '...'}
                  </div>
                </div>

                <div
                  className={`p-4 rounded-xl border ${statusColor(health?.database || '', 'ok')}`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className={`w-2 h-2 rounded-full ${statusDot(health?.database || '', 'ok')} animate-pulse`}
                    />
                    <span className="text-xs text-gray-400 uppercase tracking-wider">
                      {t('health.database')}
                    </span>
                  </div>
                  <div className="text-lg font-semibold text-gray-100">
                    {health?.database ? tv(health.database) : '...'}
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-gray-800 bg-gray-900/50">
                  <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">
                    {t('health.facts')}
                  </div>
                  <div className="text-2xl font-bold text-gray-100">
                    {health?.factCount ?? '...'}
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-gray-800 bg-gray-900/50">
                  <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">
                    {t('health.entities')}
                  </div>
                  <div className="text-2xl font-bold text-gray-100">
                    {health?.entityCount ?? '...'}
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-gray-800 bg-gray-900/50">
                  <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">
                    {t('health.disk')}
                  </div>
                  <div className="text-lg font-semibold text-gray-100">
                    {health?.diskUsage || '...'}
                  </div>
                </div>
              </section>

              {/* Charts Row */}
              <section id="section-dashboard" className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {dailyCounts.length > 0 && (
                  <div className="lg:col-span-2 bg-gray-900/50 border border-gray-800 rounded-xl p-6">
                    <h2 className="text-sm font-medium text-gray-300 mb-4">
                      {t('chart.memoriesPerDay')}
                      <span className="text-gray-600 ml-2 font-normal">
                        {t('chart.last30days')}
                      </span>
                    </h2>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={dailyCounts}>
                        <XAxis
                          dataKey="date"
                          tick={{ fill: '#6b7280', fontSize: 11 }}
                          tickFormatter={(v: string) => v.slice(5)}
                          axisLine={{ stroke: '#1f2937' }}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fill: '#6b7280', fontSize: 11 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#111827',
                            border: '1px solid #1f2937',
                            borderRadius: '10px',
                            boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
                          }}
                          labelStyle={{ color: '#9ca3af' }}
                          cursor={{ fill: 'rgba(59, 130, 246, 0.08)' }}
                        />
                        <Bar dataKey="count" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {sourceCounts.length > 0 && (
                  <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
                    <h2 className="text-sm font-medium text-gray-300 mb-4">
                      {t('chart.sourceBreakdown')}
                    </h2>
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie
                          data={sourceCounts}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={70}
                          innerRadius={40}
                          strokeWidth={0}
                          label={({ name, percent }: { name?: string; percent?: number }) =>
                            `${name ?? ''} (${((percent ?? 0) * 100).toFixed(0)}%)`
                          }
                        >
                          {sourceCounts.map((_, i) => (
                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#111827',
                            border: '1px solid #1f2937',
                            borderRadius: '10px',
                            boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </section>
            </>
          )}

          {/* Conversations Tab: Search + List */}
          {activeSection === 'conversations' && (
            <>
              {/* Search & Filter */}
              <section
                id="section-conversations"
                className="bg-gray-900/50 border border-gray-800 rounded-xl p-6"
              >
                <h2 className="text-sm font-medium text-gray-300 mb-4">{t('search.title')}</h2>
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <svg
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                      />
                    </svg>
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
                      placeholder={t('search.placeholder')}
                      className="w-full bg-gray-800/60 border border-gray-700 rounded-lg pl-10 pr-4 py-2.5 text-gray-100 text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-colors"
                    />
                  </div>
                  {sourceCounts.length > 0 && (
                    <select
                      value={sourceFilter}
                      onChange={(e) => setSourceFilter(e.target.value)}
                      className="bg-gray-800/60 border border-gray-700 rounded-lg px-3 py-2.5 text-gray-300 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                    >
                      <option value="">{t('search.allSources')}</option>
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
                    className="bg-blue-600 hover:bg-blue-500 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
                  >
                    {t('search.button')}
                  </button>
                </div>
              </section>

              {/* Conversations List */}
              <section className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-medium text-gray-300">
                    {t('conversations.title')}
                    {total > 0 && (
                      <span className="ml-2 text-gray-600 font-normal">
                        {offset + 1}-{offset + filteredConversations.length} of {total}+
                      </span>
                    )}
                  </h2>
                  {total > 0 && (
                    <span className="text-xs text-gray-600">
                      {t('conversations.page')} {currentPage}
                    </span>
                  )}
                </div>

                <div className="space-y-2">
                  {filteredConversations.length === 0 && (
                    <div className="text-gray-600 text-sm py-8 text-center">
                      {t('conversations.empty')}
                    </div>
                  )}
                  {filteredConversations.map((conv, i) => (
                    <div
                      key={conv.id || i}
                      className="bg-gray-800/40 border border-gray-800 hover:border-gray-700 p-4 rounded-lg transition-colors group"
                    >
                      <div className="flex items-center justify-between text-sm text-gray-500 mb-2">
                        <span className="px-2 py-0.5 bg-blue-600/15 text-blue-400 rounded text-xs font-medium">
                          {conv.source}
                        </span>
                        <span className="text-xs">{conv.timestamp}</span>
                      </div>
                      <div className="text-gray-300 text-sm leading-relaxed line-clamp-2">
                        {conv.content}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                {(offset > 0 || hasMore) && (
                  <div className="flex items-center justify-center gap-3 mt-6 pt-4 border-t border-gray-800">
                    <button
                      onClick={() => fetchConversations(searchQuery, Math.max(0, offset - limit))}
                      disabled={offset === 0}
                      className="px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg text-sm transition-colors"
                    >
                      {t('conversations.previous')}
                    </button>
                    <span className="text-xs text-gray-500 min-w-[60px] text-center">
                      {t('conversations.page')} {currentPage}
                    </span>
                    <button
                      onClick={() => fetchConversations(searchQuery, offset + limit)}
                      disabled={!hasMore}
                      className="px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg text-sm transition-colors"
                    >
                      {t('conversations.next')}
                    </button>
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
