# CLAUDE.md

このリポジトリで作業する Claude Code 向けの指示。**別端末のセッションでも、まずこれを読むこと。**

## このリポジトリについて

武田さんサイト。GitHub: `Souzoh-inc/takedasite`（main ブランチのみ運用）。

## 最重要：毎回 push する

このリポジトリは**複数の端末・複数のセッションから編集される前提**で運用している。
ローカルにだけ変更が残っていると、他の端末から続きが編集できなくなる。

- **作業開始時**：必ず `git pull --rebase origin main`
- **作業の区切りごと**：`git add -A && git commit && git push origin main`
- 「あとでまとめて push」はしない。動く状態になったらその都度 push する

## 初回セットアップ（新しい端末で clone した直後に一度だけ）

`user.email` のグローバル設定が無い Mac だと、コミットが
`seiyakikuchi@<hostname>.local` 名義になり、デプロイ先によっては弾かれる。
また macOS キーチェーンに別の GitHub アカウントの認証が残っていると push が
403 になるため、**リポジトリローカルで**次を設定する。

```bash
git config user.name  "Souzoh-inc"
git config user.email "ai@souzoh-official.com"

# キーチェーンの旧アカウント認証を無効化してから gh の認証を使う
git config --add credential.https://github.com.helper ""
git config --add credential.https://github.com.helper "!gh auth git-credential"
```

push 権限があるのは GitHub アカウント **`Souzoh-inc`**。
`gh auth status` で active になっているか確認する。なっていなければ
`gh auth switch --user Souzoh-inc`。

## 既知の落とし穴

- `seiyakikuchi1003` アカウントは Souzoh-inc 配下のリポジトリに read-only のことがある。
  push が 403 になったら、まず active な gh アカウントを疑う
- `git config --add credential....helper ""`（空文字）を先に入れないと、
  osxkeychain の古い資格情報が優先されて gh の認証が使われない

## 構成

（構築中。決まり次第ここに追記する）
