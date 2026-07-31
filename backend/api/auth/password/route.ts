import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import {
  RATE_LIMITS,
  assertRateLimit,
  clientIp,
  RateLimitError,
} from "@/backend/lib/rate-limit";
import { ensureStudioWallet } from "@/backend/auth/session";
import { roleFromAppMetadata } from "@/backend/lib/roles";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await assertRateLimit(clientIp(request), RATE_LIMITS.otpIp);

    const body = (await request.json()) as {
      email?: string;
      password?: string;
    };
    const email = body.email?.trim().toLowerCase() ?? "";
    const password = body.password ?? "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 6) {
      return Response.json(
        { error: "Enter email and password (min 6 characters)." },
        { status: 400 },
      );
    }

    const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey) {
      return Response.json(
        { error: "Supabase Auth is not configured." },
        { status: 503 },
      );
    }

    const cookieStore = await cookies();
    const supabase = createServerClient(url, anonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    });

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error || !data.user?.email) {
      return Response.json(
        { error: "Invalid email or password." },
        { status: 401 },
      );
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
    return Response.json({
      ok: true,
      user: {
        displayName:
          typeof data.user.user_metadata?.full_name === "string"
            ? data.user.user_metadata.full_name
            : data.user.email,
        email: data.user.email.toLowerCase(),
        role,
        source: "supabase",
      },
    });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return Response.json({ error: error.message }, { status: 429 });
    }
    const message = error instanceof Error ? error.message : "Auth failed.";
    return Response.json({ error: message }, { status: 503 });
  }
}
