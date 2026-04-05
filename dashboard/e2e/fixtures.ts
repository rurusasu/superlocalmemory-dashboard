export const healthData = {
  status: 'healthy',
  ollama: 'connected',
  database: 'ok',
  diskUsage: '1.2 GB',
  factCount: 42,
  entityCount: 15,
  mode: 'b',
  profile: 'default',
  dbSize: '50 MB',
  timestamp: '2026-04-05T12:00:00Z',
}

export const degradedHealthData = {
  ...healthData,
  status: 'degraded',
  ollama: 'disconnected',
}

export const conversationsData = {
  conversations: Array.from({ length: 50 }, (_, i) => ({
    id: `conv-${i + 1}`,
    content: `Conversation content number ${i + 1} for testing purposes.`,
    source: i % 3 === 0 ? 'claude' : i % 3 === 1 ? 'slack' : 'web',
    timestamp: `2026-04-${String(5 - Math.floor(i / 10)).padStart(2, '0')}T${String(10 + (i % 10)).padStart(2, '0')}:00:00Z`,
  })),
  hasMore: true,
  total: 120,
}

export const page2ConversationsData = {
  conversations: Array.from({ length: 50 }, (_, i) => ({
    id: `conv-${i + 51}`,
    content: `Page 2 conversation content number ${i + 51}.`,
    source: i % 2 === 0 ? 'claude' : 'slack',
    timestamp: `2026-04-03T${String(10 + (i % 10)).padStart(2, '0')}:00:00Z`,
  })),
  hasMore: true,
  total: 120,
}

export const searchResultsData = {
  conversations: [
    {
      id: 'search-1',
      content: 'Found: matching search result content.',
      source: 'claude',
      timestamp: '2026-04-05T12:00:00Z',
    },
  ],
  hasMore: false,
  total: 1,
}

export const statsData = {
  dailyCounts: Array.from({ length: 30 }, (_, i) => ({
    date: `2026-03-${String(7 + i).padStart(2, '0')}`,
    count: Math.floor(Math.random() * 20) + 1,
  })),
  sourceCounts: {
    claude: 45,
    slack: 30,
    web: 25,
  },
}
