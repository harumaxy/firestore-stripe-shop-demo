import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: NextRequest) {
  const { productId, userId } = await req.json();

  const productDoc = await getDoc(doc(db, "products", productId));
  if (!productDoc.exists()) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  const product = productDoc.data();
  const origin = req.headers.get("origin") ?? "http://localhost:3000";

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "jpy",
          product_data: { name: product.name },
          unit_amount: product.price,
        },
        quantity: 1,
      },
    ],
    mode: "payment",
    success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/`,
    metadata: { productId, userId },
  });

  return NextResponse.json({ url: session.url });
}
