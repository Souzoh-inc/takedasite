# takedasite

UNITE税理士法人（武田敏弘様）コーポレートサイト。

- 暫定URL: https://takedasite.souzohnic.workers.dev
- 要件定義書: [`docs/要件定義書.md`](docs/要件定義書.md) ← 実装の唯一の正
- 未決事項: [`docs/確認事項.md`](docs/確認事項.md)

## 開発

ビルド工程はありません。`public/` の中身がそのまま配信されます。

```bash
git clone https://github.com/Souzoh-inc/takedasite.git
cd takedasite
npx wrangler dev --port 8788 --local   # http://127.0.0.1:8788
npx wrangler deploy                    # 本番へ反映
```

## 作業のルール

- 作業は `main` に対して行い、**区切りごとに commit して push** する
- 作業を始める前に `git pull --rebase origin main`
- 初回のみ、リポジトリローカルの git 設定が必要（[`CLAUDE.md`](CLAUDE.md) 参照）

## 構成

| パス | 内容 |
|---|---|
| `public/index.html` | トップページ（1枚もの） |
| `public/privacy.html` | プライバシーポリシー（叩き台） |
| `public/assets/style.css` | デザイントークンと全スタイル |
| `public/assets/site.js` | メニュー / お知らせ取得 / フォーム送信 |
| `src/worker.js` | `/api/news`（microCMS）と `/api/contact`（Lark Base + KV） |
