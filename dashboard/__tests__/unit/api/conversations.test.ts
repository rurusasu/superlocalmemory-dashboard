/**
 * Unit tests for GET /api/conversations
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockExecFileSync } = vi.hoisted(() => ({
  mockExecFileSync: vi.fn(),
}))

vi.mock('child_process', () => ({
  default: { execFileSync: mockExecFileSync },
  execFileSync: mockExecFileSync,
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
    const mockData = [{ id: '1', content: 'hello', source: 'test', timestamp: '2024-01-01' }]
    mockExecFileSync.mockReturnValue(Buffer.from(JSON.stringify(mockData)))

    const response = await GET(makeRequest())
    const data = await response.json()

    expect(data.conversations).toEqual(mockData)
    expect(data.count).toBe(1)
    // Fetches offset(0) + limit(50) + 1 = 51
    expect(mockExecFileSync).toHaveBeenCalledWith('slm', ['list', '--limit', '51', '--json'], {
      timeout: 10000,
    })
  })

  it('uses slm search when query is provided', async () => {
    mockExecFileSync.mockReturnValue(Buffer.from('[]'))

    await GET(makeRequest({ q: 'test query' }))

    expect(mockExecFileSync).toHaveBeenCalledWith(
      'slm',
      ['search', 'test query', '--limit', '51', '--json'],
      { timeout: 10000 },
    )
  })

  it('respects limit parameter', async () => {
    mockExecFileSync.mockReturnValue(Buffer.from('[]'))

    await GET(makeRequest({ limit: '10' }))

    expect(mockExecFileSync).toHaveBeenCalledWith('slm', ['list', '--limit', '11', '--json'], {
      timeout: 10000,
    })
  })

  it('returns 500 when execFileSync throws', async () => {
    mockExecFileSync.mockImplementation(() => {
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
    mockExecFileSync.mockReturnValue(Buffer.from('not json'))

    const response = await GET(makeRequest())

    expect(response.status).toBe(500)
  })

  it('passes quotes as literal characters in args', async () => {
    mockExecFileSync.mockReturnValue(Buffer.from('[]'))

    await GET(makeRequest({ q: 'test "quoted"' }))

    expect(mockExecFileSync).toHaveBeenCalledWith(
      'slm',
      ['search', 'test "quoted"', '--limit', '51', '--json'],
      { timeout: 10000 },
    )
  })

  describe('pagination', () => {
    it('returns pagination metadata', async () => {
      const items = Array.from({ length: 3 }, (_, i) => ({
        id: String(i),
        content: `c${i}`,
        source: 's',
        timestamp: 't',
      }))
      mockExecFileSync.mockReturnValue(Buffer.from(JSON.stringify(items)))

      const response = await GET(makeRequest({ limit: '10', offset: '0' }))
      const data = await response.json()

      expect(data.offset).toBe(0)
      expect(data.limit).toBe(10)
      expect(data.hasMore).toBe(false)
      expect(data.total).toBe(3)
      expect(data.count).toBe(3)
    })

    it('sets hasMore when more results exist', async () => {
      // limit=2, offset=0, so fetchLimit=3. Return 3 items -> hasMore=true
      const items = Array.from({ length: 3 }, (_, i) => ({ id: String(i) }))
      mockExecFileSync.mockReturnValue(Buffer.from(JSON.stringify(items)))

      const response = await GET(makeRequest({ limit: '2', offset: '0' }))
      const data = await response.json()

      expect(data.hasMore).toBe(true)
      expect(data.conversations).toHaveLength(2)
    })

    it('applies offset correctly', async () => {
      const items = Array.from({ length: 5 }, (_, i) => ({ id: String(i) }))
      mockExecFileSync.mockReturnValue(Buffer.from(JSON.stringify(items)))

      const response = await GET(makeRequest({ limit: '2', offset: '2' }))
      const data = await response.json()

      expect(data.conversations).toEqual([{ id: '2' }, { id: '3' }])
      expect(data.offset).toBe(2)
    })
  })

  describe('command injection prevention', () => {
    it.each(['; rm -rf /', '| cat /etc/passwd', '&& malicious', '$(whoami)', '`whoami`'])(
      'safely handles shell metacharacter: %s',
      async (malicious) => {
        mockExecFileSync.mockReturnValue(Buffer.from('[]'))

        const response = await GET(makeRequest({ q: malicious }))

        expect(response.status).toBe(200)
        expect(mockExecFileSync).toHaveBeenCalledWith('slm', expect.arrayContaining([malicious]), {
          timeout: 10000,
        })
      },
    )

    it('truncates queries exceeding 200 characters', async () => {
      mockExecFileSync.mockReturnValue(Buffer.from('[]'))
      const longQuery = 'a'.repeat(300)

      await GET(makeRequest({ q: longQuery }))

      const args = mockExecFileSync.mock.calls[0][1] as string[]
      expect(args[1].length).toBe(200)
    })

    it('strips control characters from query', async () => {
      mockExecFileSync.mockReturnValue(Buffer.from('[]'))

      await GET(makeRequest({ q: 'hello\x00world\x1f!' }))

      expect(mockExecFileSync).toHaveBeenCalledWith(
        'slm',
        ['search', 'helloworld!', '--limit', '51', '--json'],
        { timeout: 10000 },
      )
    })

    it.each([
      ['-1', '51'],
      ['0', '51'],
      ['abc', '51'],
      ['NaN', '51'],
      ['9999', '1001'],
    ])('handles invalid limit "%s" -> fetches %s', async (input, expected) => {
      mockExecFileSync.mockReturnValue(Buffer.from('[]'))

      await GET(makeRequest({ limit: input }))

      expect(mockExecFileSync).toHaveBeenCalledWith(
        'slm',
        ['list', '--limit', expected, '--json'],
        { timeout: 10000 },
      )
    })
  })
})
