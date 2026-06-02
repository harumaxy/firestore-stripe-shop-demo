import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { collection, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature")!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return NextResponse.json({ error: "Webhook signature verification failed" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    // stripeSessionId をドキュメントIDとして使い冪等性を確保
    await setDoc(doc(collection(db, "orders"), session.id), {
      productId: session.metadata?.productId ?? "",
      amount: session.amount_total ?? 0,
      status: "paid",
      stripeSessionId: session.id,
      createdAt: serverTimestamp(),
    });
  }

  return NextResponse.json({ received: true });
}
