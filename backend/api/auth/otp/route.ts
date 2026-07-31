import { createClient } from "@supabase/supabase-js";
import {
  RATE_LIMITS,
  assertRateLimit,
  clientIp,
  RateLimitError,
} from "@/backend/lib/rate-limit";
import { siteUrl } from "@/backend/auth/session";

export const dynamic = "force-dynamic";

function supabaseAuthClient() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Supabase Auth is not configured.");
  }
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function POST(request: Request) {
  try {
    await assertRateLimit(clientIp(request), RATE_LIMITS.otpIp);

    const body = (await request.json()) as { email?: string };
    const email = body.email?.trim().toLowerCase() ?? "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json({ error: "Enter a valid email." }, { status: 400 });
    }

    const origin = siteUrl(request);
    const { error } = await supabaseAuthClient().auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${origin}/auth/callback`,
        shouldCreateUser: true,
      },
    });
    if (error) {
      console.error({ event: "auth_otp_failed", reason: error.message });
      return Response.json(
        { error: "Could not send the entry link. Try again in a moment." },
        { status: 502 },
      );
    }

    return Response.json({
      ok: true,
      message: "Entry link sent. Check your inbox — the studio is waiting.",
    });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return Response.json({ error: error.message }, { status: 429 });
    }
    const message = error instanceof Error ? error.message : "Auth failed.";
    return Response.json({ error: message }, { status: 503 });
  }
}
