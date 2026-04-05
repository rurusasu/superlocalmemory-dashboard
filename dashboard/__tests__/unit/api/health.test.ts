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
  /**
   * What: Ollamaが接続可能かつDBが存在するとき、status="healthy" を返す。
   * Why:  正常系の基本動作。これが壊れるとダッシュボードが常に異常表示になる。
   * Risk: 正常稼働中にユーザーが「異常」と誤認し、不要な調査・再起動を行う。
   */
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

  /**
   * What: Ollama への fetch が失敗したとき、status="degraded" を返す。
   * Why:  Ollamaが停止・ネットワーク断の場合でもAPIは500にならず、
   *       状態を正確に報告する必要がある。
   * Risk: 例外未処理で500を返し、ダッシュボード全体が壊れる。
   *       または disconnected を検出できず、LLM機能の障害を見逃す。
   */
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

  /**
   * What: memory.db が存在しないとき、database="missing" かつ status="degraded" を返す。
   * Why:  DBが未初期化または削除された場合、会話データの読み書きが不能になる。
   *       この状態をユーザーに知らせないと、データ損失に気づかない。
   * Risk: DBの欠損を検出できず、データ操作時に初めてエラーが発覚する。
   */
  it('returns degraded when DB is missing', async () => {
    mockExecSync.mockReturnValue(Buffer.from('0\t-'))
    mockExistsSync.mockReturnValue(false)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))

    const response = await GET()
    const data = await response.json()

    expect(data.status).toBe('degraded')
    expect(data.database).toBe('missing')
  })

  /**
   * What: `du -sh` コマンドが失敗したとき、diskUsage="unknown" を返しAPIは正常応答する。
   * Why:  コンテナ環境やパーミッションの問題で du が実行できない場合がある。
   *       これでAPI全体が壊れてはならない。
   * Risk: 例外が伝播してAPIが500を返し、ヘルスチェック全体が機能しなくなる。
   */
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

  /**
   * What: Ollamaが応答するが HTTP ステータスがエラーの場合、ollama="error" を返す。
   * Why:  Ollamaが起動しているが異常状態（モデル未ロード等）の場合と、
   *       完全に接続不能な場合を区別する必要がある。
   * Risk: "connected" と "error" を区別できず、障害の切り分けが困難になる。
   */
  it('returns error ollama status when response is not ok', async () => {
    mockExecSync.mockReturnValue(Buffer.from('0\t-'))
    mockExistsSync.mockReturnValue(false)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))

    const response = await GET()
    const data = await response.json()

    expect(data.ollama).toBe('error')
  })
})
