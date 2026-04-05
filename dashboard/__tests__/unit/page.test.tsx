/**
 * Unit tests for DashboardPage component
 *
 * What: ダッシュボードのメインページコンポーネントが、
 *       必要なUI要素（ヘッダー、ステータスカード、検索UI）を描画することを検証する。
 *
 * Why:  このコンポーネントはユーザーが最初に目にする画面であり、
 *       システムの稼働状況を把握する唯一のインターフェース。
 *       UI要素の欠落はユーザーの操作不能に直結する。
 *
 * Risk if failing:
 *   - ヘッダーが欠落し、ユーザーがどのアプリケーションか判別できない
 *   - ステータスカードが表示されず、システム障害に気づけない
 *   - 検索UIが欠落し、会話データの検索が不可能になる
 *   - ローディング表示がなく、データ取得中にユーザーが「壊れている」と誤認する
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import DashboardPage from '@/app/page'
import { LocaleProvider } from '@/app/i18n/LocaleContext'

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      json: async () => ({ conversations: [], count: 0 }),
    }),
  )
})

describe('DashboardPage', () => {
  /**
   * What: h1 見出しに "SLM Dashboard" が表示される。
   * Why:  ページの識別子。複数タブ使用時やブックマーク時にユーザーが画面を判別する基盤。
   * Risk: タイトルが消え、ユーザーがどのページにいるか分からなくなる。
   */
  it('renders the dashboard heading', () => {
    render(
      <LocaleProvider>
        <DashboardPage />
      </LocaleProvider>,
    )
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('SLM Dashboard')
  })

  /**
   * What: Status, Ollama, Database, Facts, Entities, Disk の6つのステータスカードが描画される。
   * Why:  これらはシステムの稼働状況を一目で把握するための主要情報。
   *       1つでも欠落すると、障害の兆候を見逃す可能性がある。
   * Risk: カードが欠落してOllama切断やDB消失に気づけず、対応が遅れる。
   */
  it('renders all six health status cards', () => {
    render(
      <LocaleProvider>
        <DashboardPage />
      </LocaleProvider>,
    )
    expect(screen.getAllByText('Status').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Ollama').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Database').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Facts').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Entities').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Disk').length).toBeGreaterThanOrEqual(1)
  })

  /**
   * What: Dashboard と Conversations のナビゲーションボタンが描画される。
   * Why:  タブ切り替えはダッシュボードの主要ナビゲーション。
   *       ボタンが欠落するとユーザーが画面を切り替えられない。
   * Risk: ナビゲーションが表示されず、会話検索画面にアクセスできない。
   */
  it('renders navigation buttons for tab switching', () => {
    render(
      <LocaleProvider>
        <DashboardPage />
      </LocaleProvider>,
    )
    const dashboardButtons = screen.getAllByText('Dashboard')
    expect(dashboardButtons.length).toBeGreaterThanOrEqual(1)
    const conversationsButtons = screen.getAllByText('Conversations')
    expect(conversationsButtons.length).toBeGreaterThanOrEqual(1)
  })

  /**
   * What: 初期描画時に "loading..." というローディング表示が存在する。
   * Why:  APIからデータ取得完了前にユーザーに待機中であることを伝える。
   *       ローディング表示がないと、空欄＝データなし と誤解される。
   * Risk: ユーザーが「データが存在しない」と勘違いし、不要な問い合わせが発生する。
   */
  it('shows loading state initially', () => {
    render(
      <LocaleProvider>
        <DashboardPage />
      </LocaleProvider>,
    )
    const loadingTexts = screen.getAllByText('...')
    expect(loadingTexts.length).toBeGreaterThanOrEqual(1)
  })
})
