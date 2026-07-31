import { grantPackSignals } from "@/backend/lib/signals";
import { selectOne } from "@/backend/lib/supabase";
import {
  getStripe,
  packFromCheckoutSession,
} from "@/backend/lib/stripe";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!stripe || !webhookSecret) {
    return Response.json({ error: "Webhook not configured." }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return Response.json({ error: "Missing signature." }, { status: 400 });
  }

  const rawBody = await request.text();
  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    console.error({
      event: "stripe_webhook_invalid",
      reason: error instanceof Error ? error.message : String(error),
    });
    return Response.json({ error: "Invalid signature." }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const email = (
      session.metadata?.userEmail ||
      session.customer_email ||
      ""
    )
      .trim()
      .toLowerCase();
    const pack = packFromCheckoutSession(session);
    if (!email || !pack) {
      console.error({
        event: "stripe_checkout_missing_meta",
        sessionId: session.id,
      });
      return Response.json({ error: "Missing pack metadata." }, { status: 400 });
    }

    // Idempotency: skip if this Stripe session was already granted.
    const prior = await selectOne<{ id: string }>("studio_ledger", {
      select: "id",
      ref: `eq.${session.id}`,
      reason: `eq.pack:${pack.id}`,
      limit: 1,
    });
    if (!prior) {
      const balance = await grantPackSignals(email, pack, session.id);
      console.log({
        event: "signals_pack_granted",
        email,
        packId: pack.id,
        signals: pack.signals,
        balance,
        sessionId: session.id,
      });
    }
  }

  return Response.json({ received: true });
}
