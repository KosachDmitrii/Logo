import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ensureStudioWallet, siteUrl } from "@/backend/auth/session";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const origin = siteUrl(request);
  const next = requestUrl.searchParams.get("next") || "/#brief";
  const safeNext =
    next.startsWith("/") && !next.startsWith("//") ? next : "/#brief";

  if (!code) {
    return NextResponse.redirect(new URL("/?auth=missing#enter", origin));
  }

  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return NextResponse.redirect(new URL("/?auth=config#enter", origin));
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

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user?.email) {
    console.error({
      event: "auth_callback_failed",
      reason: error?.message ?? "no user",
    });
    return NextResponse.redirect(new URL("/?auth=failed#enter", origin));
  }

  try {
    await ensureStudioWallet(data.user.email);
  } catch (walletError) {
    console.warn({
      event: "wallet_bootstrap_failed",
      reason:
        walletError instanceof Error ? walletError.message : String(walletError),
    });
  }

  return NextResponse.redirect(new URL(safeNext, origin));
}
