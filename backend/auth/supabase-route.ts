import { createServerClient } from "@supabase/ssr";
import { createClient, type User } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export type CookieJar = {
  name: string;
  value: string;
  options?: Parameters<
    Awaited<ReturnType<typeof cookies>>["set"]
  >[2];
};

export async function createCookieSupabase() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;

  const cookieStore = await cookies();
  const pending: CookieJar[] = [];
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options);
          pending.push({ name, value, options });
        });
      },
    },
  });

  return { supabase, pending, url, anonKey };
}

export function applyCookies(
  response: NextResponse,
  pending: CookieJar[],
) {
  for (const { name, value, options } of pending) {
    response.cookies.set(name, value, options);
  }
  return response;
}

export function createServiceSupabase() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const BRIEF_LOCALES = ["en", "ru", "he", "de", "fr", "es"] as const;
export type BriefLocale = (typeof BRIEF_LOCALES)[number];

export type StudioEmailPrefs = {
  productUpdates: boolean;
  signalReceipts: boolean;
  teamLaunch: boolean;
  /** null = user has not chosen a studio language yet */
  briefLocale: BriefLocale | null;
};

export function normalizeBriefLocale(value: unknown): BriefLocale {
  return BRIEF_LOCALES.includes(value as BriefLocale)
    ? (value as BriefLocale)
    : "en";
}

export function prefsFromMetadata(
  metadata: User["user_metadata"] | undefined,
): StudioEmailPrefs {
  return {
    productUpdates: metadata?.email_product_updates !== false,
    signalReceipts: metadata?.email_signal_receipts !== false,
    teamLaunch: metadata?.notify_team_launch === true,
    briefLocale:
      typeof metadata?.brief_locale === "string"
        ? normalizeBriefLocale(metadata.brief_locale)
        : null,
  };
}

export function nameFromMetadata(
  metadata: User["user_metadata"] | undefined,
  email: string,
) {
  const firstName =
    typeof metadata?.first_name === "string" ? metadata.first_name.trim() : "";
  const lastName =
    typeof metadata?.last_name === "string" ? metadata.last_name.trim() : "";
  const fullName =
    typeof metadata?.full_name === "string" ? metadata.full_name.trim() : "";
  const displayName =
    fullName ||
    [firstName, lastName].filter(Boolean).join(" ") ||
    email.split("@")[0] ||
    email;
  return { firstName, lastName, fullName: fullName || displayName, displayName };
}
