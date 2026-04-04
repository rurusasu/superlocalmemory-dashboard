'use client'

import { useEffect, useState } from 'react'

interface HealthData {
  status: string
  ollama: string
  database: string
  diskUsage: string
  timestamp: string
}

interface Conversation {
  id: string
  content: string
  source: string
  timestamp: string
}

export default function DashboardPage() {
  const [health, setHealth] = useState<HealthData | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    const fetchHealth = async () => {
      const res = await fetch('/dashboard/api/health')
      setHealth(await res.json())
    }
    fetchHealth()
    const interval = setInterval(fetchHealth, 30000)
    return () => clearInterval(interval)
  }, [])

  const fetchConversations = async (q?: string) => {
    const url = q ? `/dashboard/api/conversations?q=${encodeURIComponent(q)}` : '/dashboard/api/conversations'
    const res = await fetch(url)
    const data = await res.json()
    setConversations(data.conversations || [])
  }

  useEffect(() => { fetchConversations() }, [])

  return (
    <main className="min-h-screen p-8">
      <h1 className="text-2xl font-bold mb-8">SLM Dashboard</h1>

      <section className="mb-8 grid grid-cols-4 gap-4">
        <div className={`p-4 rounded-lg ${health?.status === 'healthy' ? 'bg-green-900/50' : 'bg-yellow-900/50'}`}>
          <div className="text-sm text-gray-400">Status</div>
          <div className="text-lg font-semibold">{health?.status || 'loading...'}</div>
        </div>
        <div className={`p-4 rounded-lg ${health?.ollama === 'connected' ? 'bg-green-900/50' : 'bg-red-900/50'}`}>
          <div className="text-sm text-gray-400">Ollama</div>
          <div className="text-lg font-semibold">{health?.ollama || 'loading...'}</div>
        </div>
        <div className="p-4 rounded-lg bg-gray-800">
          <div className="text-sm text-gray-400">Database</div>
          <div className="text-lg font-semibold">{health?.database || 'loading...'}</div>
        </div>
        <div className="p-4 rounded-lg bg-gray-800">
          <div className="text-sm text-gray-400">Disk Usage</div>
          <div className="text-lg font-semibold">{health?.diskUsage || 'loading...'}</div>
        </div>
      </section>

      <section className="mb-8">
        <div className="flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchConversations(searchQuery)}
            placeholder="Search conversations..."
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-gray-100"
          />
          <button
            onClick={() => fetchConversations(searchQuery)}
            className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-lg"
          >
            Search
          </button>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-4">Recent Conversations ({conversations.length})</h2>
        <div className="space-y-2">
          {conversations.map((conv, i) => (
            <div key={conv.id || i} className="bg-gray-800 p-4 rounded-lg">
              <div className="flex justify-between text-sm text-gray-400 mb-1">
                <span>{conv.source}</span>
                <span>{conv.timestamp}</span>
              </div>
              <div className="text-gray-200 line-clamp-2">{conv.content}</div>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
