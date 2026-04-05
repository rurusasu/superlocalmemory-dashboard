/**
 * Unit tests for GET /api/health
 *
 * What: ヘルスチェックAPIが、Ollama接続状態・DB存在・ディスク使用量を
 *       正しく判定し、適切なステータスを返すことを検証する。
 *
 * Why:  このエンドポイントはダッシュボードのステータス表示や
 *       コンテナオーケストレータの監視判断の基盤となる。
 *       判定ロジックが誤ると、障害時に「healthy」と誤表示されたり、
 *       正常時に「degraded」と表示されて不要なアラートが発生する。
 *
 * Risk if failing:
 *   - ステータス判定の誤りにより、障害を見逃す or 誤検知する
 *   - ディスク使用量の取得失敗時にAPIが500エラーになり、ダッシュボードが表示不能になる
 *   - Ollama疎通チェックの例外未処理によりエンドポイント全体がクラッシュする
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockExecFileSync, mockExistsSync } = vi.hoisted(() => ({
  mockExecFileSync: vi.fn(),
  mockExistsSync: vi.fn(),
}))

vi.mock('child_process', () => ({
  default: { execFileSync: mockExecFileSync },
  execFileSync: mockExecFileSync,
}))

vi.mock('fs', () => ({
  default: { existsSync: mockExistsSync },
  existsSync: mockExistsSync,
}))

vi.mock('@/lib/metrics', () => ({
  ollamaConnectionStatus: { set: vi.fn() },
  databaseStatus: { set: vi.fn() },
}))

import { GET, resetHealthCache } from '@/app/api/health/route'

beforeEach(() => {
  vi.resetAllMocks()
  resetHealthCache()
})

describe('GET /api/health', () => {
  /**
   * What: Ollamaが接続可能かつDBが存在するとき、status="healthy" を返す。
   * Why:  正常系の基本動作。これが壊れるとダッシュボードが常に異常表示になる。
   */
  it('returns healthy when Ollama is connected and DB exists', async () => {
    mockExecFileSync.mockReturnValue(Buffer.from('128M\t/data/.superlocalmemory'))
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

  /**
   * What: Ollama への fetch が失敗したとき、status="degraded" を返す。
   */
  it('returns degraded when Ollama is disconnected', async () => {
    mockExecFileSync.mockReturnValue(Buffer.from('128M\t/data/.superlocalmemory'))
    mockExistsSync.mockReturnValue(true)
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('connection refused')))

    const response = await GET()
    const data = await response.json()

    expect(data.status).toBe('degraded')
    expect(data.ollama).toBe('disconnected')
    expect(data.database).toBe('ok')
  })

  /**
   * What: memory.db が存在しないとき、database="missing" かつ status="degraded" を返す。
   */
  it('returns degraded when DB is missing', async () => {
    mockExecFileSync.mockReturnValue(Buffer.from('0\t-'))
    mockExistsSync.mockReturnValue(false)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))

    const response = await GET()
    const data = await response.json()

    expect(data.status).toBe('degraded')
    expect(data.database).toBe('missing')
  })

  /**
   * What: `du -sh` コマンドが失敗したとき、diskUsage="unknown" を返しAPIは正常応答する。
   */
  it('returns unknown disk usage when du command fails', async () => {
    mockExecFileSync.mockImplementation(() => {
      throw new Error('command failed')
    })
    mockExistsSync.mockReturnValue(true)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))

    const response = await GET()
    const data = await response.json()

    expect(data.diskUsage).toBe('unknown')
  })

  /**
   * What: Ollamaが応答するが HTTP ステータスがエラーの場合、ollama="error" を返す。
   */
  it('returns error ollama status when response is not ok', async () => {
    mockExecFileSync.mockReturnValue(Buffer.from('0\t-'))
    mockExistsSync.mockReturnValue(false)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))

    const response = await GET()
    const data = await response.json()

    expect(data.ollama).toBe('error')
  })
})
