# Playwright E2E テスト設計

## 概要

SLM Dashboard に Playwright による E2E テストを追加する。
GitHub Actions 上での安定実行を前提に、全 API レスポンスをモックし、slm/Ollama 依存を排除する。

## 方針

- **API モック**: `page.route()` で `/dashboard/api/*` をインターセプトし、固定 JSON を返す
- **サーバー起動**: Playwright の `webServer` 設定で `npm run dev` を自動起動
- **ブラウザ**: Chromium のみ（CI コスト最小化）
- **テストコメント**: 既存の Vitest テストと同じ What/Why/Risk 形式の JSDoc を付与

## ファイル構成

```
dashboard/
  e2e/
    dashboard.spec.ts    # 全テストケース
    fixtures.ts          # モックデータ定義（HealthData, Conversations, Stats）
  playwright.config.ts   # Playwright 設定
  package.json           # @playwright/test を devDependencies に追加、e2e スクリプト追加
```

## モックデータ（fixtures.ts）

### healthData
```json
{
  "status": "healthy",
  "ollama": "connected",
  "database": "ok",
  "diskUsage": "1.2 GB",
  "factCount": 42,
  "entityCount": 15,
  "mode": "b",
  "profile": "default",
  "dbSize": "50 MB",
  "timestamp": "2026-04-05T12:00:00Z"
}
```

### degradedHealthData
status を `"degraded"`、ollama を `"disconnected"` に変えたバリアント。ステータスカード色変化テスト用。

### conversationsData
50 件の会話 + `hasMore: true` + `total: 120`。ページネーションテスト用。

### statsData
`dailyCounts`（30 日分）と `sourceCounts`（3 ソース）。チャート描画テスト用。

## テストケース

### 1. ページ表示・ヘルスカード
| # | テスト | 検証内容 |
|---|--------|----------|
| 1.1 | ダッシュボード表示 | h1 "SLM Dashboard" が表示される |
| 1.2 | ヘルスカード 6 枚表示 | Status, Ollama, Database, Facts, Entities, Disk が存在 |
| 1.3 | healthy 時の色 | ステータスカードが emerald 系の色を持つ |
| 1.4 | degraded 時の色 | API を degraded データに差し替え → amber 系に変化 |

### 2. チャート描画
| # | テスト | 検証内容 |
|---|--------|----------|
| 2.1 | 棒グラフ表示 | "Memories per Day" セクションと SVG 要素が存在 |
| 2.2 | ドーナツチャート表示 | "Source Breakdown" セクションと SVG 要素が存在 |

### 3. 検索・フィルター
| # | テスト | 検証内容 |
|---|--------|----------|
| 3.1 | Enter で検索 | 入力 → Enter → API が `q` パラメータ付きで呼ばれる |
| 3.2 | ボタンで検索 | Search ボタンクリック → 同上 |
| 3.3 | ソースフィルター | セレクトボックスで絞り込み → 表示件数が変化 |

### 4. ページネーション
| # | テスト | 検証内容 |
|---|--------|----------|
| 4.1 | Next/Previous | Next クリック → offset 変化 → Previous が有効化 |
| 4.2 | 先頭ページ | offset=0 で Previous が disabled |

### 5. サイドバー
| # | テスト | 検証内容 |
|---|--------|----------|
| 5.1 | ナビゲーション | 各メニュークリック → アクティブ状態が切り替わる |
| 5.2 | 折りたたみ | トグルボタン → サイドバー幅が縮小 → アイコンのみ表示 |
| 5.3 | 折りたたみ復元 | 再クリック → 元の幅に戻る、ラベルが再表示 |

### 6. レスポンシブ
| # | テスト | 検証内容 |
|---|--------|----------|
| 6.1 | デスクトップ (1280px) | ヘルスカードが 6 列表示 |
| 6.2 | タブレット (768px) | ヘルスカードが 3 列表示 |
| 6.3 | モバイル (375px) | ヘルスカードが 2 列表示 |

## playwright.config.ts

```typescript
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: 1,
  use: {
    baseURL: 'http://localhost:3000/dashboard',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
  webServer: {
    command: 'npm run dev',
    port: 3000,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
})
```

## CI 統合（ci.yml）

新しいジョブ `e2e-tests` を追加：

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

- `needs: [eslint, prettier]` で lint 完了後に実行（既存パターンと同一）
- 失敗時のみスクリーンショット・トレースをアーティファクトとしてアップロード

## package.json 変更

```json
{
  "devDependencies": {
    "@playwright/test": "^1.52.0"
  },
  "scripts": {
    "e2e": "playwright test",
    "e2e:ui": "playwright test --ui"
  }
}
```
