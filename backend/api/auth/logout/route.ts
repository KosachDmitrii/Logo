import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { siteUrl } from "@/backend/auth/session";

export const dynamic = "force-dynamic";

/** Must match frontend/lib/studio-session + locale storage keys. */
const CLIENT_STORAGE_KEYS = [
  "loopen-studio-session-v1",
  "loopen.briefLocale",
] as const;

export async function POST(request: Request) {
  return signOut(request);
}

export async function GET(request: Request) {
  return signOut(request);
}

async function signOut(request: Request) {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const cookieStore = await cookies();

  if (url && anonKey) {
    const client = createServerClient(url, anonKey, {
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
    await client.auth.signOut();
  }

  const returnTo = new URL(request.url).searchParams.get("return_to") || "/";
  const safe =
    returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/";
  const destination = new URL(safe, siteUrl(request)).toString();

  // Browser navigations: wipe client draft storage after pagehide may have
  // re-saved it, then redirect. fetch/XHR can still follow a plain redirect.
  const accept = request.headers.get("accept") || "";
  const prefersHtml =
    request.method === "GET" && accept.includes("text/html");

  if (prefersHtml) {
    return new NextResponse(logoutWipeHtml(destination), {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }

  return NextResponse.redirect(destination);
}

function logoutWipeHtml(destination: string) {
  const keys = JSON.stringify(CLIENT_STORAGE_KEYS);
  const target = JSON.stringify(destination);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="robots" content="noindex">
<title>Signing out…</title>
<script>
(function () {
  var keys = ${keys};
  try {
    for (var i = 0; i < keys.length; i++) {
      sessionStorage.removeItem(keys[i]);
      localStorage.removeItem(keys[i]);
    }
  } catch (e) {}
  location.replace(${target});
})();
</script>
</head>
<body></body>
</html>`;
}
