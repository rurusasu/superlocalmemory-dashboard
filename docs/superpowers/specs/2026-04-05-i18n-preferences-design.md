# 言語切り替え + Preferences パネル 設計

## 概要

ダッシュボードのUI言語を日本語/英語で切り替え可能にする。サイドバー下部から Preferences モーダルを開き、言語設定の変更とバックエンド設定の読み取り表示を行う。

## 方針

- **i18n**: React Context + シンプルなオブジェクトマップ。i18nライブラリは不使用。
- **永続化**: localStorage（キー: `slm-locale`）、デフォルト英語
- **Preferences**: モーダル形式。Language は変更可能、System Info は読み取り専用。

## ファイル構成

| ファイル | 責務 |
|---------|------|
| `app/i18n/translations.ts` | 翻訳データ（en/ja の全UIテキスト） |
| `app/i18n/LocaleContext.tsx` | Context + Provider + `useLocale` hook（`locale`, `setLocale`, `t()` を提供） |
| `app/components/PreferencesModal.tsx` | Preferences モーダル（Language 切り替え + System Info 表示） |
| `app/components/Sidebar.tsx` | 歯車アイコンボタン追加、PreferencesModal のトリガー |
| `app/page.tsx` | ハードコード文字列を `t()` に置換 |
| `app/layout.tsx` | LocaleProvider でラップ、`html lang` を動的に設定 |

## 翻訳データ構造（translations.ts）

```typescript
export type Locale = 'en' | 'ja'

export const translations: Record<Locale, Record<string, string>> = {
  en: {
    // Sidebar
    'nav.dashboard': 'Dashboard',
    'nav.conversations': 'Conversations',
    'nav.health': 'System Health',
    'nav.preferences': 'Preferences',

    // Header
    'header.profile': 'Profile',

    // Health cards
    'health.status': 'Status',
    'health.ollama': 'Ollama',
    'health.database': 'Database',
    'health.facts': 'Facts',
    'health.entities': 'Entities',
    'health.disk': 'Disk',

    // Charts
    'chart.memoriesPerDay': 'Memories per Day',
    'chart.last30days': 'Last 30 days',
    'chart.sourceBreakdown': 'Source Breakdown',

    // Search
    'search.title': 'Search',
    'search.placeholder': 'Search conversations...',
    'search.allSources': 'All sources',
    'search.button': 'Search',

    // Conversations
    'conversations.title': 'Conversations',
    'conversations.empty': 'No conversations found.',
    'conversations.previous': 'Previous',
    'conversations.next': 'Next',
    'conversations.page': 'Page',

    // Preferences
    'preferences.title': 'Preferences',
    'preferences.language': 'Language',
    'preferences.systemInfo': 'System Info',
    'preferences.mode': 'Mode',
    'preferences.ollamaHost': 'Ollama Host',
    'preferences.model': 'Model',
    'preferences.close': 'Close',
  },
  ja: {
    'nav.dashboard': 'ダッシュボード',
    'nav.conversations': '会話検索・一覧',
    'nav.health': 'システム状態',
    'nav.preferences': '設定',

    'header.profile': 'プロファイル',

    'health.status': 'ステータス',
    'health.ollama': 'Ollama',
    'health.database': 'データベース',
    'health.facts': 'ファクト',
    'health.entities': 'エンティティ',
    'health.disk': 'ディスク',

    'chart.memoriesPerDay': '1日あたりのメモリ数',
    'chart.last30days': '過去30日間',
    'chart.sourceBreakdown': 'ソース内訳',

    'search.title': '検索',
    'search.placeholder': '会話を検索...',
    'search.allSources': 'すべてのソース',
    'search.button': '検索',

    'conversations.title': '会話',
    'conversations.empty': '会話が見つかりません。',
    'conversations.previous': '前へ',
    'conversations.next': '次へ',
    'conversations.page': 'ページ',

    'preferences.title': '設定',
    'preferences.language': '言語',
    'preferences.systemInfo': 'システム情報',
    'preferences.mode': 'モード',
    'preferences.ollamaHost': 'Ollama ホスト',
    'preferences.model': 'モデル',
    'preferences.close': '閉じる',
  },
}
```

## LocaleContext（LocaleContext.tsx）

- `LocaleProvider`: children をラップ。localStorage から初期値を読み取り、なければ `'en'`。
- `useLocale()`: `{ locale, setLocale, t }` を返す。
- `t(key)`: 現在の locale の翻訳データから key に対応する文字列を返す。キーが見つからない場合はキーそのものを返す。
- `setLocale(locale)`: state を更新し、localStorage に保存。

## PreferencesModal（PreferencesModal.tsx）

- props: `isOpen`, `onClose`, `health` (HealthData | null)
- オーバーレイ + 中央モーダル（ダークテーマ、既存カードスタイルに合わせる）
- セクション1 — Language: `English` / `日本語` のセレクトボックス
- セクション2 — System Info（読み取り専用、health データから表示）:
  - Mode: `health.mode`
  - Profile: `health.profile`
  - Ollama Host: 表示のみ（環境変数由来、health APIには含まれないため「-」表示）
  - Model: 表示のみ（同上）
- Close ボタン、またはオーバーレイクリックで閉じる
- ESC キーでも閉じる

## Sidebar 変更

- 折りたたみトグルの上に歯車アイコン + "Preferences" ボタンを追加
- クリックで PreferencesModal を開く
- 折りたたみ時は歯車アイコンのみ表示
- ナビゲーション項目のラベルを `t()` に置換

## page.tsx 変更

- `useLocale()` から `t` を取得
- 全ハードコード文字列を `t('key')` に置換
- 検索プレースホルダー、ボタンテキスト、カードラベル、チャートタイトルなど

## layout.tsx 変更

- `LocaleProvider` で children をラップ
- `html lang` 属性を動的に設定するため、layout を client component にするか、lang 設定は LocaleProvider 内の useEffect で `document.documentElement.lang` を更新する

## テスト影響

- 既存 Vitest テスト: 英語デフォルトで動作するため変更不要
- 既存 E2E テスト: 英語デフォルトで動作するため変更不要
- 新規テスト: Preferences モーダルの開閉と言語切り替えの E2E テストを追加
