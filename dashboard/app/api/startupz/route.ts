import { NextResponse } from 'next/server'
import fs from 'fs'

export const dynamic = 'force-dynamic'

export async function GET() {
  const slmHome = process.env.SLM_DATA_DIR || '/data'
  const dbPath = `${slmHome}/.superlocalmemory/memory.db`
  const configPath = `${slmHome}/.superlocalmemory/config.json`

  const dbExists = fs.existsSync(dbPath)
  const configExists = fs.existsSync(configPath)
  const started = dbExists && configExists

  return NextResponse.json(
    { status: started ? 'started' : 'starting' },
    { status: started ? 200 : 503 },
  )
}
