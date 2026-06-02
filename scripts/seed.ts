import { initializeApp } from "firebase/app";
import { getFirestore, connectFirestoreEmulator, collection, addDoc } from "firebase/firestore";

const app = initializeApp({
  apiKey: "demo-key",
  projectId: "demo-project",
});

const db = getFirestore(app);
connectFirestoreEmulator(db, "localhost", 8080);

const products = [
  {
    name: "TypeScript 完全ガイド PDF",
    price: 1500,
    description: "TypeScript の型システムから実践パターンまで解説した電子書籍",
    imageUrl: "https://placehold.co/400x300/6366f1/white?text=TypeScript",
  },
  {
    name: "Next.js App Router 入門",
    price: 2000,
    description: "App Router の基礎から Server Components まで学べる動画コース",
    imageUrl: "https://placehold.co/400x300/0ea5e9/white?text=Next.js",
  },
  {
    name: "Firestore 設計パターン集",
    price: 1200,
    description: "アクセスパターン先行設計・インデックス戦略のリファレンス集",
    imageUrl: "https://placehold.co/400x300/f59e0b/white?text=Firestore",
  },
];

for (const product of products) {
  const ref = await addDoc(collection(db, "products"), product);
  console.log(`Added: ${product.name} (${ref.id})`);
}

console.log("Seed completed.");
process.exit(0);
