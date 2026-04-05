import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockExecSync } = vi.hoisted(() => ({
  mockExecSync: vi.fn(),
}))

vi.mock('child_process', () => ({
  default: { execSync: mockExecSync },
  execSync: mockExecSync,
}))

import { GET } from '@/app/api/conversations/route'

beforeEach(() => {
  vi.resetAllMocks()
})

function makeRequest(params: Record<string, string> = {}): Request {
  const url = new URL('http://localhost:3000/api/conversations')
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }
  return new Request(url.toString())
}

describe('GET /api/conversations', () => {
  it('returns conversations from slm list when no query', async () => {
    const mockData = [
      { id: '1', content: 'hello', source: 'test', timestamp: '2024-01-01' },
    ]
    mockExecSync.mockReturnValue(Buffer.from(JSON.stringify(mockData)))

    const response = await GET(makeRequest())
    const data = await response.json()

    expect(data.conversations).toEqual(mockData)
    expect(data.count).toBe(1)
    expect(mockExecSync).toHaveBeenCalledWith(
      'slm list --limit 50 --json',
      { timeout: 10000 }
    )
  })

  it('uses slm search when query is provided', async () => {
    mockExecSync.mockReturnValue(Buffer.from('[]'))

    await GET(makeRequest({ q: 'test query' }))

    expect(mockExecSync).toHaveBeenCalledWith(
      'slm search "test query" --limit 50 --json',
      { timeout: 10000 }
    )
  })

  it('respects limit parameter', async () => {
    mockExecSync.mockReturnValue(Buffer.from('[]'))

    await GET(makeRequest({ limit: '10' }))

    expect(mockExecSync).toHaveBeenCalledWith(
      'slm list --limit 10 --json',
      { timeout: 10000 }
    )
  })

  it('returns 500 when execSync throws', async () => {
    mockExecSync.mockImplementation(() => {
      throw new Error('slm not found')
    })

    const response = await GET(makeRequest())
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBe('slm not found')
    expect(data.conversations).toEqual([])
    expect(data.count).toBe(0)
  })

  it('returns 500 when slm returns invalid JSON', async () => {
    mockExecSync.mockReturnValue(Buffer.from('not json'))

    const response = await GET(makeRequest())

    expect(response.status).toBe(500)
  })

  it('escapes double quotes in query', async () => {
    mockExecSync.mockReturnValue(Buffer.from('[]'))

    await GET(makeRequest({ q: 'test "quoted"' }))

    expect(mockExecSync).toHaveBeenCalledWith(
      expect.stringContaining('\\"quoted\\"'),
      { timeout: 10000 }
    )
  })
})
