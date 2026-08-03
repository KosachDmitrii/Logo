import { NextResponse } from "next/server";
import {
  RATE_LIMITS,
  assertRateLimit,
  clientIp,
  RateLimitError,
} from "@/backend/lib/rate-limit";
import { deleteRows } from "@/backend/lib/supabase";
import {
  applyCookies,
  createCookieSupabase,
  createServiceSupabase,
} from "@/backend/auth/supabase-route";

export const dynamic = "force-dynamic";

export async function DELETE(request: Request) {
  try {
    await assertRateLimit(clientIp(request), RATE_LIMITS.passwordIp);

    const body = (await request.json().catch(() => ({}))) as {
      confirmEmail?: string;
    };

    const ctx = await createCookieSupabase();
    if (!ctx) {
      return NextResponse.json(
        { error: "Supabase Auth is not configured." },
        { status: 503 },
      );
    }

    const {
      data: { user },
      error: userError,
    } = await ctx.supabase.auth.getUser();
    if (userError || !user?.email) {
      return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    }

    const email = user.email.toLowerCase();
    const confirm = body.confirmEmail?.trim().toLowerCase() ?? "";
    if (confirm !== email) {
      return NextResponse.json(
        { error: "Type your email to confirm account deletion." },
        { status: 400 },
      );
    }

    const admin = createServiceSupabase();
    if (!admin) {
      return NextResponse.json(
        { error: "Account deletion is not configured." },
        { status: 503 },
      );
    }

    try {
      await deleteRows("studio_ledger", { user_email: `eq.${email}` });
      await deleteRows("studio_wallets", { user_email: `eq.${email}` });
    } catch (cleanupError) {
      console.warn({
        event: "account_wallet_cleanup_failed",
        reason:
          cleanupError instanceof Error
            ? cleanupError.message
            : String(cleanupError),
      });
    }

    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) {
      console.error({ event: "auth_delete_failed", reason: error.message });
      return NextResponse.json(
        { error: "Could not delete the account." },
        { status: 502 },
      );
    }

    await ctx.supabase.auth.signOut();

    return applyCookies(
      NextResponse.json({ ok: true }),
      ctx.pending,
    );
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json({ error: error.message }, { status: 429 });
    }
    const message = error instanceof Error ? error.message : "Delete failed.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
