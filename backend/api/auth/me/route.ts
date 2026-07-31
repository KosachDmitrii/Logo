import { getStudioSession, ensureStudioWallet } from "@/backend/auth/session";
import { SIGNAL_COSTS, SIGNAL_PACKS, WELCOME_SIGNALS } from "@/backend/lib/signals";
import { stripeConfigured } from "@/backend/lib/stripe";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getStudioSession();
  if (!session.user || session.role === "guest") {
    return Response.json({
      user: null,
      role: "guest" as const,
      signals: null,
      costs: SIGNAL_COSTS,
      packs: SIGNAL_PACKS,
      welcomeSignals: WELCOME_SIGNALS,
      billingEnabled: stripeConfigured(),
    });
  }

  const user = session.user;
  try {
    const wallet = await ensureStudioWallet(user.email);
    return Response.json({
      user: {
        displayName: user.displayName,
        email: user.email,
        source: user.source,
        role: session.role,
      },
      role: session.role,
      signals: {
        balance: wallet.balance,
        welcomed: wallet.welcomed,
      },
      costs: SIGNAL_COSTS,
      packs: SIGNAL_PACKS,
      welcomeSignals: WELCOME_SIGNALS,
      billingEnabled: stripeConfigured(),
    });
  } catch (error) {
    console.error({
      event: "wallet_load_failed",
      reason: error instanceof Error ? error.message : String(error),
    });
    return Response.json({
      user: {
        displayName: user.displayName,
        email: user.email,
        source: user.source,
        role: session.role,
      },
      role: session.role,
      signals: { balance: 0, welcomed: false },
      costs: SIGNAL_COSTS,
      packs: SIGNAL_PACKS,
      welcomeSignals: WELCOME_SIGNALS,
      billingEnabled: stripeConfigured(),
      warning: "Signal wallet is not ready yet. Apply the studio_signals migration.",
    });
  }
}
