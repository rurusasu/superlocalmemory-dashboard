# Playwright E2E テスト Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** SLM Dashboard に Playwright E2E テストを追加し、GitHub Actions で自動実行する。

**Architecture:** Playwright の `webServer` 設定で Next.js dev server を自動起動し、`page.route()` で全 API をモックする。テストは Chromium のみで実行。

**Tech Stack:** @playwright/test, Next.js 16, Tailwind CSS v4, Recharts

---

## File Structure

| File | Responsibility |
|------|---------------|
| `dashboard/e2e/fixtures.ts` | モックデータ定義（health, conversations, stats） |
| `dashboard/e2e/dashboard.spec.ts` | 全 E2E テストケース（6 カテゴリ、16 テスト） |
| `dashboard/playwright.config.ts` | Playwright 設定（webServer, chromium only） |
| `dashboard/package.json` | devDependencies と scripts の追加 |
| `.github/workflows/ci.yml` | e2e-tests ジョブの追加 |
| `dashboard/.gitignore` | Playwright 出力ディレクトリの除外 |

---

### Task 1: Playwright のインストールと設定

**Files:**
- Modify: `dashboard/package.json`
- Create: `dashboard/playwright.config.ts`
- Modify: `dashboard/.gitignore`

- [ ] **Step 1: @playwright/test をインストール**

```bash
cd dashboard && npm install -D @playwright/test@^1.52.0
```

- [ ] **Step 2: package.json に e2e スクリプトを追加**

`dashboard/package.json` の `scripts` に以下を追加:

```json
"e2e": "playwright test",
"e2e:ui": "playwright test --ui"
```

- [ ] **Step 3: playwright.config.ts を作成**

`dashboard/playwright.config.ts`:

```typescript
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: 'http://localhost:3000/dashboard',
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: {
    command: 'npm run dev',
    port: 3000,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
})
```

- [ ] **Step 4: .gitignore に Playwright 出力を追加**

`dashboard/.gitignore` に以下を追記:

```
# Playwright
test-results/
playwright-report/
```

- [ ] **Step 5: Playwright ブラウザをインストール**

```bash
cd dashboard && npx playwright install chromium
```

- [ ] **Step 6: 動作確認 — 空のテストで起動テスト**

`dashboard/e2e/smoke.spec.ts` を一時作成:

```typescript
import { test, expect } from '@playwright/test'

test('dev server responds', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle(/SLM Dashboard/)
})
```

実行:
```bash
cd dashboard && npx playwright test
```

Expected: PASS（dev server が自動起動し、ページが応答）

その後 `smoke.spec.ts` を削除。

- [ ] **Step 7: コミット**

```bash
git add dashboard/package.json dashboard/package-lock.json dashboard/playwright.config.ts dashboard/.gitignore
git commit -m "chore: add Playwright E2E test infrastructure"
```

---

### Task 2: モックデータ（fixtures.ts）の作成

**Files:**
- Create: `dashboard/e2e/fixtures.ts`

- [ ] **Step 1: fixtures.ts を作成**

`dashboard/e2e/fixtures.ts`:

```typescript
export const healthData = {
  status: 'healthy',
  ollama: 'connected',
  database: 'ok',
  diskUsage: '1.2 GB',
  factCount: 42,
  entityCount: 15,
  mode: 'b',
  profile: 'default',
  dbSize: '50 MB',
  timestamp: '2026-04-05T12:00:00Z',
}

export const degradedHealthData = {
  ...healthData,
  status: 'degraded',
  ollama: 'disconnected',
}

export const conversationsData = {
  conversations: Array.from({ length: 50 }, (_, i) => ({
    id: `conv-${i + 1}`,
    content: `Conversation content number ${i + 1} for testing purposes.`,
    source: i % 3 === 0 ? 'claude' : i % 3 === 1 ? 'slack' : 'web',
    timestamp: `2026-04-${String(5 - Math.floor(i / 10)).padStart(2, '0')}T${String(10 + (i % 10)).padStart(2, '0')}:00:00Z`,
  })),
  hasMore: true,
  total: 120,
}

export const page2ConversationsData = {
  conversations: Array.from({ length: 50 }, (_, i) => ({
    id: `conv-${i + 51}`,
    content: `Page 2 conversation content number ${i + 51}.`,
    source: i % 2 === 0 ? 'claude' : 'slack',
    timestamp: `2026-04-03T${String(10 + (i % 10)).padStart(2, '0')}:00:00Z`,
  })),
  hasMore: true,
  total: 120,
}

export const searchResultsData = {
  conversations: [
    {
      id: 'search-1',
      content: 'Found: matching search result content.',
      source: 'claude',
      timestamp: '2026-04-05T12:00:00Z',
    },
  ],
  hasMore: false,
  total: 1,
}

export const statsData = {
  dailyCounts: Array.from({ length: 30 }, (_, i) => ({
    date: `2026-03-${String(7 + i).padStart(2, '0')}`,
    count: Math.floor(Math.random() * 20) + 1,
  })),
  sourceCounts: {
    claude: 45,
    slack: 30,
    web: 25,
  },
}
```

- [ ] **Step 2: コミット**

```bash
git add dashboard/e2e/fixtures.ts
git commit -m "test: add E2E mock fixtures for health, conversations, and stats"
```

---

### Task 3: ページ表示・ヘルスカードのテスト

**Files:**
- Create: `dashboard/e2e/dashboard.spec.ts`

- [ ] **Step 1: テストファイルのベースとモックセットアップを作成**

`dashboard/e2e/dashboard.spec.ts`:

```typescript
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

async function mockAllApis(page: Page) {
  await page.route('**/dashboard/api/health', (route) =>
    route.fulfill({ json: healthData }),
  )
  await page.route('**/dashboard/api/stats', (route) =>
    route.fulfill({ json: statsData }),
  )
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
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('SLM Dashboard')
  })

  /**
   * What: 6 つのヘルスカード（Status, Ollama, Database, Facts, Entities, Disk）が表示される。
   * Why:  システム状態を一目で確認するための主要 UI 要素。
   * Risk: カード欠落で障害の兆候を見逃す。
   */
  test('renders all six health status cards', async ({ page }) => {
    await mockAllApis(page)
    await page.goto('/')

    for (const label of ['Status', 'Ollama', 'Database', 'Facts', 'Entities', 'Disk']) {
      await expect(page.getByText(label, { exact: true }).first()).toBeVisible()
    }

    await expect(page.getByText('healthy')).toBeVisible()
    await expect(page.getByText('connected')).toBeVisible()
    await expect(page.getByText('ok')).toBeVisible()
    await expect(page.getByText('42')).toBeVisible()
    await expect(page.getByText('15')).toBeVisible()
    await expect(page.getByText('1.2 GB')).toBeVisible()
  })

  /**
   * What: healthy 状態でステータスカードが emerald 系のスタイルを持つ。
   * Why:  色でシステム状態を視覚的に伝えるため。
   * Risk: 色が正しく適用されず、正常/異常の区別がつかない。
   */
  test('shows emerald color for healthy status', async ({ page }) => {
    await mockAllApis(page)
    await page.goto('/')

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
    await page.route('**/dashboard/api/stats', (route) =>
      route.fulfill({ json: statsData }),
    )
    await page.route('**/dashboard/api/conversations**', (route) =>
      route.fulfill({ json: conversationsData }),
    )
    await page.goto('/')

    await expect(page.getByText('degraded')).toBeVisible()

    const dotSpan = page.locator('span.animate-pulse').first()
    const dotClass = await dotSpan.getAttribute('class')
    expect(dotClass).toContain('bg-amber-400')
  })
})
```

- [ ] **Step 2: テスト実行**

```bash
cd dashboard && npx playwright test -g "Page display"
```

Expected: 4 テスト PASS

- [ ] **Step 3: コミット**

```bash
git add dashboard/e2e/dashboard.spec.ts
git commit -m "test(e2e): add page display and health card tests"
```

---

### Task 4: チャート描画のテスト

**Files:**
- Modify: `dashboard/e2e/dashboard.spec.ts`

- [ ] **Step 1: チャートテストを dashboard.spec.ts に追記**

`dashboard/e2e/dashboard.spec.ts` のファイル末尾に追加:

```typescript
test.describe('Chart rendering', () => {
  /**
   * What: "Memories per Day" 棒グラフが SVG 要素として描画される。
   * Why:  過去 30 日間のメモリ推移をユーザーが視覚的に確認するための主要チャート。
   * Risk: Recharts の動的インポートやデータ連携の不具合でチャートが表示されない。
   */
  test('renders bar chart for daily memories', async ({ page }) => {
    await mockAllApis(page)
    await page.goto('/')

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
    await page.goto('/')

    const chartSection = page.getByText('Source Breakdown').locator('..').locator('..')
    await expect(chartSection).toBeVisible()
    await expect(chartSection.locator('svg').first()).toBeVisible({ timeout: 10_000 })
  })
})
```

- [ ] **Step 2: テスト実行**

```bash
cd dashboard && npx playwright test -g "Chart rendering"
```

Expected: 2 テスト PASS

- [ ] **Step 3: コミット**

```bash
git add dashboard/e2e/dashboard.spec.ts
git commit -m "test(e2e): add chart rendering tests"
```

---

### Task 5: 検索・フィルターのテスト

**Files:**
- Modify: `dashboard/e2e/dashboard.spec.ts`

- [ ] **Step 1: 検索テストを追記**

`dashboard/e2e/dashboard.spec.ts` のファイル末尾に追加:

```typescript
test.describe('Search and filter', () => {
  /**
   * What: 検索入力後に Enter キーで検索が実行され、結果が表示される。
   * Why:  キーボード操作による検索はダッシュボードの主要ワークフロー。
   * Risk: Enter キーイベントが正しくハンドルされず、検索が実行されない。
   */
  test('searches by pressing Enter', async ({ page }) => {
    await mockAllApis(page)
    await page.goto('/')

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
    await page.goto('/')

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
    await page.goto('/')

    await expect(page.getByText('Conversation content number 1 for testing')).toBeVisible()

    const select = page.locator('select')
    await select.selectOption('claude')

    const visibleConversations = page.locator('text=Conversation content number')
    const count = await visibleConversations.count()

    expect(count).toBeGreaterThan(0)
    expect(count).toBeLessThan(50)
  })
})
```

- [ ] **Step 2: テスト実行**

```bash
cd dashboard && npx playwright test -g "Search and filter"
```

Expected: 3 テスト PASS

- [ ] **Step 3: コミット**

```bash
git add dashboard/e2e/dashboard.spec.ts
git commit -m "test(e2e): add search and filter tests"
```

---

### Task 6: ページネーションのテスト

**Files:**
- Modify: `dashboard/e2e/dashboard.spec.ts`

- [ ] **Step 1: ページネーションテストを追記**

`dashboard/e2e/dashboard.spec.ts` のファイル末尾に追加:

```typescript
test.describe('Pagination', () => {
  /**
   * What: Next ボタンで 2 ページ目に遷移し、Previous で 1 ページ目に戻れる。
   * Why:  大量の会話データをページ単位で閲覧するための必須機能。
   * Risk: offset の計算不具合やAPI 呼び出しの不具合でページ送りが機能しない。
   */
  test('navigates between pages with Next and Previous', async ({ page }) => {
    await mockAllApis(page)
    await page.goto('/')

    await expect(page.getByText('Conversation content number 1 for testing')).toBeVisible()

    const nextButton = page.getByRole('button', { name: 'Next' })
    await expect(nextButton).toBeEnabled()
    await nextButton.click()

    await expect(page.getByText('Page 2 conversation content number 51.')).toBeVisible()

    const prevButton = page.getByRole('button', { name: 'Previous' })
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
    await page.goto('/')

    await expect(page.getByText('Conversation content number 1 for testing')).toBeVisible()

    const prevButton = page.getByRole('button', { name: 'Previous' })
    await expect(prevButton).toBeDisabled()
  })
})
```

- [ ] **Step 2: テスト実行**

```bash
cd dashboard && npx playwright test -g "Pagination"
```

Expected: 2 テスト PASS

- [ ] **Step 3: コミット**

```bash
git add dashboard/e2e/dashboard.spec.ts
git commit -m "test(e2e): add pagination tests"
```

---

### Task 7: サイドバーのテスト

**Files:**
- Modify: `dashboard/e2e/dashboard.spec.ts`

- [ ] **Step 1: サイドバーテストを追記**

`dashboard/e2e/dashboard.spec.ts` のファイル末尾に追加:

```typescript
test.describe('Sidebar', () => {
  /**
   * What: サイドバーのナビゲーション項目をクリックするとアクティブ状態が切り替わる。
   * Why:  ユーザーが現在のセクションを視覚的に把握するための UI フィードバック。
   * Risk: activeSection の state 管理不具合でアクティブ表示が更新されない。
   */
  test('switches active navigation item on click', async ({ page }) => {
    await mockAllApis(page)
    await page.goto('/')

    const dashboardNav = page.getByRole('button', { name: 'ダッシュボード' })
    const conversationsNav = page.getByRole('button', { name: '会話検索・一覧' })
    const healthNav = page.getByRole('button', { name: 'システム状態' })

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
    await page.goto('/')

    const sidebar = page.locator('aside')
    const toggleButton = sidebar.locator('div.border-t button')
    const navLabel = page.getByText('ダッシュボード').first()

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
    await page.goto('/')

    const sidebar = page.locator('aside')
    const toggleButton = sidebar.locator('div.border-t button')
    const navLabel = page.getByText('ダッシュボード').first()

    await toggleButton.click()
    await expect(sidebar).toHaveClass(/w-16/)

    await toggleButton.click()
    await expect(sidebar).toHaveClass(/w-56/)
    await expect(navLabel).toBeVisible()
  })
})
```

- [ ] **Step 2: テスト実行**

```bash
cd dashboard && npx playwright test -g "Sidebar"
```

Expected: 3 テスト PASS

- [ ] **Step 3: コミット**

```bash
git add dashboard/e2e/dashboard.spec.ts
git commit -m "test(e2e): add sidebar navigation and collapse tests"
```

---

### Task 8: レスポンシブ表示のテスト

**Files:**
- Modify: `dashboard/e2e/dashboard.spec.ts`

- [ ] **Step 1: レスポンシブテストを追記**

`dashboard/e2e/dashboard.spec.ts` のファイル末尾に追加:

```typescript
test.describe('Responsive layout', () => {
  /**
   * What: デスクトップ幅（1280px）でヘルスカードが 6 列に表示される。
   * Why:  デスクトップでは全カードを一行で表示し、一覧性を最大化する。
   * Risk: grid-cols-6 の Tailwind クラスが正しく適用されない。
   */
  test('shows 6-column health cards on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await mockAllApis(page)
    await page.goto('/')

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
    await page.goto('/')

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
    await page.goto('/')

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
```

- [ ] **Step 2: テスト実行**

```bash
cd dashboard && npx playwright test -g "Responsive"
```

Expected: 3 テスト PASS

- [ ] **Step 3: コミット**

```bash
git add dashboard/e2e/dashboard.spec.ts
git commit -m "test(e2e): add responsive layout tests"
```

---

### Task 9: CI 統合

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: e2e-tests ジョブを ci.yml に追加**

`.github/workflows/ci.yml` の `build-check` ジョブの後に追加:

```yaml
  e2e-tests:
    name: Dashboard (Playwright)
    needs: [eslint, prettier]
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: dashboard
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v5
        with:
          node-version: 22
          cache: npm
          cache-dependency-path: dashboard/package-lock.json
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npx playwright test
      - uses: actions/upload-artifact@v5
        if: failure()
        with:
          name: playwright-report
          path: dashboard/test-results/
```

- [ ] **Step 2: 全テストをローカルで実行して最終確認**

```bash
cd dashboard && npx playwright test
```

Expected: 16 テスト全て PASS

- [ ] **Step 3: コミット**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add Playwright E2E test job to CI pipeline"
```
