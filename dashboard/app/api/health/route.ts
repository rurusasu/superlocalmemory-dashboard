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

  return NextResponse.json({
    status: dbExists && ollamaStatus === 'connected' ? 'healthy' : 'degraded',
    ollama: ollamaStatus,
    database: dbExists ? 'ok' : 'missing',
    diskUsage,
    timestamp: new Date().toISOString(),
  })
}
