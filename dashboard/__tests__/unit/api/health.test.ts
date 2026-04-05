import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockExecSync, mockExistsSync } = vi.hoisted(() => ({
  mockExecSync: vi.fn(),
  mockExistsSync: vi.fn(),
}))

vi.mock('child_process', () => ({
  default: { execSync: mockExecSync },
  execSync: mockExecSync,
}))

vi.mock('fs', () => ({
  default: { existsSync: mockExistsSync },
  existsSync: mockExistsSync,
}))

import { GET } from '@/app/api/health/route'

beforeEach(() => {
  vi.resetAllMocks()
})

describe('GET /api/health', () => {
  it('returns healthy when Ollama is connected and DB exists', async () => {
    mockExecSync.mockReturnValue(Buffer.from('128M\t/data/.superlocalmemory'))
    mockExistsSync.mockReturnValue(true)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))

    const response = await GET()
    const data = await response.json()

    expect(data.status).toBe('healthy')
    expect(data.ollama).toBe('connected')
    expect(data.database).toBe('ok')
    expect(data.diskUsage).toBe('128M')
    expect(data.timestamp).toBeDefined()
  })

  it('returns degraded when Ollama is disconnected', async () => {
    mockExecSync.mockReturnValue(Buffer.from('128M\t/data/.superlocalmemory'))
    mockExistsSync.mockReturnValue(true)
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('connection refused')))

    const response = await GET()
    const data = await response.json()

    expect(data.status).toBe('degraded')
    expect(data.ollama).toBe('disconnected')
    expect(data.database).toBe('ok')
  })

  it('returns degraded when DB is missing', async () => {
    mockExecSync.mockReturnValue(Buffer.from('0\t-'))
    mockExistsSync.mockReturnValue(false)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))

    const response = await GET()
    const data = await response.json()

    expect(data.status).toBe('degraded')
    expect(data.database).toBe('missing')
  })

  it('returns unknown disk usage when du command fails', async () => {
    mockExecSync.mockImplementation(() => {
      throw new Error('command failed')
    })
    mockExistsSync.mockReturnValue(true)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))

    const response = await GET()
    const data = await response.json()

    expect(data.diskUsage).toBe('unknown')
  })

  it('returns error ollama status when response is not ok', async () => {
    mockExecSync.mockReturnValue(Buffer.from('0\t-'))
    mockExistsSync.mockReturnValue(false)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))

    const response = await GET()
    const data = await response.json()

    expect(data.ollama).toBe('error')
  })
})
