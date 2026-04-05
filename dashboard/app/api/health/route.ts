import { NextResponse } from 'next/server'
import { execFileSync } from 'child_process'
import fs from 'fs'
import { logger } from '@/lib/logger'
import { ollamaConnectionStatus, databaseStatus } from '@/lib/metrics'

export const dynamic = 'force-dynamic'

const log = logger.child({ route: '/api/health', method: 'GET' })

const DISK_CACHE_TTL = parseInt(process.env.HEALTH_CACHE_TTL || '60', 10) * 1000
const OLLAMA_CACHE_TTL = 10_000

interface CacheEntry<T> {
  value: T
  expiresAt: number
}

export let diskCache: CacheEntry<string> | null = null
export let ollamaCache: CacheEntry<string> | null = null

export function resetHealthCache() {
  diskCache = null
  ollamaCache = null
}

function getCached<T>(entry: CacheEntry<T> | null): T | null {
  if (entry && Date.now() < entry.expiresAt) return entry.value
  return null
}

export async function GET() {
  const start = Date.now()
  const slmHome = process.env.SLM_DATA_DIR || '/data'
  const ollamaHost = process.env.OLLAMA_HOST || 'http://ollama:11434'

  let diskUsage = getCached(diskCache) ?? 'unknown'
  if (!getCached(diskCache)) {
    try {
      const stat = execFileSync('du', ['-sh', `${slmHome}/.superlocalmemory`], { timeout: 5000 })
      diskUsage = stat.toString().split('\t')[0].trim()
      diskCache = { value: diskUsage, expiresAt: Date.now() + DISK_CACHE_TTL }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'unknown error'
      log.warn({ err: message }, 'du command failed for disk usage')
    }
  }

  let ollamaStatus = getCached(ollamaCache) ?? 'disconnected'
  if (!getCached(ollamaCache)) {
    try {
      const resp = await fetch(`${ollamaHost}/api/tags`, { signal: AbortSignal.timeout(3000) })
      ollamaStatus = resp.ok ? 'connected' : 'error'
      ollamaCache = { value: ollamaStatus, expiresAt: Date.now() + OLLAMA_CACHE_TTL }
    } catch (err: unknown) {
      const e = err instanceof Error ? err : new Error('unknown')
      const isTimeout = e.name === 'TimeoutError'
      const isConnectionRefused =
        (e as { cause?: { code?: string } }).cause?.code === 'ECONNREFUSED'
      if (isTimeout) {
        log.warn({ host: ollamaHost }, 'Ollama connection timed out')
      } else if (isConnectionRefused) {
        log.warn({ host: ollamaHost }, 'Ollama connection refused')
      } else {
        log.warn({ err: e.message, host: ollamaHost }, 'Ollama health check failed')
      }
    }
  }

  const dbPath = `${slmHome}/.superlocalmemory/memory.db`
  const dbExists = fs.existsSync(dbPath)

  let slmStatus: Record<string, unknown> = {}
  try {
    const result = execFileSync('slm', ['status', '--json'], { timeout: 10000 })
    slmStatus = JSON.parse(result.toString())
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'unknown error'
    log.warn({ err: message }, 'slm status command failed')
  }

  // Publish metrics
  ollamaConnectionStatus.set(ollamaStatus === 'connected' ? 1 : 0)
  databaseStatus.set(dbExists ? 1 : 0)

  const status = dbExists && ollamaStatus === 'connected' ? 'healthy' : 'degraded'
  log.info(
    { duration: Date.now() - start, status, ollama: ollamaStatus, db: dbExists ? 'ok' : 'missing' },
    'health check completed',
  )

  return NextResponse.json({
    status,
    ollama: ollamaStatus,
    database: dbExists ? 'ok' : 'missing',
    diskUsage,
    factCount: slmStatus.fact_count ?? slmStatus.factCount ?? 0,
    entityCount: slmStatus.entity_count ?? slmStatus.entityCount ?? 0,
    mode: slmStatus.mode ?? 'unknown',
    profile: slmStatus.active_profile ?? slmStatus.profile ?? 'unknown',
    dbSize: slmStatus.db_size ?? slmStatus.dbSize ?? 'unknown',
    timestamp: new Date().toISOString(),
  })
}
