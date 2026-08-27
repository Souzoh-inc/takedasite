# CLAUDE.md

このリポジトリで作業する Claude Code 向けの指示。**別端末のセッションでも、まずこれを読むこと。**

## このリポジトリについて

UNITE税理士法人（武田敏弘様）のコーポレートサイト。GitHub: `Souzoh-inc/takedasite`（main のみ運用）。

- **実装の唯一の正は `docs/要件定義書.md`。** §3「作らないもの」に挙がっているものを
  気を利かせて追加しないこと。§9 の未確定項目を推測で埋めないこと
- 推測で置いた値と未決事項は `docs/確認事項.md` にすべて載っている。値を変えたら必ず更新する
- 暫定URL: https://takedasite.souzohnic.workers.dev （独自ドメインは未取得）

## 最重要：毎回 push する

このリポジトリは**複数の端末・複数のセッションから編集される前提**で運用している。
ローカルにだけ変更が残っていると、他の端末から続きが編集できなくなる。

- **作業開始時**：必ず `git pull --rebase origin main`
- **作業の区切りごと**：`git add -A && git commit && git push origin main`
- 「あとでまとめて push」はしない。動く状態になったらその都度 push する

## 初回セットアップ（新しい端末で clone した直後に一度だけ）

`user.email` のグローバル設定が無い Mac だと、コミットが
`seiyakikuchi@<hostname>.local` 名義になる。また macOS キーチェーンに別の
GitHub アカウントの認証が残っていると push が 403 になるため、
**リポジトリローカルで**次を設定する。

```bash
git config user.name  "Souzoh-inc"
git config user.email "ai@souzoh-official.com"

# キーチェーンの旧アカウント認証を無効化してから gh の認証を使う
git config --add credential.https://github.com.helper ""
git config --add credential.https://github.com.helper "!gh auth git-credential"
```

push 権限があるのは GitHub アカウント **`Souzoh-inc`**。`gh auth status` で
active になっているか確認する。なっていなければ `gh auth switch --user Souzoh-inc`。

Cloudflare は `npx wrangler whoami` で
`Seiya.kikuchi@souzoh-official.com's Account`（`fa03cd9cababb13a09331265a38f4ed1`）
が見えていればよい。アカウントIDは `wrangler.jsonc` に直接書いてある。

## 構成

ビルド工程は無い。`public/` の中身がそのまま配信される。

```
public/
  index.html      トップ（1枚もの）
  privacy.html    プライバシーポリシー（叩き台。冒頭に社内向け注記あり＝公開前に削除）
  404.html
  robots.txt      全クローラー拒否
  assets/style.css  デザイントークンと全スタイル
  assets/site.js    メニュー / お知らせ取得 / フォーム送信
src/worker.js     /api/news と /api/contact。静的アセットの配信も通す
wrangler.jsonc
docs/要件定義書.md   実装の唯一の正
docs/確認事項.md     未決事項と、推測で置いた値の一覧
```

### 開発・デプロイ

```bash
npx wrangler dev --port 8788 --local   # ローカル
npx wrangler deploy                    # 本番
```

### 画面の目視確認

このMacでは Chrome 拡張のスクリーンショットが失敗するため Playwright を使う。
`~/casta/node_modules/playwright` に入っているものをそのまま読める。
`page.on('pageerror')` を必ず拾うこと。

## 既知の落とし穴

- **`assets.run_worker_first: true` を外さないこと。** これが無いと静的アセットが
  Worker を通らず、`X-Robots-Tag: noindex` が付かない。このサイトは一般公開しない
  運用（要件定義書 §1）なので、noindex は必須要件
- **`compatibility_date` を未来の日付にしない。** ローカルの workerd が対応していない
  日付だと `wrangler dev` が起動しない（`2026-08-01` で踏んだ）
- **`seiyakikuchi1003` アカウントは push できないことがある。** 403 になったら
  まず active な gh アカウントを疑う。`credential....helper ""`（空文字）を先に
  入れないと osxkeychain の古い資格情報が優先される
- **登場アニメに `animation-fill-mode: both` を使わない。** `.reveal` は
  IntersectionObserver ＋ `transition` で実装してある
- アクセントカラーは参考デザインより濃い。理由は `docs/確認事項.md` D-1

## シークレット（未設定）

`wrangler.jsonc` の `vars` は公開値のみ。以下は `npx wrangler secret put <名前>` で入れる。

| 名前 | 用途 |
|---|---|
| `MICROCMS_API_KEY` | お知らせの取得。未設定のうちは「お知らせはありません」を表示する |
| `LARK_APP_ID` / `LARK_APP_SECRET` | Lark Base への送信 |
| `LARK_BASE_APP_TOKEN` / `LARK_BASE_TABLE_ID` | 送信先のテーブル |

**Lark 未設定のあいだ、問い合わせは KV（`INQUIRIES`）にのみ溜まる。** 取りこぼしは
しないが通知は飛ばない。確認コマンドは `docs/確認事項.md` C-2 を参照。
