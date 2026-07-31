import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { siteUrl } from "@/backend/auth/session";

export const dynamic = "force-dynamic";

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
  return NextResponse.redirect(new URL(safe, siteUrl(request)));
}
