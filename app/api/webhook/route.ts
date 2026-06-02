import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";

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

    await adminDb.collection("orders").doc(session.id).set({
      productId: session.metadata?.productId ?? "",
      userId: session.metadata?.userId ?? "",
      amount: session.amount_total ?? 0,
      status: "paid",
      stripeSessionId: session.id,
      createdAt: FieldValue.serverTimestamp(),
    });
  }

  return NextResponse.json({ received: true });
}
