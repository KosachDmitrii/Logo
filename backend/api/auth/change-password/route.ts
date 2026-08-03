import { NextResponse } from "next/server";
import {
  RATE_LIMITS,
  assertRateLimit,
  clientIp,
  RateLimitError,
} from "@/backend/lib/rate-limit";
import {
  applyCookies,
  createCookieSupabase,
} from "@/backend/auth/supabase-route";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await assertRateLimit(clientIp(request), RATE_LIMITS.passwordIp);

    const body = (await request.json()) as {
      currentPassword?: string;
      newPassword?: string;
    };
    const currentPassword = body.currentPassword ?? "";
    const newPassword = body.newPassword ?? "";

    if (!currentPassword) {
      return NextResponse.json(
        { error: "Enter your current password." },
        { status: 400 },
      );
    }
    if (
      newPassword.length < 8 ||
      !/[A-Za-z]/.test(newPassword) ||
      !/\d/.test(newPassword)
    ) {
      return NextResponse.json(
        {
          error:
            "New password must be at least 8 characters and include a letter and a number.",
        },
        { status: 400 },
      );
    }
    if (currentPassword === newPassword) {
      return NextResponse.json(
        { error: "New password must be different from the current one." },
        { status: 400 },
      );
    }

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

    const { error: verifyError } = await ctx.supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });
    if (verifyError) {
      return NextResponse.json(
        { error: "Current password is incorrect." },
        { status: 401 },
      );
    }

    const { error } = await ctx.supabase.auth.updateUser({
      password: newPassword,
    });
    if (error) {
      console.error({
        event: "auth_change_password_failed",
        reason: error.message,
      });
      return NextResponse.json(
        { error: "Could not update the password." },
        { status: 502 },
      );
    }

    return applyCookies(
      NextResponse.json({
        ok: true,
        message: "Password updated.",
      }),
      ctx.pending,
    );
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json({ error: error.message }, { status: 429 });
    }
    const message = error instanceof Error ? error.message : "Auth failed.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
