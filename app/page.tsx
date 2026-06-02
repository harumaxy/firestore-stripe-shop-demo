"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";

type Product = {
  id: string;
  name: string;
  price: number;
  description: string;
  imageUrl: string;
};

export default function Home() {
  const { user, signOut } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState<string | null>(null);
  const [purchasedIds, setPurchasedIds] = useState<string[]>([]);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      const [productSnap, orderSnap] = await Promise.all([
        getDocs(collection(db, "products")),
        getDocs(query(collection(db, "orders"), where("userId", "==", user.uid), where("status", "==", "paid"))),
      ]);

      setProducts(productSnap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Omit<Product, "id">) })));
      setPurchasedIds(orderSnap.docs.map((doc) => doc.data().productId as string));
      setLoading(false);
    };

    fetchData();
  }, [user]);

  const handleCheckout = async (productId: string) => {
    setCheckingOut(productId);
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId, userId: user?.uid }),
    });
    if (res.status === 409) {
      setPurchasedIds((prev) => [...prev, productId]);
      setCheckingOut(null);
      return;
    }
    const { url } = await res.json();
    window.location.href = url;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">読み込み中...</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900">デジタル商品ストア</h1>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">{user?.email}</span>
            <button
              onClick={() => signOut()}
              className="text-sm text-gray-500 hover:text-gray-700 border border-gray-300 rounded-lg px-3 py-1"
            >
              ログアウト
            </button>
          </div>
        </div>
        {products.length === 0 ? (
          <p className="text-gray-500">商品がありません。</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((product) => (
              <div key={product.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden relative">
                {purchasedIds.includes(product.id) && (
                  <div className="absolute top-3 right-3 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                    購入済み
                  </div>
                )}
                {product.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={product.imageUrl} alt={product.name} className="w-full h-48 object-cover" />
                )}
                <div className="p-5">
                  <h2 className="text-lg font-semibold text-gray-900">{product.name}</h2>
                  <p className="text-sm text-gray-500 mt-1">{product.description}</p>
                  <p className="text-xl font-bold text-gray-900 mt-3">¥{product.price.toLocaleString()}</p>
                  <button
                    onClick={() => handleCheckout(product.id)}
                    disabled={checkingOut === product.id || purchasedIds.includes(product.id)}
                    className="mt-4 w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors"
                  >
                    {purchasedIds.includes(product.id) ? "購入済み" : checkingOut === product.id ? "処理中..." : "購入する"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
