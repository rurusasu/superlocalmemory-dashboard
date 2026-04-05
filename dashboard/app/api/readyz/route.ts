import { NextResponse } from 'next/server'
import fs from 'fs'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const log = logger.child({ route: '/api/readyz' })

export async function GET() {
  const slmHome = process.env.SLM_DATA_DIR || '/data'
  const ollamaHost = process.env.OLLAMA_HOST || 'http://ollama:11434'

  const checks: Record<string, { ok: boolean; detail?: string }> = {}

  // Check database accessibility
  const dbPath = `${slmHome}/.superlocalmemory/memory.db`
  try {
    fs.accessSync(dbPath, fs.constants.R_OK)
    checks.database = { ok: true }
  } catch {
    checks.database = { ok: false, detail: 'memory.db not accessible' }
  }

  // Check Ollama connectivity
  try {
    const resp = await fetch(`${ollamaHost}/api/tags`, { signal: AbortSignal.timeout(2000) })
    checks.ollama = resp.ok ? { ok: true } : { ok: false, detail: `status ${resp.status}` }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'unknown error'
    checks.ollama = { ok: false, detail: message }
  }

  const allOk = Object.values(checks).every((c) => c.ok)
  const status = allOk ? 200 : 503

  if (!allOk) {
    log.warn({ checks }, 'readiness check failed')
  }

  return NextResponse.json({ status: allOk ? 'ready' : 'not_ready', checks }, { status })
}
