import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  RATE_LIMITS,
  assertRateLimit,
  clientIp,
  RateLimitError,
} from "@/backend/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await assertRateLimit(clientIp(request), RATE_LIMITS.passwordIp);

    const body = (await request.json()) as { password?: string };
    const password = body.password ?? "";
    if (
      password.length < 8 ||
      !/[A-Za-z]/.test(password) ||
      !/\d/.test(password)
    ) {
      return NextResponse.json(
        {
          error:
            "Password must be at least 8 characters and include a letter and a number.",
        },
        { status: 400 },
      );
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

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json(
        {
          error:
            "Reset session expired. Request a new forgot-password email and open the link again.",
        },
        { status: 401 },
      );
    }

    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      console.error({ event: "auth_update_password_failed", reason: error.message });
      return NextResponse.json(
        { error: "Could not update the password. Try again." },
        { status: 502 },
      );
    }

    const response = NextResponse.json({
      ok: true,
      message: "Password updated. The studio is yours again.",
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
