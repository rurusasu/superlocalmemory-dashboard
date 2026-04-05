import { NextResponse } from 'next/server'
import { execFileSync } from 'child_process'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const MAX_QUERY_LENGTH = 200
const MAX_LIMIT = 1000

function sanitizeQuery(raw: string): string {
  // eslint-disable-next-line no-control-regex
  return raw.replace(/[\x00-\x1f\x7f]/g, '').slice(0, MAX_QUERY_LENGTH)
}

function parseLimit(raw: string | null): number {
  const n = parseInt(raw || '50', 10)
  if (!Number.isFinite(n) || n < 1) return 50
  return Math.min(n, MAX_LIMIT)
}

function parseOffset(raw: string | null): number {
  const n = parseInt(raw || '0', 10)
  if (!Number.isFinite(n) || n < 0) return 0
  return n
}

export async function GET(request: Request) {
  const start = Date.now()
  const { searchParams } = new URL(request.url)
  const rawQuery = searchParams.get('q') || ''
  const query = sanitizeQuery(rawQuery)
  const limit = parseLimit(searchParams.get('limit'))
  const offset = parseOffset(searchParams.get('offset'))

  const log = logger.child({ route: '/api/conversations', method: 'GET', query, limit, offset })

  try {
    // Fetch limit+offset+1 to determine hasMore without a separate count query
    const fetchLimit = offset + limit + 1
    const args = query
      ? ['search', query, '--limit', String(fetchLimit), '--json']
      : ['list', '--limit', String(fetchLimit), '--json']
    const result = execFileSync('slm', args, { timeout: 10000 }).toString()

    let allConversations: unknown[]
    try {
      allConversations = JSON.parse(result)
    } catch (parseErr: unknown) {
      const message = parseErr instanceof Error ? parseErr.message : 'unknown error'
      log.error(
        { err: message, rawSample: result.slice(0, 200) },
        'JSON parse error from slm output',
      )
      return NextResponse.json(
        {
          error: 'Invalid response from slm',
          conversations: [],
          count: 0,
          total: 0,
          offset,
          limit,
          hasMore: false,
        },
        { status: 500 },
      )
    }

    const total =
      allConversations.length > offset + limit
        ? allConversations.length - 1
        : allConversations.length
    const conversations = allConversations.slice(offset, offset + limit)
    const hasMore = allConversations.length > offset + limit

    log.info(
      { duration: Date.now() - start, count: conversations.length, total, status: 200 },
      'request completed',
    )
    return NextResponse.json({
      conversations,
      count: conversations.length,
      total,
      offset,
      limit,
      hasMore,
    })
  } catch (err: unknown) {
    const e = err instanceof Error ? err : new Error('unknown')
    const stderr = (err as { stderr?: Buffer })?.stderr?.toString().slice(0, 500)
    log.error(
      { err: e.message, stderr, duration: Date.now() - start, status: 500 },
      'slm command failed',
    )
    return NextResponse.json(
      { error: e.message, conversations: [], count: 0, total: 0, offset, limit, hasMore: false },
      { status: 500 },
    )
  }
}
