import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  RATE_LIMITS,
  assertRateLimit,
  clientIp,
  RateLimitError,
} from "@/backend/lib/rate-limit";
import { ensureStudioWallet, siteUrl } from "@/backend/auth/session";
import { roleFromAppMetadata } from "@/backend/lib/roles";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await assertRateLimit(clientIp(request), RATE_LIMITS.registerIp);

    const body = (await request.json()) as {
      email?: string;
      password?: string;
      firstName?: string;
      lastName?: string;
    };
    const email = body.email?.trim().toLowerCase() ?? "";
    const password = body.password ?? "";
    const firstName = body.firstName?.trim().replace(/\s+/g, " ") ?? "";
    const lastName = body.lastName?.trim().replace(/\s+/g, " ") ?? "";
    const nameRe = /^[\p{L}](?:[\p{L}\s'’.-]{0,78}[\p{L}])?$/u;
    if (
      firstName.length < 2 ||
      lastName.length < 2 ||
      firstName.length > 80 ||
      lastName.length > 80 ||
      !nameRe.test(firstName) ||
      !nameRe.test(lastName)
    ) {
      return NextResponse.json(
        { error: "Enter a valid first and last name." },
        { status: 400 },
      );
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      return NextResponse.json(
        { error: "Enter a valid email address." },
        { status: 400 },
      );
    }
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

    const origin = siteUrl(request);
    const confirmNext = encodeURIComponent("/?auth=confirmed");
    const fullName = `${firstName} ${lastName}`;
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${origin}/auth/callback?next=${confirmNext}`,
        data: {
          first_name: firstName,
          last_name: lastName,
          full_name: fullName,
        },
      },
    });

    if (error) {
      console.error({ event: "auth_register_failed", reason: error.message });
      const already =
        /already|registered|exists/i.test(error.message) ||
        error.message.toLowerCase().includes("user already");
      return NextResponse.json(
        {
          error: already
            ? "An account with this email already exists. Sign in instead."
            : "Could not create the account. Try again.",
        },
        { status: already ? 409 : 502 },
      );
    }

    // Supabase returns a user with empty identities when the email is taken
    // (avoids enumeration). Treat as “check your inbox / sign in”.
    const identities = data.user?.identities ?? [];
    if (data.user && identities.length === 0) {
      return NextResponse.json({
        ok: true,
        needsConfirmation: true,
        message:
          "If this email is new, confirm the message we sent. If you already have an account, sign in instead.",
      });
    }

    // Confirm email is on — no session until the link is opened.
    if (!data.session || !data.user?.email) {
      const response = NextResponse.json({
        ok: true,
        needsConfirmation: true,
        message:
          "Account created. Confirm the email we just sent, then enter the studio.",
      });
      for (const { name, value, options } of pendingCookies) {
        response.cookies.set(name, value, options);
      }
      return response;
    }

    try {
      await ensureStudioWallet(data.user.email);
    } catch (walletError) {
      console.warn({
        event: "wallet_bootstrap_failed",
        reason:
          walletError instanceof Error
            ? walletError.message
            : String(walletError),
      });
    }

    const role = roleFromAppMetadata(data.user.app_metadata);
    const response = NextResponse.json({
      ok: true,
      needsConfirmation: false,
      role,
      user: {
        displayName: fullName,
        email: data.user.email.toLowerCase(),
        role,
        source: "supabase",
      },
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
