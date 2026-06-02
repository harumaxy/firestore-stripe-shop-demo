# デジタル商品ストア（Firestore + Stripe サンプルアプリ）

面談デモ用のサンプル実装。Firestore の設計・チューニングと Stripe 決済組み込みの知見を示すことを目的とする。

---

## 技術スタック

| カテゴリ | 技術 |
|---------|------|
| Framework | Next.js 15 (App Router) |
| 言語 | TypeScript |
| DB | Firebase Firestore |
| 決済 | Stripe |
| スタイリング | Tailwind CSS |
| パッケージマネージャ | bun |
| デプロイ | Vercel（任意） |

---

## アーキテクチャ概要

```
[Firestore] products コレクション（商品一覧）
    ↓ 読み取り
[Next.js フロント] 商品カード一覧表示
    ↓ 「購入する」ボタン
[API Route] POST /api/checkout → Stripe Checkout Session 作成
    ↓ リダイレクト
[Stripe] 決済処理（テストカード: 4242 4242 4242 4242）
    ↓ Webhook
[API Route] POST /api/webhook → 署名検証 → Firestore orders に書き込み
    ↓
[Firestore] orders コレクション（購入履歴）
```

---

## Firestore データ設計

### products コレクション

```
/products/{productId}
  - name:        string       // 商品名
  - price:       number       // 価格（円）
  - description: string       // 商品説明
  - imageUrl:    string       // 画像URL
```

**設計のポイント：**
- 商品一覧は常にまとめて取得するためトップレベルコレクションに配置
- 読み取りパターンが「全件取得」のみのため複合インデックス不要

### orders コレクション

```
/orders/{orderId}
  - productId:       string                    // 購入商品ID
  - amount:          number                    // 決済金額
  - status:          "pending" | "paid"        // 決済ステータス
  - stripeSessionId: string                    // Stripe セッションID（冪等性確保）
  - createdAt:       Timestamp                 // 作成日時
```

**設計のポイント：**
- `stripeSessionId` をユニークキーとして重複書き込みを防止（冪等性）
- `status` フィールドで Webhook 受信前後の状態を管理
- 将来的にユーザーIDでフィルタするなら `userId` + `createdAt` の複合インデックスを追加

---

## セットアップ

### 前提条件

```bash
# Firebase CLI
npm install -g firebase-tools
firebase login

# Stripe CLI
brew install stripe/stripe-cli/stripe
stripe login
```

### インストール

```bash
git clone <repo-url>
cd <repo>
bun install
```

### 環境変数

`.env.local` を作成：

```env
# Firebase
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=

# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...   # stripe listen コマンドで発行される
```

### Firebase Emulator 起動

```bash
firebase init emulators    # 初回のみ。Firestore を選択
firebase emulators:start
# UI: http://localhost:4000
# Firestore: localhost:8080
```

### Stripe Webhook ローカル受信

```bash
stripe listen --forward-to localhost:3000/api/webhook
# 表示される whsec_... を STRIPE_WEBHOOK_SECRET に設定
```

### 開発サーバー起動

```bash
bun dev
```

---

## Firestore エミュレータ接続設定

```ts
// lib/firebase.ts
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const db = getFirestore(app);

if (process.env.NODE_ENV === "development") {
  connectFirestoreEmulator(db, "localhost", 8080);
}
```

---

## Stripe テストカード

| カード番号 | 挙動 |
|-----------|------|
| `4242 4242 4242 4242` | 決済成功 |
| `4000 0000 0000 0002` | カード拒否 |
| `4000 0025 0000 3155` | 3Dセキュア認証が必要 |

有効期限：未来の日付なら何でもOK / CVC：任意の3桁

---

## 実装ステップ（優先順）

- [ ] 1. Firebase Emulator 起動・Firestore 接続確認
- [ ] 2. products コレクションにサンプルデータ投入、フロントに一覧表示
- [ ] 3. `/api/checkout` — Stripe Checkout Session 作成
- [ ] 4. 決済成功後のサンクスページ
- [ ] 5. `/api/webhook` — Stripe 署名検証 → Firestore orders 書き込み

---

## Stripe 決済フローのポイント（面談で語れる点）

- **カード情報をサーバーで持たない**：Stripe Checkout に完全委譲することで PCI DSS 準拠
- **冪等性**：`stripeSessionId` を Firestore のキーとして使い、Webhook の重複受信でも二重書き込みを防ぐ
- **Webhook 署名検証**：`stripe.webhooks.constructEvent()` で署名を検証し、なりすましリクエストを弾く
- **非同期ステータス管理**：決済成功は Checkout リダイレクトではなく Webhook で確定させる（ブラウザを閉じても安全）

---

## Firestore チューニングのポイント（面談で語れる点）

- アクセスパターン先行設計：画面の読み取り要件を整理してからコレクション構造を決定
- `onSnapshot` vs `get` の使い分け：商品一覧はリアルタイム不要なので `get` を使用（課金・通信削減）
- ページネーション：商品数が増えた場合は `startAfter` によるカーソルページネーションに対応可能
- ホットスポット回避：Firestore 自動生成 ID（ランダム）を使用することで書き込みが特定シャードに集中しない
