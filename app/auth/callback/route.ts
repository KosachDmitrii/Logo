import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ensureStudioWallet, siteUrl } from "@/backend/auth/session";
import type { EmailOtpType } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type") as EmailOtpType | null;
  const nextParam = requestUrl.searchParams.get("next");
  // Prefer an explicit next, else send signup confirmations to a success notice.
  const defaultNext =
    type === "signup" || type === "email" ? "/?auth=confirmed" : "/#brief";
  const next = nextParam || defaultNext;
  const safeNext =
    next.startsWith("/") && !next.startsWith("//") ? next : defaultNext;

  // Prefer the host the user actually landed on (magic-link redirect target).
  const landedOrigin = requestUrl.origin;
  const configuredOrigin = siteUrl(request);
  const origin =
    landedOrigin.startsWith("http://localhost") ||
    landedOrigin.startsWith("https://localhost") ||
    landedOrigin.includes("railway.app")
      ? landedOrigin
      : configuredOrigin;

  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return NextResponse.redirect(new URL("/?auth=config#enter", origin));
  }

  if (!code && !(tokenHash && type)) {
    return NextResponse.redirect(new URL("/?auth=missing#enter", origin));
  }

  let redirectResponse = NextResponse.redirect(new URL(safeNext, origin));
  const cookieStore = await cookies();

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options);
          redirectResponse.cookies.set(name, value, options);
        });
      },
    },
  });

  let email: string | undefined;
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error || !data.user?.email) {
      console.error({
        event: "auth_callback_code_failed",
        reason: error?.message ?? "no user",
      });
      return NextResponse.redirect(new URL("/?auth=failed#enter", origin));
    }
    email = data.user.email;
  } else if (tokenHash && type) {
    const { data, error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (error || !data.user?.email) {
      console.error({
        event: "auth_callback_otp_failed",
        reason: error?.message ?? "no user",
      });
      return NextResponse.redirect(new URL("/?auth=failed#enter", origin));
    }
    email = data.user.email;
  }

  if (email) {
    try {
      await ensureStudioWallet(email);
    } catch (walletError) {
      console.warn({
        event: "wallet_bootstrap_failed",
        reason:
          walletError instanceof Error
            ? walletError.message
            : String(walletError),
      });
    }
  }

  return redirectResponse;
}
