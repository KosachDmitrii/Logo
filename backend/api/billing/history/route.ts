import { getStudioUser } from "@/backend/auth/session";
import { selectRows } from "@/backend/lib/supabase";
import { stripeConfigured } from "@/backend/lib/stripe";

export const dynamic = "force-dynamic";

type LedgerRow = {
  id: string;
  delta: number;
  reason: string;
  ref: string | null;
  created_at: number;
};

export async function GET() {
  const user = await getStudioUser();
  if (!user || user.source === "local") {
    return Response.json({ error: "Sign in required." }, { status: 401 });
  }

  try {
    const rows = await selectRows<LedgerRow>("studio_ledger", {
      user_email: `eq.${user.email}`,
      select: "id,delta,reason,ref,created_at",
      order: "created_at.desc",
      limit: 40,
    });

    const entries = rows.map((row) => ({
      id: row.id,
      delta: row.delta,
      reason: row.reason,
      ref: row.ref,
      createdAt: row.created_at,
      label: labelForReason(row.reason, row.delta),
    }));

    return Response.json({
      ok: true,
      billingEnabled: stripeConfigured(),
      entries,
    });
  } catch (error) {
    console.error({
      event: "billing_history_failed",
      reason: error instanceof Error ? error.message : String(error),
    });
    return Response.json(
      { error: "Could not load billing history." },
      { status: 503 },
    );
  }
}

function labelForReason(reason: string, delta: number): string {
  const key = reason.toLowerCase();
  if (key.includes("welcome")) return "Welcome signals";
  if (key.includes("checkout") || key.includes("stripe") || key.includes("pack")) {
    return "Signal pack";
  }
  if (key.includes("grant") || key.includes("admin")) return "Studio grant";
  if (delta > 0) return "Signals added";
  if (key.includes("generate")) return "Concept generation";
  if (key.includes("refine")) return "Refine";
  if (key.includes("vector")) return "Vectorize";
  return delta >= 0 ? "Credit" : "Spend";
}
