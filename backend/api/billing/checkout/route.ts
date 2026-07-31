import { getStudioUser, siteUrl } from "@/backend/auth/session";
import {
  RATE_LIMITS,
  assertRateLimit,
  RateLimitError,
} from "@/backend/lib/rate-limit";
import { packById } from "@/backend/lib/signals";
import { getStripe, stripeConfigured } from "@/backend/lib/stripe";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getStudioUser();
  if (!user) {
    return Response.json({ error: "Sign in to top up signals." }, { status: 401 });
  }
  if (user.source === "local") {
    return Response.json(
      { error: "Local Studio already has a working signal balance." },
      { status: 400 },
    );
  }
  if (!stripeConfigured()) {
    return Response.json(
      { error: "Billing is not configured yet. Add STRIPE_SECRET_KEY." },
      { status: 503 },
    );
  }

  try {
    await assertRateLimit(user.email, RATE_LIMITS.checkoutUser);

    const body = (await request.json()) as { packId?: string };
    const pack = body.packId ? packById(body.packId) : null;
    if (!pack) {
      return Response.json({ error: "Unknown signal pack." }, { status: 400 });
    }

    const stripe = getStripe();
    if (!stripe) {
      return Response.json({ error: "Stripe unavailable." }, { status: 503 });
    }

    const origin = siteUrl(request);
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: user.email,
      client_reference_id: pack.id,
      metadata: {
        packId: pack.id,
        userEmail: user.email,
        signals: String(pack.signals),
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: pack.priceUsd * 100,
            product_data: {
              name: `Loopen ${pack.label} — ${pack.signals} signals`,
              description: pack.blurb,
            },
          },
        },
      ],
      success_url: `${origin}/?signals=topped&pack=${pack.id}#brief`,
      cancel_url: `${origin}/?signals=cancelled#brief`,
    });

    if (!session.url) {
      return Response.json(
        { error: "Checkout session missing redirect URL." },
        { status: 502 },
      );
    }

    return Response.json({ url: session.url, sessionId: session.id });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return Response.json({ error: error.message }, { status: 429 });
    }
    console.error({
      event: "checkout_failed",
      reason: error instanceof Error ? error.message : String(error),
    });
    return Response.json(
      { error: "Could not start checkout." },
      { status: 502 },
    );
  }
}
