import { NextResponse } from 'next/server'
import { execSync } from 'child_process'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q') || ''
  const limit = parseInt(searchParams.get('limit') || '50', 10)

  try {
    const cmd = query
      ? `slm search "${query.replace(/"/g, '\\"')}" --limit ${limit} --json`
      : `slm list --limit ${limit} --json`
    const result = execSync(cmd, { timeout: 10000 }).toString()
    const conversations = JSON.parse(result)
    return NextResponse.json({ conversations, count: conversations.length })
  } catch (err: any) {
    return NextResponse.json({ error: err.message, conversations: [], count: 0 }, { status: 500 })
  }
}
