import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  RATE_LIMITS,
  assertRateLimit,
  clientIp,
  RateLimitError,
} from "@/backend/lib/rate-limit";
import { siteUrl } from "@/backend/auth/session";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await assertRateLimit(clientIp(request), RATE_LIMITS.forgotIp);

    const body = (await request.json()) as { email?: string };
    const email = body.email?.trim().toLowerCase() ?? "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
    }

    const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey) {
      return NextResponse.json(
        { error: "Supabase Auth is not configured." },
        { status: 503 },
      );
    }

    const cookieStore = await cookies();
    const pendingCookies: {
      name: string;
      value: string;
      options?: Parameters<typeof cookieStore.set>[2];
    }[] = [];

    const supabase = createServerClient(url, anonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
            pendingCookies.push({ name, value, options });
          });
        },
      },
    });

    const origin = siteUrl(request);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent("/?reset=1")}`,
    });

    if (error) {
      console.error({ event: "auth_forgot_failed", reason: error.message });
      const rateLimited = /rate limit/i.test(error.message);
      return NextResponse.json(
        {
          error: rateLimited
            ? "Too many reset emails. Wait a bit, then try again."
            : "Could not send the reset email. Try again in a moment.",
        },
        { status: rateLimited ? 429 : 502 },
      );
    }

    // Always succeed from the client’s view to avoid email enumeration.
    const response = NextResponse.json({
      ok: true,
      message:
        "If that email has a studio account, a reset link is on its way. Open it in this browser.",
    });
    for (const { name, value, options } of pendingCookies) {
      response.cookies.set(name, value, options);
    }
    return response;
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json({ error: error.message }, { status: 429 });
    }
    const message = error instanceof Error ? error.message : "Auth failed.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
