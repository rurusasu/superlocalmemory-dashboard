# semantic-release + Docker 自動バージョン管理 設計

## 概要

Conventional Commits + semantic-release でバージョン管理を自動化する。main へのマージ時にバージョンを自動計算し、Git タグ・GitHub Release Notes・Docker イメージのビルド＆プッシュを一気通貫で実行する。

## 前提

- GitHub リポジトリは squash merge のみ許可に設定済み
- squash コミットのタイトル = PR タイトル（Conventional Commits 形式）
- Docker Hub の credentials（DOCKERHUB_USERNAME, DOCKERHUB_TOKEN）は既に GitHub Secrets に設定済み

## フロー

```
PR merge to main (squash)
  → コミットメッセージ = PR タイトル (e.g., "feat: add i18n support")
  → semantic-release がコミット解析
  → 新バージョンあり？
    → Yes:
      → package.json バージョン更新（コミット）
      → Git タグ作成 (v1.2.3)
      → GitHub Release + Release Notes 自動生成
      → Docker build (タグ: v1.2.3, latest)
      → Docker Hub push
    → No:
      → Security scan のみ実行（既存動作）
```

## Conventional Commits ルール

| プレフィックス | バージョンバンプ | 例 |
|-------------|---------------|---|
| `feat:` | minor (0.x.0) | feat: add settings modal |
| `fix:` | patch (0.0.x) | fix: correct health check |
| `feat!:` or `BREAKING CHANGE:` | major (x.0.0) | feat!: redesign API |
| `chore:`, `docs:`, `test:`, `ci:`, `refactor:` | リリースなし | chore: update deps |

## ファイル変更

### 新規: `.releaserc.json`

semantic-release の設定ファイル。プラグイン構成：

1. `@semantic-release/commit-analyzer` — コミットメッセージからバージョンバンプの種類を決定
2. `@semantic-release/release-notes-generator` — Release Notes を生成
3. `@semantic-release/npm` — package.json のバージョンを更新（npm publish はしない）
4. `@semantic-release/github` — GitHub Release を作成
5. `@semantic-release/git` — package.json の変更をコミットしてプッシュ

```json
{
  "branches": ["main"],
  "plugins": [
    "@semantic-release/commit-analyzer",
    "@semantic-release/release-notes-generator",
    ["@semantic-release/npm", { "npmPublish": false }],
    "@semantic-release/github",
    ["@semantic-release/git", {
      "assets": ["dashboard/package.json", "dashboard/package-lock.json"],
      "message": "chore(release): ${nextRelease.version} [skip ci]"
    }]
  ]
}
```

注意: package.json は `dashboard/` 配下にあるため、`@semantic-release/npm` の `pkgRoot` を `dashboard` に設定する必要がある。

### 変更: `.github/workflows/docker-publish.yml`

主な変更点：

1. **release ジョブを追加** — main push 時に最初に実行。semantic-release を実行し、新バージョンを outputs で後続ジョブに渡す。
2. **`v*` タグトリガーを削除** — semantic-release がタグを打つため不要。タグトリガーが残ると二重実行になる。
3. **build ジョブ** — release ジョブの出力（新バージョンの有無）に基づいて条件実行。
4. **Docker タグ** — `v1.2.3` + `latest` を semantic-release が決めたバージョンから生成。
5. **push ジョブ** — 既存の `startsWith(github.ref, 'refs/tags/')` 条件を削除し、release ジョブが新バージョンを出力した場合に実行。

### ワークフロー構造（main push 時）

```
Security (trivy-config, trivy-fs, npm-audit) — 並列実行
  ↓
Release (semantic-release) — Security 完了後
  ↓ (新バージョンがある場合のみ)
Build + Smoke test
  ↓
Image scan (Trivy)
  ↓
Push to Docker Hub (タグ: v1.2.3, latest)
```

### permissions

semantic-release が Git タグ・Release 作成・package.json コミットを行うため:
- `contents: write`（既存は `contents: read`）

### Docker イメージタグ

- `rurusasu/superlocalmemory-dashboard:v1.2.3`
- `rurusasu/superlocalmemory-dashboard:latest`

## npm devDependencies（dashboard/）

```
semantic-release
@semantic-release/commit-analyzer
@semantic-release/release-notes-generator
@semantic-release/npm
@semantic-release/github
@semantic-release/git
```

## 初回バージョン

現在 `dashboard/package.json` は `0.1.0`。semantic-release は既存の Git タグを起点にするため、初回は `git tag v0.1.0` を手動で打って起点を作る。次の feat コミットで `v0.2.0`、fix で `v0.1.1` になる。

## スケジュールトリガー

週次セキュリティスキャン（cron）はそのまま維持。release ジョブは `push to main` 時のみ実行（`if: github.event_name == 'push'`）。

## テスト影響

- CI（ci.yml）は変更なし
- docker-publish.yml の変更はワークフロー構造のみ
- ローカルテストへの影響なし
