/**
 * Unit tests for GET /api/conversations
 *
 * What: 会話一覧/検索APIが、クエリパラメータを正しく解釈し、
 *       slm CLI を適切な引数で呼び出し、結果を JSON で返すことを検証する。
 *
 * Why:  このエンドポイントはダッシュボードの主要データソースであり、
 *       ユーザー入力（検索クエリ）を受け取ってCLIコマンドに渡す。
 *       パラメータの解釈ミスやエラーハンドリングの不備は、
 *       データ表示の不具合やセキュリティリスクに直結する。
 *
 * Risk if failing:
 *   - 検索機能が動作せず、ユーザーが会話を検索できなくなる
 *   - limit パラメータが無視され、大量データ取得でパフォーマンスが劣化する
 *   - slm コマンド失敗時にAPIが未処理例外で落ちる
 *   - コマンドインジェクション脆弱性が修正されていない
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
  /**
   * What: クエリパラメータなしの場合、`slm list` を実行し会話データを返す。
   * Why:  ダッシュボード初期表示の基本動作。デフォルトで最新50件を取得する。
   * Risk: 初期表示で会話が一切表示されず、ユーザーがシステム障害と誤認する。
   */
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

  /**
   * What: `q` パラメータが指定された場合、`slm search` に切り替わる。
   * Why:  list と search の分岐ロジックが正しく動作しないと、
   *       検索しても全件表示されたり、逆に一覧が検索結果になる。
   * Risk: 検索機能が完全に使えなくなる。
   */
  it('uses slm search when query is provided', async () => {
    mockExecFileSync.mockReturnValue(Buffer.from('[]'))

    await GET(makeRequest({ q: 'test query' }))

    expect(mockExecFileSync).toHaveBeenCalledWith(
      'slm',
      ['search', 'test query', '--limit', '51', '--json'],
      { timeout: 10000 },
    )
  })

  /**
   * What: `limit` パラメータが slm コマンドの --limit 引数に正しく反映される。
   * Why:  大量データ環境でフロントエンドがページサイズを指定できる必要がある。
   * Risk: limit が無視されデフォルトの50件が常に返され、
   *       ページネーション実装時に件数制御ができなくなる。
   */
  it('respects limit parameter', async () => {
    mockExecFileSync.mockReturnValue(Buffer.from('[]'))

    await GET(makeRequest({ limit: '10' }))

    expect(mockExecFileSync).toHaveBeenCalledWith('slm', ['list', '--limit', '11', '--json'], {
      timeout: 10000,
    })
  })

  /**
   * What: slm コマンドが異常終了した場合、HTTP 500 とエラーメッセージを返す。
   * Why:  slm 未インストール・タイムアウト等の障害時にクライアントが
   *       エラー原因を把握できる必要がある。
   * Risk: 未処理例外でプロセスクラッシュ、またはエラー情報なしの空レスポンスが返り、
   *       デバッグが困難になる。
   */
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

  /**
   * What: slm が不正な JSON を返した場合、HTTP 500 を返す。
   * Why:  slm のバージョン不一致や出力形式変更で JSON パースが失敗する場合がある。
   *       これを適切に処理しないとクライアントが壊れたデータを受け取る。
   * Risk: JSON.parse の例外が未処理でAPIがクラッシュする。
   */
  it('returns 500 when slm returns invalid JSON', async () => {
    mockExecFileSync.mockReturnValue(Buffer.from('not json'))

    const response = await GET(makeRequest())

    expect(response.status).toBe(500)
  })

  /**
   * What: クエリ内のダブルクォートがそのままリテラル引数として渡される（シェル解釈なし）。
   * Why:  execFileSync はシェルを経由しないため、特殊文字をエスケープする必要がない。
   *       ユーザーがクォートを含む検索を行えることを保証する。
   * Risk: クォートを含む検索でコマンドが構文エラーになり検索不能になる。
   */
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
    /**
     * What: ページネーションメタデータ（offset, limit, hasMore, total）が正しく返される。
     * Why:  フロントエンドがページ送りUIを構築するために必要な情報。
     * Risk: メタデータが欠落するとページネーションUIが動作しない。
     */
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

    /**
     * What: 結果が limit を超える場合に hasMore=true が返される。
     * Why:  「次のページが存在するか」をクライアントに伝えるフラグ。
     * Risk: hasMore が常に false だと、データがあるのにページ送りできない。
     */
    it('sets hasMore when more results exist', async () => {
      // limit=2, offset=0, so fetchLimit=3. Return 3 items -> hasMore=true
      const items = Array.from({ length: 3 }, (_, i) => ({ id: String(i) }))
      mockExecFileSync.mockReturnValue(Buffer.from(JSON.stringify(items)))

      const response = await GET(makeRequest({ limit: '2', offset: '0' }))
      const data = await response.json()

      expect(data.hasMore).toBe(true)
      expect(data.conversations).toHaveLength(2)
    })

    /**
     * What: offset パラメータにより結果がスライスされる。
     * Why:  ページ送り時に適切な位置からデータを返す必要がある。
     * Risk: offset が無視されると毎回先頭からのデータが返され、ページ送りが機能しない。
     */
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
    /**
     * What: シェルメタ文字（;, |, &&, $(), ``）がそのままリテラル引数として渡される。
     * Why:  execFileSync はシェルを経由しないため、メタ文字は無害だが、
     *       将来の変更でシェル経由に戻されないことを保証する回帰テスト。
     * Risk: コマンドインジェクションにより任意コマンド実行が可能になり、
     *       サーバー全体が危険にさらされる。
     */
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

    /**
     * What: 200文字を超えるクエリが切り詰められる。
     * Why:  過剰に長いクエリによるリソース消費やバッファオーバーフローを防ぐ。
     * Risk: 無制限のクエリ長でslmプロセスがハングしたり、メモリを大量消費する。
     */
    it('truncates queries exceeding 200 characters', async () => {
      mockExecFileSync.mockReturnValue(Buffer.from('[]'))
      const longQuery = 'a'.repeat(300)

      await GET(makeRequest({ q: longQuery }))

      const args = mockExecFileSync.mock.calls[0][1] as string[]
      expect(args[1].length).toBe(200)
    })

    /**
     * What: 制御文字（NULL, DEL等）がクエリから除去される。
     * Why:  制御文字はslm CLIの引数として不正であり、予期しない動作を引き起こす。
     * Risk: 制御文字がslmに渡されてパース異常やクラッシュが発生する。
     */
    it('strips control characters from query', async () => {
      mockExecFileSync.mockReturnValue(Buffer.from('[]'))

      await GET(makeRequest({ q: 'hello\x00world\x1f!' }))

      expect(mockExecFileSync).toHaveBeenCalledWith(
        'slm',
        ['search', 'helloworld!', '--limit', '51', '--json'],
        { timeout: 10000 },
      )
    })

    /**
     * What: 不正な limit 値（負数, 0, 非数値, 上限超過）がデフォルト値にフォールバックする。
     * Why:  不正な limit がそのままslmに渡されるとエラーや大量データ取得の原因になる。
     * Risk: limit=-1 でslmがクラッシュ、limit=999999 でメモリ枯渇が発生する。
     */
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
