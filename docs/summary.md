# Firestore + Stripe デジタル商品ストア 構築まとめ

---

## 作業内容

1. **Next.js プロジェクト作成** (`create-next-app`)
2. **Firebase Emulator 起動** (Firestore:8080 / Auth:9099 / UI:4000)
3. **商品一覧表示** (Firestoreの`products`コレクションから取得)
4. **Stripe Checkout 実装** (`/api/checkout` でセッション作成 → リダイレクト)
5. **Stripe Webhook 実装** (`/api/webhook` で署名検証 → `orders`コレクションに書き込み)
6. **購入済み状態表示** (Firestoreの`orders`をユーザーIDでクエリ)
7. **Firebase Authentication 追加** (メール/パスワード、エミュレータ対応)
8. **ミドルウェアによるルート保護** (sessionクッキーで未認証→/loginリダイレクト)
9. **重複購入防止** (Firestore事前チェック + Stripe Idempotency Key)
10. **本番デプロイ** (Firebase本番プロジェクト + Vercel + Stripe Webhook登録)
11. **Firebase Admin SDK 導入** (API RoutesでSecurity Rulesをバイパス)

---

## 使ったサービスと概念

### Firebase Firestore

- **NoSQL ドキュメントDB**。コレクション/ドキュメント構造
- **CAP定理**: CPよりの設計（強整合性 + 分断耐性）。スケールのためユニーク制約を持たない
- **ユニーク制約なし**: 分散シャードへのスキャンコストが高いため。代替はDocumentIDをキーにする
- **Security Rules**: Firestoreのアクセス制御DSL。PostgreSQL RLSに相当。`request.auth`・`resource.data`などのビルトイン変数を使う
- **自動インデックス**: 単一フィールドは自動、複合インデックスは手動登録が必要
- **Emulator**: ローカル開発用。本番に影響しない。`connectFirestoreEmulator()`で接続先を切り替え

### Firebase Authentication

- **onAuthStateChanged**: 認証状態の変化を監視するリスナー
- **IDトークン**: ログイン後に取得できるJWT。sessionクッキーに入れてMiddlewareで参照
- **エミュレータ**: `connectAuthEmulator()`で接続。本番とは完全に独立したユーザーDB

### Firebase Admin SDK (`firebase-admin`)

- **サービスアカウント**で動作し、Security Rulesをバイパスできる
- サーバーサイド（API Routes）での読み書きはAdmin SDKが正解
- クライアントSDKをサーバーで使うとSecurity Rulesに弾かれる

### Stripe

- **Checkout Session**: カード情報をStripeに完全委譲。PCI DSS準拠
- **Webhook**: 決済成功を非同期で通知。`stripe.webhooks.constructEvent()`で署名検証
- **Idempotency Key**: 同じキーで同じリクエストを送ると既存セッションを返す（24時間有効）
- **stripe listen**: Stripe CLIのローカルWebhookトンネル。ngrok不要

### Next.js Middleware

- EdgeランタイムでCookieを見て認証チェック
- Firebase AuthのIndexedDB状態はEdgeから見えないのでCookieに別途コピーする

### Vercel

- Next.js製アプリのホスティング。GitHubと連携して自動デプロイ
- SSRを含むNext.jsアプリは無料Hobbyプランで動く
- Firebase Hostingは SSR に Blaze（有料）プランが必要なため Vercel を採用

---

## ハマったポイント・注意点

| 問題 | 原因 | 解決策 |
|------|------|--------|
| `create-next-app`が失敗 | CLAUDE.mdが既に存在した | 一時削除してインストール後に戻す |
| `bun firebase`でエラー | firebase.jsonを直接実行しようとした | `bunx firebase emulators:start` |
| ログインフォームの文字が見えない | inputに文字色指定なし | `text-gray-900`を追加 |
| Webhookで`orders`が作られない | Firestoreに`userId`を保存していなかった | checkoutのmetadataに追加 |
| Middleware認証が機能しない | Firebase AuthはIndexedDB管理でEdgeから読めない | IDトークンをCookieに書く |
| `/api/checkout`で500 PERMISSION_DENIED | クライアントSDKはSecurity Rulesに従う | Admin SDKに切り替え |
| `/api/webhook`で500 PERMISSION_DENIED | 同上 | Admin SDKに切り替え |
| `seed:prod`でPERMISSION_DENIED(初回) | FirestoreがGCPでまだ有効化されていなかった | コンソールでFirestore DBを作成 |
| `seed:prod`でwrite拒否 | Security Rulesが`allow write: if false` | 一時的に`if true`にして投入後に戻す |

---

## 設計ポイント（面談で語れる）

### 冪等性
`stripeSessionId` を Firestore の DocumentID にすることで、Webhook が重複受信されても二重書き込みにならない。

### 非同期ステータス管理
決済の確定は Checkout リダイレクトではなく Webhook で行う。ブラウザを閉じても安全。

### サーバー/クライアントのSDK使い分け
| 場所 | SDK | 理由 |
|------|-----|------|
| フロントエンド | クライアントSDK | ブラウザから直接Firestoreにアクセス |
| API Routes | Admin SDK | Security Rulesをバイパス、サービスアカウントで認証 |

### Security Rules の設計
```js
match /products/{productId} {
  allow read: if true;       // 誰でも読める
  allow write: if false;     // 書き込みはサーバーのみ
}
match /orders/{orderId} {
  allow read: if request.auth != null
           && request.auth.uid == resource.data.userId; // 本人のみ
  allow write: if false;     // 書き込みはサーバーのみ
}
```

### 重複購入防止の多層防御
1. **フロント**: 購入済みボタンをdisabled化
2. **APIサーバー**: Firestore事前チェック（409を返す）
3. **Stripe**: Idempotency Keyで短時間の連打を防止

### Firebase APIキーのセキュリティ
- `NEXT_PUBLIC_FIREBASE_API_KEY`はフロント公開前提のキー（プロジェクト識別子）
- 本当の保護はSecurity Rulesが担う
- Blaze（有料）プランではAPIキーにHTTPリファラー制限をかける（補助的対策）
- HTTPリファラーは偽装可能なので主防衛はあくまでSecurity Rules

### RDBとFirestoreのトレードオフ
購入履歴のような整合性が重要なデータは本来RDB向き。Firestoreで実装する場合は冪等設計とトランザクションで代替する。
