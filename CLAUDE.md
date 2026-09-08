# CLAUDE.md

このリポジトリで作業する Claude Code 向けの指示。**別端末のセッションでも、まずこれを読むこと。**

## 現在地（2026-09-08 時点）

**技術的な構築はひととおり終わっている。** 残っているのは武田様からの情報待ちと、
画面操作が必要なものだけ。詳細は `docs/確認事項.md`。

| 項目 | 状態 |
|---|---|
| サイト本体（C案・noindex・レスポンシブ） | ✅ |
| 問い合わせフォーム → Lark Base（添付含む） | ✅ 実送信で確認済み |
| お知らせ → microCMS | ✅ 実表示で確認済み |
| 武田様の Cloudflare アカウントへ移管 | ✅ |
| 事務所の正式名称・基本情報 | ⏳ 武田様待ち。**「武田税理士事務所」で仮置き中** |
| 事例の数値4件 | ⏳ ダミーと画面上に明示してある |
| ドメイン取得（Cloudflare で `.com`） | ⏳ 名前が未決 |
| microCMS のテストコンテンツ差し替え | ⏳ 画面操作が必要 |
| 旧 Worker（`takedasite.souzohnic.workers.dev`）の削除 | ⏳ まだ生きている |
| ステータス管理・対応期日の自動通知 | ⏳ 10/1 のMTGで仕様を決めてから |

**次の期日は 9/18（金）＝武田様へ提出、10/1（木）14:00 が第3回MTG、10/9（金）納品。**

## このリポジトリについて

UNITE税理士法人（武田敏弘様）のコーポレートサイト。GitHub: `Souzoh-inc/takedasite`（main のみ運用）。

- **実装の唯一の正は `docs/要件定義書.md`。** §3「作らないもの」に挙がっているものを
  気を利かせて追加しないこと。§9 の未確定項目を推測で埋めないこと
- 推測で置いた値と未決事項は `docs/確認事項.md` にすべて載っている。値を変えたら必ず更新する
- 暫定URL: **https://takedasite.t-takeda-tax-office.workers.dev** （独自ドメインは未取得）

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
**`T.takeda.tax.office@gmail.com's Account`（`0e5afad5b6fd94861d5553599330918c`）**
が見えていればよい。アカウントIDは `wrangler.jsonc` に直接書いてある。

**2026-09-08 に菊池さんのアカウントから武田様のアカウントへ移管した。**
見えない場合は `npx wrangler login` でトークンを取り直す。承認画面で武田様の
アカウントにチェックを入れること。なお `wrangler login` は落とし穴が多い。

- 中断すると **ポート8976 を掴んだプロセスが残り**、次回が
  「port is already in use」で落ちる。`lsof -nP -iTCP:8976 -sTCP:LISTEN` で見て kill する
- 古い認証タブで承認すると
  「Received query string parameter doesn't match」（state 不一致）になる。
  **必ずその回に開いたタブで承認する**
- 承認に手間取ると「Timed out waiting for authorization code」で落ちる。
  ブラウザが開かないときは、出力の URL をアドレスバーに直接貼れば同じプロセスで通る

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
scripts/setup-lark-base.mjs  Lark Base のテーブル列を worker に合わせて用意する
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

## シークレット（すべて設定済み）

`wrangler.jsonc` の `vars` は公開値のみ。**このリポジトリは public なので、
microCMS のサービスドメインも vars ではなく secret に入れてある。**
値の確認は `npx wrangler secret list`（名前だけ。値は取り出せない）。

| 名前 | 用途 | 状態 |
|---|---|---|
| `MICROCMS_SERVICE_DOMAIN` / `MICROCMS_API_KEY` | お知らせの取得 | **設定済み**（2026-09-08） |
| `LARK_APP_ID` / `LARK_APP_SECRET` | Lark Base への送信 | **設定済み**（2026-09-08） |
| `LARK_BASE_APP_TOKEN` / `LARK_BASE_TABLE_ID` | 送信先のテーブル | **設定済み**（2026-09-08） |

**Lark 連携は 2026-09-08 に完了した。** 武田様の Base
（`SGX9bDklBa0dZGsUCuujt1pKpkg` / `tblXhWQ6LKqb7wgY`、日本リージョンの larksuite）に
8列を作成し、本番サイトのフォームから実送信して
`{"ok":true,"stored":true,"delivered":true}` とレコード生成（添付ファイル含む）まで
確認済み。確認に使ったレコードと KV の控えは削除済み。

**microCMS も 2026-09-08 に接続した。** エンドポイントは `news`（リスト形式）、
フィールドは `title`（必須）と `url`（任意）。日付は microCMS 標準の `publishedAt`。
`url` は http(s) で始まるものだけリンクにする（相対パスや誤入力を弾く）。

なお、疎通確認の過程でこちらが作った仮の Lark Base
（`FN3xbnECHa7oYFsTTIZjlB61pNc`）が残っている。**もう使っていない。**
アプリに drive スコープが無いため API からは削除できないので、放置してある。
シークレットが誤ってこちらを向いていないか疑うときの目印として書き残す。

### secret put の落とし穴

`printf 'x' | npx wrangler secret put NAME` は、**成功メッセージを出さずに
失敗することがある**（2026-09-08 に `MICROCMS_SERVICE_DOMAIN` で踏んだ）。
投入後は必ず `npx wrangler secret list` に名前が出ているか確かめること。
`/api/news` は 5分間 `caches.default` に載るので、**設定が抜けていても
しばらく正常に見えてしまう**。確認はクエリを変えて
`curl ".../api/news?v=$(date +%s)"` とする。
