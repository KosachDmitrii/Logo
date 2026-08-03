import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  isAdminRole,
  isAuthenticatedRole,
  isGuestRole,
  roleFromAppMetadata,
  type StudioRole,
} from "@/backend/lib/roles";
import {
  grantWelcomeSignals,
  WELCOME_SIGNALS,
} from "@/backend/lib/signals";
import { selectOne } from "@/backend/lib/supabase";
import {
  prefsFromMetadata,
  type StudioEmailPrefs,
} from "@/backend/auth/supabase-route";

export type StudioUser = {
  displayName: string;
  email: string;
  fullName: string | null;
  source: "supabase" | "local";
  /** guest = not signed in · user = signed in · admin = elevated */
  role: StudioRole;
  firstName?: string;
  lastName?: string;
  prefs?: StudioEmailPrefs;
};

export type StudioSession = {
  user: StudioUser | null;
  role: StudioRole;
};

export { isAdminRole, isAuthenticatedRole, isGuestRole };
export type { StudioRole };

const SIGN_IN_PATH = "/#enter";
const SIGN_OUT_PATH = "/api/auth/logout";
const CALLBACK_PATH = "/auth/callback";

function allowLocalStudio(): boolean {
  // Explicit opt-in only. =0 / unset → real magic-link auth (local and production).
  return process.env.ALLOW_LOCAL_STUDIO === "1";
}

function supabasePublicConfig() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

function displayFromEmail(email: string): string {
  const local = email.split("@")[0] || email;
  return local
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

async function userFromBearer(): Promise<StudioUser | null> {
  const config = supabasePublicConfig();
  if (!config) return null;

  const requestHeaders = await headers();
  const authorization = requestHeaders.get("authorization");
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (!token) return null;

  const client = createClient(config.url, config.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user?.email) return null;

  const email = data.user.email.toLowerCase();
  const fullName =
    typeof data.user.user_metadata?.full_name === "string"
      ? data.user.user_metadata.full_name
      : null;
  const firstName =
    typeof data.user.user_metadata?.first_name === "string"
      ? data.user.user_metadata.first_name
      : "";
  const lastName =
    typeof data.user.user_metadata?.last_name === "string"
      ? data.user.user_metadata.last_name
      : "";
  return {
    displayName: fullName ?? displayFromEmail(email),
    email,
    fullName,
    firstName,
    lastName,
    prefs: prefsFromMetadata(data.user.user_metadata),
    source: "supabase",
    role: roleFromAppMetadata(data.user.app_metadata),
  };
}

async function userFromCookies(): Promise<StudioUser | null> {
  const config = supabasePublicConfig();
  if (!config) return null;

  const cookieStore = await cookies();
  const client = createServerClient(config.url, config.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Called from a Server Component — middleware handles refresh.
        }
      },
    },
  });

  const { data, error } = await client.auth.getUser();
  if (error || !data.user?.email) return null;

  const email = data.user.email.toLowerCase();
  const fullName =
    typeof data.user.user_metadata?.full_name === "string"
      ? data.user.user_metadata.full_name
      : null;
  const firstName =
    typeof data.user.user_metadata?.first_name === "string"
      ? data.user.user_metadata.first_name
      : "";
  const lastName =
    typeof data.user.user_metadata?.last_name === "string"
      ? data.user.user_metadata.last_name
      : "";
  return {
    displayName: fullName ?? displayFromEmail(email),
    email,
    fullName,
    firstName,
    lastName,
    prefs: prefsFromMetadata(data.user.user_metadata),
    source: "supabase",
    role: roleFromAppMetadata(data.user.app_metadata),
  };
}

export async function getStudioUser(): Promise<StudioUser | null> {
  const fromBearer = await userFromBearer();
  if (fromBearer) return fromBearer;

  const fromCookies = await userFromCookies();
  if (fromCookies) return fromCookies;

  if (allowLocalStudio()) {
    return {
      displayName: "Local Studio",
      email: "local@loopen.dev",
      fullName: "Local Studio",
      source: "local",
      // Temporary bypass identity — not a real signed-in account.
      role: "guest",
    };
  }

  return null;
}

/**
 * UI/session role for the page.
 * Local Studio bypass must NOT appear as a signed-in workspace after logout —
 * it only exists inside API getStudioUser() when ALLOW_LOCAL_STUDIO=1.
 */
export async function getStudioSession(): Promise<StudioSession> {
  const fromBearer = await userFromBearer();
  if (fromBearer) {
    return {
      user: fromBearer,
      role: fromBearer.role === "admin" ? "admin" : "user",
    };
  }

  const fromCookies = await userFromCookies();
  if (fromCookies) {
    return {
      user: fromCookies,
      role: fromCookies.role === "admin" ? "admin" : "user",
    };
  }

  return { user: null, role: "guest" };
}

export async function requireStudioUser(returnTo = "/#brief"): Promise<StudioUser> {
  const session = await getStudioSession();
  if (session.user && isAuthenticatedRole(session.role)) return session.user;
  // Local Studio bypass may still hold a working email for API iteration.
  if (session.user?.source === "local" && allowLocalStudio()) return session.user;
  redirect(studioSignInPath(returnTo));
}

export function studioSignInPath(returnTo = "/#brief"): string {
  const safeReturnTo = safeRelativeReturnPath(returnTo);
  if (safeReturnTo === "/" || safeReturnTo === "/#brief") return SIGN_IN_PATH;
  return `${SIGN_IN_PATH}?return_to=${encodeURIComponent(safeReturnTo)}`;
}

export function studioSignOutPath(returnTo = "/"): string {
  const safeReturnTo = safeRelativeReturnPath(returnTo);
  return `${SIGN_OUT_PATH}?return_to=${encodeURIComponent(safeReturnTo)}`;
}

export async function ensureStudioWallet(email: string): Promise<{
  balance: number;
  welcomed: boolean;
}> {
  const normalized = email.trim().toLowerCase();
  const existing = await selectOne<{ balance: number }>("studio_wallets", {
    select: "balance",
    user_email: `eq.${normalized}`,
  });
  if (existing) {
    return { balance: existing.balance, welcomed: false };
  }

  // First wallet: welcome spark. Local Node gets a generous iteration balance.
  const { rpc } = await import("@/backend/lib/supabase");
  if (normalized === "local@loopen.dev" && allowLocalStudio()) {
    const balance = await rpc<number>("grant_studio_signals", {
      p_email: normalized,
      p_amount: 1000,
      p_reason: "local-dev",
      p_ref: "local-studio",
    });
    return { balance, welcomed: true };
  }

  const balance = await grantWelcomeSignals(normalized);
  return { balance, welcomed: true };
}

export function siteUrl(request?: Request): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  if (request) {
    const origin = request.headers.get("origin");
    if (origin) return origin.replace(/\/$/, "");
    const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
    const proto = request.headers.get("x-forwarded-proto") || "https";
    if (host) return `${proto}://${host}`.replace(/\/$/, "");
  }
  return "http://localhost:3000";
}

export { WELCOME_SIGNALS };

function safeRelativeReturnPath(value: string): string {
  if (!value.startsWith("/") || value.startsWith("//")) return "/";

  let url: URL;
  try {
    url = new URL(value, "https://app.local");
  } catch {
    return "/";
  }
  if (url.origin !== "https://app.local") return "/";
  if (url.pathname === SIGN_OUT_PATH || url.pathname === CALLBACK_PATH) {
    return "/";
  }

  return `${url.pathname}${url.search}${url.hash}`;
}
