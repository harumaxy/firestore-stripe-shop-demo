# firestore-stripe-shop-demo

Firebase Firestore + Stripe を使ったデジタル商品ストアのデモ実装。

**デモ:** https://firestore-stripe-shop-demo.vercel.app/

---

## 技術スタック

| カテゴリ | 技術 |
|---------|------|
| Framework | Next.js 15 (App Router) |
| DB | Firebase Firestore |
| 認証 | Firebase Authentication |
| 決済 | Stripe Checkout |
| スタイリング | Tailwind CSS |
| デプロイ | Vercel |

## 機能

- 商品一覧表示（Firestoreから取得）
- メール/パスワード認証（未ログインはログイン画面にリダイレクト）
- Stripe Checkout による決済
- Webhook による決済確定 + Firestore への注文書き込み
- 購入済み商品のバッジ表示・重複購入防止

## アーキテクチャ

```
[Firestore] products
    ↓
[Next.js] 商品一覧
    ↓ 購入ボタン
[/api/checkout] Stripe Checkout Session 作成
    ↓
[Stripe] 決済（テストカード: 4242 4242 4242 4242）
    ↓ Webhook
[/api/webhook] 署名検証 → Firestore orders に書き込み
```

## セットアップ

```bash
bun install
cp .env.example .env.local
# .env.local に各種キーを設定
```

### Firebase Emulator 起動

```bash
bunx firebase emulators:start
# UI: http://localhost:4000
```

### サンプルデータ投入

```bash
bun run seed          # エミュレータ
bun run seed:prod     # 本番Firestore
```

### Stripe Webhook ローカル受信

```bash
bun run stripe:listen
```

### 開発サーバー起動

```bash
bun dev
```

## 環境変数

`.env.example` を参照。
