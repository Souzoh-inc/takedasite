# CLAUDE.md

このリポジトリで作業する Claude Code 向けの指示。**別端末のセッションでも、まずこれを読むこと。**

## 現在地（2026-10-19 時点）

**技術的な構築はひととおり終わっている。** 残っているのは武田様からの情報待ちと、
画面操作が必要なものだけ。詳細は `docs/確認事項.md`。

| 項目 | 状態 |
|---|---|
| サイト本体（**B案ベース**・noindex・レスポンシブ） | ✅ 10/3 修正事項でC案→B案に変更 |
| 問い合わせフォーム → Lark Base（添付含む） | ✅ 実送信で確認済み |
| お知らせ → microCMS | ✅ 実表示で確認済み |
| 武田様の Cloudflare アカウントへ移管 | ✅ |
| 10/3 修正事項（Service をA案に・Case 削除・文言・名称） | ✅ 反映済み・**本番デプロイ済み**（10/19） |
| 10/3 修正事項①：B案ベース＋重厚感を減らす | ✅ 参考デザイン: https://unite-design3.pages.dev/ （A/B/C 案） |
| 事務所名 | ✅ **「武田敏弘税理士事務所」で確定**（10/3） |
| 所在地・電話・メール等の基本情報 | ⏳ 武田様待ち |
| ドメイン取得（Cloudflare で `.com`） | ⏳ 名前が未決 |
| microCMS のテストコンテンツ差し替え | ⏳ 画面操作が必要 |
| 旧 Worker（`takedasite.souzohnic.workers.dev`）の削除 | ⏳ まだ生きている |
| ステータス管理・対応期日の自動通知 | ⏳ 仕様未決（MTGで決める） |

**当初の納品日（10/9）は経過。** 10/19 16:00 に武田様とMTG。新しい納品日は基本情報・ドメイン名の受領時期しだい。

### 作業記録

**2026-10-19（Windows 端末・海野さんのアカウント）**

- 武田様の修正事項（`20261003　修正事項.docx`、リポジトリ外）を反映。コミット `29ae611` / `b861a28`
  - B案ベースに変更し重厚感を抑えた／Service を A案の3カードに／Case 削除／文言差し替え／名称確定
  - 参考デザイン（A/B/C案）: https://unite-design3.pages.dev/
- README の暫定URL、`docs/確認事項.md` の KV namespace ID を移管後の値に修正
- `npx wrangler deploy` で本番へ反映（Version `93e43ad0-f1ea-412b-ab0f-2048bea47c5c`）。
  タイトル・ヒーロー画像・Case 削除・`X-Robots-Tag: noindex` を本番で確認済み
- ソウゾウCRM（案件 `takeda-site`）のタスクを更新
  - 完了: お問い合わせフォームの設計／会社概要セクションの設計／掲載サービスの文言候補／
    【武田様】掲載サービスの一覧と並び順／【武田様】デザイン選定／【武田様】1回目の修正点の返送／
    スマホ表示確認／1回目の修正反映
  - 顧客待ち: 【武田様】事務所の基本情報（進行中）／会社概要セクションの実装（進行中）／【武田様】ドメイン名の決定
  - 案件の期日・工程の日付（7月の当初予定のまま）は未修正
- 旧 Worker（`takedasite.souzohnic.workers.dev`）は修正前のまま残っている（未削除）

**Windows 端末での注意**：Claude Code の自動モードでは `npx wrangler deploy` が安全チェックで止められる。
プロンプト欄で `! npx wrangler deploy` のように本人が実行する。

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
