import Stripe from "stripe";
import { packById, type SignalPack } from "@/backend/lib/signals";

export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) return null;
  return new Stripe(key);
}

export function stripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

export function packFromCheckoutSession(
  session: Stripe.Checkout.Session,
): SignalPack | null {
  const packId =
    session.metadata?.packId ||
    (typeof session.client_reference_id === "string"
      ? session.client_reference_id
      : "");
  return packId ? packById(packId) : null;
}
