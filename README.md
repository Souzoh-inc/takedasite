# takedasite

武田さんサイト。

## セットアップ（別端末で作業を始めるとき）

```bash
git clone https://github.com/Souzoh-inc/takedasite.git
cd takedasite
```

このリポジトリは **Souzoh-inc** アカウントに push 権限があります。
初回のみ、リポジトリローカルに以下を設定してください（`CLAUDE.md` に詳細）。

```bash
git config user.name  "Souzoh-inc"
git config user.email "ai@souzoh-official.com"
git config --add credential.https://github.com.helper ""
git config --add credential.https://github.com.helper "!gh auth git-credential"
```

## 作業のルール

- 作業は必ず `main` に対して行い、**区切りごとに commit して push** する
- push しておけば別端末・別の Claude Code セッションからそのまま続きを編集できる
- 作業を始める前に必ず `git pull --rebase origin main` で最新を取り込む

## 構成

（構築中）
