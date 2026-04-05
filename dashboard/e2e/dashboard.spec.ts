/**
 * E2E tests for SLM Dashboard
 *
 * What: ダッシュボードの主要機能（ヘルスカード、チャート、検索、ページネーション、
 *       サイドバー、レスポンシブ表示）がブラウザ上で正しく動作することを検証する。
 *
 * Why:  ユニットテストではカバーできないブラウザ固有の動作（CSS レイアウト、
 *       API 通信フロー、ユーザーインタラクション）を検証し、
 *       デプロイ前にリグレッションを検出する。
 *
 * Risk if failing:
 *   - UIレイアウトが崩れた状態でリリースされる
 *   - API連携の不具合でデータが表示されない
 *   - ユーザー操作（検索、ページ遷移）が機能しない
 */
import { test, expect } from '@playwright/test'
import {
  healthData,
  degradedHealthData,
  conversationsData,
  page2ConversationsData,
  searchResultsData,
  statsData,
} from './fixtures'
import type { Page } from '@playwright/test'

async function gotoApp(page: Page) {
  await page.goto('/dashboard')
}

async function mockAllApis(page: Page) {
  await page.route('**/dashboard/api/health', (route) => route.fulfill({ json: healthData }))
  await page.route('**/dashboard/api/stats', (route) => route.fulfill({ json: statsData }))
  await page.route('**/dashboard/api/conversations**', (route) => {
    const url = new URL(route.request().url())
    const q = url.searchParams.get('q')
    const offset = Number(url.searchParams.get('offset') || '0')

    if (q) {
      return route.fulfill({ json: searchResultsData })
    }
    if (offset > 0) {
      return route.fulfill({ json: page2ConversationsData })
    }
    return route.fulfill({ json: conversationsData })
  })
}

test.describe('Page display and health cards', () => {
  /**
   * What: h1 見出しに "SLM Dashboard" が表示される。
   * Why:  ページの識別子。正しいページが表示されていることの基本確認。
   * Risk: ルーティングやレンダリングの不具合でページが表示されない。
   */
  test('displays dashboard heading', async ({ page }) => {
    await mockAllApis(page)
    await gotoApp(page)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('SLM Dashboard')
  })

  /**
   * What: 6 つのヘルスカード（Status, Ollama, Database, Facts, Entities, Disk）が表示される。
   * Why:  システム状態を一目で確認するための主要 UI 要素。
   * Risk: カード欠落で障害の兆候を見逃す。
   */
  test('renders all six health status cards', async ({ page }) => {
    await mockAllApis(page)
    await gotoApp(page)

    for (const label of ['Status', 'Ollama', 'Database', 'Facts', 'Entities', 'Disk']) {
      await expect(page.getByText(label, { exact: true }).first()).toBeVisible()
    }

    const healthSection = page.locator('#section-health')
    await expect(healthSection.getByText('healthy')).toBeVisible()
    await expect(healthSection.getByText('connected')).toBeVisible()
    await expect(healthSection.getByText('ok')).toBeVisible()
    await expect(healthSection.getByText('42', { exact: true })).toBeVisible()
    await expect(healthSection.getByText('15', { exact: true })).toBeVisible()
    await expect(healthSection.getByText('1.2 GB')).toBeVisible()
  })

  /**
   * What: healthy 状態でステータスカードが emerald 系のスタイルを持つ。
   * Why:  色でシステム状態を視覚的に伝えるため。
   * Risk: 色が正しく適用されず、正常/異常の区別がつかない。
   */
  test('shows emerald color for healthy status', async ({ page }) => {
    await mockAllApis(page)
    await gotoApp(page)

    const statusCard = page.getByText('healthy').locator('..')
    await expect(statusCard).toBeVisible()

    const dotSpan = page.locator('span.animate-pulse').first()
    const dotClass = await dotSpan.getAttribute('class')
    expect(dotClass).toContain('bg-emerald-400')
  })

  /**
   * What: degraded 状態でステータスカードが amber 系のスタイルに変化する。
   * Why:  異常状態を即座に視認できる必要がある。
   * Risk: 異常時にも正常色が表示され、障害に気づけない。
   */
  test('shows amber color for degraded status', async ({ page }) => {
    await page.route('**/dashboard/api/health', (route) =>
      route.fulfill({ json: degradedHealthData }),
    )
    await page.route('**/dashboard/api/stats', (route) => route.fulfill({ json: statsData }))
    await page.route('**/dashboard/api/conversations**', (route) =>
      route.fulfill({ json: conversationsData }),
    )
    await gotoApp(page)

    await expect(page.getByText('degraded')).toBeVisible()

    const dotSpan = page.locator('span.animate-pulse').first()
    const dotClass = await dotSpan.getAttribute('class')
    expect(dotClass).toContain('bg-amber-400')
  })
})

test.describe('Chart rendering', () => {
  /**
   * What: "Memories per Day" 棒グラフが SVG 要素として描画される。
   * Why:  過去 30 日間のメモリ推移をユーザーが視覚的に確認するための主要チャート。
   * Risk: Recharts の動的インポートやデータ連携の不具合でチャートが表示されない。
   */
  test('renders bar chart for daily memories', async ({ page }) => {
    await mockAllApis(page)
    await gotoApp(page)

    const chartSection = page.getByText('Memories per Day').locator('..').locator('..')
    await expect(chartSection).toBeVisible()
    await expect(chartSection.locator('svg').first()).toBeVisible({ timeout: 10_000 })
  })

  /**
   * What: "Source Breakdown" ドーナツチャートが SVG 要素として描画される。
   * Why:  データソースの割合をユーザーが把握するためのチャート。
   * Risk: ソースデータの変換やチャート描画の不具合で表示されない。
   */
  test('renders pie chart for source breakdown', async ({ page }) => {
    await mockAllApis(page)
    await gotoApp(page)

    const chartSection = page.getByText('Source Breakdown').locator('..').locator('..')
    await expect(chartSection).toBeVisible()
    await expect(chartSection.locator('svg').first()).toBeVisible({ timeout: 10_000 })
  })
})

test.describe('Search and filter', () => {
  /**
   * What: 検索入力後に Enter キーで検索が実行され、結果が表示される。
   * Why:  キーボード操作による検索はダッシュボードの主要ワークフロー。
   * Risk: Enter キーイベントが正しくハンドルされず、検索が実行されない。
   */
  test('searches by pressing Enter', async ({ page }) => {
    await mockAllApis(page)
    await gotoApp(page)

    await expect(page.getByText('Conversation content number 1 for testing')).toBeVisible()

    const input = page.getByPlaceholder('Search conversations...')
    await input.fill('matching')
    await input.press('Enter')

    await expect(page.getByText('Found: matching search result content.')).toBeVisible()
  })

  /**
   * What: Search ボタンクリックで検索が実行される。
   * Why:  マウス操作による検索も同等に機能する必要がある。
   * Risk: ボタンの onClick ハンドラの不具合で検索が実行されない。
   */
  test('searches by clicking Search button', async ({ page }) => {
    await mockAllApis(page)
    await gotoApp(page)

    const input = page.getByPlaceholder('Search conversations...')
    await input.fill('matching')
    await page.getByRole('button', { name: 'Search' }).click()

    await expect(page.getByText('Found: matching search result content.')).toBeVisible()
  })

  /**
   * What: ソースフィルターで会話リストが絞り込まれる。
   * Why:  特定ソースの会話だけを閲覧したい場合の主要機能。
   * Risk: フィルターの state 管理不具合でリストが正しく絞り込まれない。
   */
  test('filters conversations by source', async ({ page }) => {
    await mockAllApis(page)
    await gotoApp(page)

    await expect(page.getByText('Conversation content number 1 for testing')).toBeVisible()

    const select = page.locator('select')
    await select.selectOption('claude')

    const visibleConversations = page.locator('text=Conversation content number')
    const count = await visibleConversations.count()

    expect(count).toBeGreaterThan(0)
    expect(count).toBeLessThan(50)
  })
})

test.describe('Pagination', () => {
  /**
   * What: Next ボタンで 2 ページ目に遷移し、Previous で 1 ページ目に戻れる。
   * Why:  大量の会話データをページ単位で閲覧するための必須機能。
   * Risk: offset の計算不具合やAPI 呼び出しの不具合でページ送りが機能しない。
   */
  test('navigates between pages with Next and Previous', async ({ page }) => {
    await mockAllApis(page)
    await gotoApp(page)

    await expect(page.getByText('Conversation content number 1 for testing')).toBeVisible()

    const nextButton = page.getByRole('button', { name: 'Next', exact: true })
    await expect(nextButton).toBeEnabled()
    await nextButton.click()

    await expect(page.getByText('Page 2 conversation content number 51.')).toBeVisible()

    const prevButton = page.getByRole('button', { name: 'Previous', exact: true })
    await expect(prevButton).toBeEnabled()
    await prevButton.click()

    await expect(page.getByText('Conversation content number 1 for testing')).toBeVisible()
  })

  /**
   * What: 先頭ページで Previous ボタンが disabled になる。
   * Why:  存在しないページへの遷移を防ぐ UI フィードバック。
   * Risk: disabled 制御の不具合で不正な offset でのAPI呼び出しが発生する。
   */
  test('disables Previous button on first page', async ({ page }) => {
    await mockAllApis(page)
    await gotoApp(page)

    await expect(page.getByText('Conversation content number 1 for testing')).toBeVisible()

    const prevButton = page.getByRole('button', { name: 'Previous' })
    await expect(prevButton).toBeDisabled()
  })
})

test.describe('Sidebar', () => {
  /**
   * What: サイドバーのナビゲーション項目をクリックするとアクティブ状態が切り替わる。
   * Why:  ユーザーが現在のセクションを視覚的に把握するための UI フィードバック。
   * Risk: activeSection の state 管理不具合でアクティブ表示が更新されない。
   */
  test('switches active navigation item on click', async ({ page }) => {
    await mockAllApis(page)
    await gotoApp(page)

    const dashboardNav = page.getByRole('button', { name: 'Dashboard' })
    const conversationsNav = page.getByRole('button', { name: 'Conversations' })
    const healthNav = page.getByRole('button', { name: 'System Health' })

    await expect(dashboardNav).toHaveClass(/bg-blue-600/)

    await conversationsNav.click()
    await expect(conversationsNav).toHaveClass(/bg-blue-600/)
    await expect(dashboardNav).not.toHaveClass(/bg-blue-600/)

    await healthNav.click()
    await expect(healthNav).toHaveClass(/bg-blue-600/)
    await expect(conversationsNav).not.toHaveClass(/bg-blue-600/)
  })

  /**
   * What: 折りたたみトグルでサイドバーが縮小し、ラベルが非表示になる。
   * Why:  画面スペースを有効活用するための UI 機能。
   * Risk: collapsed 状態の切り替え不具合でサイドバーが正しく縮小しない。
   */
  test('collapses sidebar to icon-only mode', async ({ page }) => {
    await mockAllApis(page)
    await gotoApp(page)

    const sidebar = page.locator('aside')
    const toggleButton = sidebar.locator('div.p-2 button')
    const navLabel = sidebar.locator('nav').getByText('Dashboard', { exact: true }).first()

    await expect(navLabel).toBeVisible()
    await expect(sidebar).toHaveClass(/w-56/)

    await toggleButton.click()

    await expect(sidebar).toHaveClass(/w-16/)
    await expect(navLabel).toBeHidden()
  })

  /**
   * What: 折りたたみ後に再クリックで元のサイズに戻り、ラベルが再表示される。
   * Why:  折りたたみは可逆操作であるべき。
   * Risk: 状態のトグル不具合で復元できなくなる。
   */
  test('expands sidebar back from collapsed state', async ({ page }) => {
    await mockAllApis(page)
    await gotoApp(page)

    const sidebar = page.locator('aside')
    const toggleButton = sidebar.locator('div.p-2 button')
    const navLabel = sidebar.locator('nav').getByText('Dashboard', { exact: true }).first()

    await toggleButton.click()
    await expect(sidebar).toHaveClass(/w-16/)

    await toggleButton.click({ force: true })
    await expect(sidebar).toHaveClass(/w-56/)
    await expect(navLabel).toBeVisible()
  })
})

test.describe('Responsive layout', () => {
  /**
   * What: デスクトップ幅（1280px）でヘルスカードが 6 列に表示される。
   * Why:  デスクトップでは全カードを一行で表示し、一覧性を最大化する。
   * Risk: grid-cols-6 の Tailwind クラスが正しく適用されない。
   */
  test('shows 6-column health cards on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await mockAllApis(page)
    await gotoApp(page)

    const healthSection = page.locator('#section-health')
    await expect(healthSection).toBeVisible()

    const cards = healthSection.locator('> div')
    const cardCount = await cards.count()
    expect(cardCount).toBe(6)

    const firstCardBox = await cards.nth(0).boundingBox()
    const lastCardBox = await cards.nth(5).boundingBox()
    expect(firstCardBox).not.toBeNull()
    expect(lastCardBox).not.toBeNull()
    expect(firstCardBox!.y).toBeCloseTo(lastCardBox!.y, 0)
  })

  /**
   * What: タブレット幅（768px）でヘルスカードが 3 列に表示される。
   * Why:  中間サイズでは 3 列レイアウトで視認性とスペースのバランスを取る。
   * Risk: md:grid-cols-3 のブレークポイントが正しく機能しない。
   */
  test('shows 3-column health cards on tablet', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 })
    await mockAllApis(page)
    await gotoApp(page)

    const healthSection = page.locator('#section-health')
    await expect(healthSection).toBeVisible()

    const cards = healthSection.locator('> div')
    const firstCardBox = await cards.nth(0).boundingBox()
    const fourthCardBox = await cards.nth(3).boundingBox()
    expect(firstCardBox).not.toBeNull()
    expect(fourthCardBox).not.toBeNull()
    expect(fourthCardBox!.y).toBeGreaterThan(firstCardBox!.y)
  })

  /**
   * What: モバイル幅（375px）でヘルスカードが 2 列に表示される。
   * Why:  狭い画面でも最低限の情報を並列表示する。
   * Risk: grid-cols-2 のデフォルトレイアウトが崩れる。
   */
  test('shows 2-column health cards on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await mockAllApis(page)
    await gotoApp(page)

    const healthSection = page.locator('#section-health')
    await expect(healthSection).toBeVisible()

    const cards = healthSection.locator('> div')
    const firstCardBox = await cards.nth(0).boundingBox()
    const secondCardBox = await cards.nth(1).boundingBox()
    const thirdCardBox = await cards.nth(2).boundingBox()
    expect(firstCardBox).not.toBeNull()
    expect(secondCardBox).not.toBeNull()
    expect(thirdCardBox).not.toBeNull()
    expect(firstCardBox!.y).toBeCloseTo(secondCardBox!.y, 0)
    expect(thirdCardBox!.y).toBeGreaterThan(firstCardBox!.y)
  })
})

test.describe('Settings and language', () => {
  /**
   * What: Settings ボタンクリックで Settings モーダルが開き、Close で閉じる。
   * Why:  Settings パネルはユーザーが言語やシステム情報にアクセスする唯一の手段。
   * Risk: モーダルの開閉不具合で設定変更が不可能になる。
   */
  test('opens and closes Settings modal', async ({ page }) => {
    await mockAllApis(page)
    await gotoApp(page)

    await page.getByRole('button', { name: 'Settings' }).click()
    await expect(page.getByText('Settings').nth(1)).toBeVisible()

    await page.getByRole('button', { name: 'Close' }).click()
    await expect(page.getByRole('button', { name: 'Close' })).toBeHidden()
  })

  /**
   * What: 言語を日本語に切り替えるとUIテキストが日本語になる。
   * Why:  i18n の主要機能。言語切り替えが実際に画面に反映されることの検証。
   * Risk: Context の更新不具合で言語切り替えが反映されない。
   */
  test('switches language to Japanese', async ({ page }) => {
    await mockAllApis(page)
    await gotoApp(page)

    await page.getByRole('button', { name: 'Settings' }).click()

    const langSelect = page.locator('.fixed select')
    await langSelect.selectOption('ja')

    await page.getByRole('button', { name: '閉じる' }).click()

    await expect(page.getByRole('button', { name: 'ダッシュボード' })).toBeVisible()
    await expect(page.getByText('ステータス')).toBeVisible()
    await expect(page.getByPlaceholder('会話を検索...')).toBeVisible()
  })
})
