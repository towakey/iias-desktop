# IIAS Chrome Extension

ブラウザで訪問したページを IIAS API (`/api/archives`) に自動送信する Chrome 拡張機能です。

## セットアップ

1. Chrome の `chrome://extensions/` を開く
2. 右上の「デベロッパーモード」を ON
3. 「パッケージ化されていない拡張機能を読み込む」で `chrome-extension` フォルダを選択
4. 拡張機能アイコンをクリックし、API ベース URL と認証トークンを入力して保存

## 権限

- `history`：訪問ページの検知
- `storage`：トークン・API URL の保存

## 送信内容

`POST /api/archives`

- `archive_type`: `web`
- `title`: ページタイトル
- `url`: ページ URL
- `recorded_at`: 訪問日時
