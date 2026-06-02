"use client";

import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

type Product = {
  id: string;
  name: string;
  price: number;
  description: string;
  imageUrl: string;
};

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState<string | null>(null);

  useEffect(() => {
    const fetchProducts = async () => {
      const snapshot = await getDocs(collection(db, "products"));
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as Omit<Product, "id">),
      }));
      setProducts(data);
      setLoading(false);
    };
    fetchProducts();
  }, []);

  const handleCheckout = async (productId: string) => {
    setCheckingOut(productId);
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId }),
    });
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
        <h1 className="text-3xl font-bold text-gray-900 mb-8">デジタル商品ストア</h1>
        {products.length === 0 ? (
          <p className="text-gray-500">商品がありません。Firestoreにデータを追加してください。</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((product) => (
              <div key={product.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
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
                    disabled={checkingOut === product.id}
                    className="mt-4 w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                  >
                    {checkingOut === product.id ? "処理中..." : "購入する"}
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
