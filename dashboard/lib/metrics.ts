import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client'

export const register = new Registry()

collectDefaultMetrics({ register })

export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'path', 'status'] as const,
  registers: [register],
})

export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'path'] as const,
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
})

export const ollamaConnectionStatus = new Gauge({
  name: 'ollama_connection_status',
  help: 'Ollama connection status (1=connected, 0=disconnected)',
  registers: [register],
})

export const databaseStatus = new Gauge({
  name: 'database_status',
  help: 'Database existence status (1=ok, 0=missing)',
  registers: [register],
})

export const slmConversationsTotal = new Gauge({
  name: 'slm_conversations_total',
  help: 'Total number of conversations',
  registers: [register],
})
