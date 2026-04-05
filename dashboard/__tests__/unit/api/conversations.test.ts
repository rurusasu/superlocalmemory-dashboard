/**
 * Unit tests for GET /api/conversations
 *
 * What: 会話一覧/検索APIが、クエリパラメータを正しく解釈し、
 *       slm CLI を適切な引数で呼び出し、結果を JSON で返すことを検証する。
 *
 * Why:  このエンドポイントはダッシュボードの主要データソースであり、
 *       ユーザー入力（検索クエリ）を受け取ってシェルコマンドに渡す。
 *       パラメータの解釈ミスやエラーハンドリングの不備は、
 *       データ表示の不具合やセキュリティリスクに直結する。
 *
 * Risk if failing:
 *   - 検索機能が動作せず、ユーザーが会話を検索できなくなる
 *   - limit パラメータが無視され、大量データ取得でパフォーマンスが劣化する
 *   - slm コマンド失敗時にAPIが未処理例外で落ちる
 *   - ダブルクォートのエスケープ漏れでシェルコマンドが壊れる
 */
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
  /**
   * What: クエリパラメータなしの場合、`slm list` を実行し会話データを返す。
   * Why:  ダッシュボード初期表示の基本動作。デフォルトで最新50件を取得する。
   * Risk: 初期表示で会話が一切表示されず、ユーザーがシステム障害と誤認する。
   */
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

  /**
   * What: `q` パラメータが指定された場合、`slm search` に切り替わる。
   * Why:  list と search の分岐ロジックが正しく動作しないと、
   *       検索しても全件表示されたり、逆に一覧が検索結果になる。
   * Risk: 検索機能が完全に使えなくなる。
   */
  it('uses slm search when query is provided', async () => {
    mockExecSync.mockReturnValue(Buffer.from('[]'))

    await GET(makeRequest({ q: 'test query' }))

    expect(mockExecSync).toHaveBeenCalledWith(
      'slm search "test query" --limit 50 --json',
      { timeout: 10000 }
    )
  })

  /**
   * What: `limit` パラメータが slm コマンドの --limit 引数に正しく反映される。
   * Why:  大量データ環境でフロントエンドがページサイズを指定できる必要がある。
   * Risk: limit が無視されデフォルトの50件が常に返され、
   *       ページネーション実装時に件数制御ができなくなる。
   */
  it('respects limit parameter', async () => {
    mockExecSync.mockReturnValue(Buffer.from('[]'))

    await GET(makeRequest({ limit: '10' }))

    expect(mockExecSync).toHaveBeenCalledWith(
      'slm list --limit 10 --json',
      { timeout: 10000 }
    )
  })

  /**
   * What: slm コマンドが異常終了した場合、HTTP 500 とエラーメッセージを返す。
   * Why:  slm 未インストール・タイムアウト等の障害時にクライアントが
   *       エラー原因を把握できる必要がある。
   * Risk: 未処理例外でプロセスクラッシュ、またはエラー情報なしの空レスポンスが返り、
   *       デバッグが困難になる。
   */
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

  /**
   * What: slm が不正な JSON を返した場合、HTTP 500 を返す。
   * Why:  slm のバージョン不一致や出力形式変更で JSON パースが失敗する場合がある。
   *       これを適切に処理しないとクライアントが壊れたデータを受け取る。
   * Risk: JSON.parse の例外が未処理でAPIがクラッシュする。
   */
  it('returns 500 when slm returns invalid JSON', async () => {
    mockExecSync.mockReturnValue(Buffer.from('not json'))

    const response = await GET(makeRequest())

    expect(response.status).toBe(500)
  })

  /**
   * What: 検索クエリ内のダブルクォートが適切にエスケープされる。
   * Why:  ユーザー入力にダブルクォートが含まれると、シェルコマンドの
   *       文字列リテラルが壊れ、構文エラーやコマンドインジェクションの原因になる。
   * Risk: クォートを含む検索でコマンドが構文エラーになり検索不能になる。
   *       最悪の場合、コマンドインジェクション脆弱性につながる。
   */
  it('escapes double quotes in query', async () => {
    mockExecSync.mockReturnValue(Buffer.from('[]'))

    await GET(makeRequest({ q: 'test "quoted"' }))

    expect(mockExecSync).toHaveBeenCalledWith(
      expect.stringContaining('\\"quoted\\"'),
      { timeout: 10000 }
    )
  })
})
