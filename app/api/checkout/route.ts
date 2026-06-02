import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { adminDb } from "@/lib/firebase-admin";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: NextRequest) {
  const { productId, userId } = await req.json();

  const [productDoc, existingOrders] = await Promise.all([
    adminDb.collection("products").doc(productId).get(),
    adminDb.collection("orders")
      .where("userId", "==", userId)
      .where("productId", "==", productId)
      .where("status", "==", "paid")
      .get(),
  ]);

  if (!productDoc.exists) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }
  if (!existingOrders.empty) {
    return NextResponse.json({ error: "already_purchased" }, { status: 409 });
  }

  const product = productDoc.data()!;
  const origin = req.headers.get("origin") ?? "http://localhost:3000";

  const session = await stripe.checkout.sessions.create(
    {
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
    },
    {
      idempotencyKey: `${userId}_${productId}`,
    }
  );

  return NextResponse.json({ url: session.url });
}
