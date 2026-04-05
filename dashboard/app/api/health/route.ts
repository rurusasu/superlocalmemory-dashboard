import { NextResponse } from 'next/server'
import { execSync } from 'child_process'
import fs from 'fs'

export const dynamic = 'force-dynamic'

export async function GET() {
  const slmHome = process.env.SLM_DATA_DIR || '/data'
  const ollamaHost = process.env.OLLAMA_HOST || 'http://ollama:11434'

  let diskUsage = 'unknown'
  try {
    const stat = execSync(`du -sh ${slmHome}/.superlocalmemory 2>/dev/null || echo "0\\t-"`)
    diskUsage = stat.toString().split('\t')[0].trim()
  } catch { /* ignore */ }

  let ollamaStatus = 'disconnected'
  try {
    const resp = await fetch(`${ollamaHost}/api/tags`, { signal: AbortSignal.timeout(3000) })
    ollamaStatus = resp.ok ? 'connected' : 'error'
  } catch { /* ignore */ }

  const dbPath = `${slmHome}/.superlocalmemory/memory.db`
  const dbExists = fs.existsSync(dbPath)

  // Get SLM status via CLI
  let slmStatus: Record<string, unknown> = {}
  try {
    const result = execSync('slm status --json 2>/dev/null || echo "{}"', { timeout: 10000 })
    slmStatus = JSON.parse(result.toString())
  } catch { /* ignore */ }

  return NextResponse.json({
    status: dbExists && ollamaStatus === 'connected' ? 'healthy' : 'degraded',
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
