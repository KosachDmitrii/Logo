import { NextResponse } from "next/server";
import {
  RATE_LIMITS,
  assertRateLimit,
  clientIp,
  RateLimitError,
} from "@/backend/lib/rate-limit";
import {
  applyCookies,
  BRIEF_LOCALES,
  createCookieSupabase,
  createServiceSupabase,
  nameFromMetadata,
  prefsFromMetadata,
  type BriefLocale,
} from "@/backend/auth/supabase-route";

export const dynamic = "force-dynamic";

function parseBriefLocale(value: unknown): BriefLocale | null {
  return BRIEF_LOCALES.includes(value as BriefLocale)
    ? (value as BriefLocale)
    : null;
}

export async function PATCH(request: Request) {
  try {
    await assertRateLimit(clientIp(request), RATE_LIMITS.passwordIp);

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

    const body = (await request.json()) as {
      firstName?: string;
      lastName?: string;
      productUpdates?: boolean;
      signalReceipts?: boolean;
      teamLaunch?: boolean;
      briefLocale?: string;
    };

    const current = nameFromMetadata(user.user_metadata, user.email);
    const metadataPatch: Record<string, string | boolean> = {};

    const touchingName =
      typeof body.firstName === "string" || typeof body.lastName === "string";
    if (touchingName) {
      const firstName =
        typeof body.firstName === "string"
          ? body.firstName.trim().replace(/\s+/g, " ")
          : current.firstName;
      const lastName =
        typeof body.lastName === "string"
          ? body.lastName.trim().replace(/\s+/g, " ")
          : current.lastName;
      const nameRe = /^[\p{L}](?:[\p{L}\s'’.-]{0,78}[\p{L}])?$/u;
      if (
        firstName.length < 2 ||
        lastName.length < 2 ||
        !nameRe.test(firstName) ||
        !nameRe.test(lastName)
      ) {
        return NextResponse.json(
          { error: "Enter a valid first and last name." },
          { status: 400 },
        );
      }
      metadataPatch.first_name = firstName;
      metadataPatch.last_name = lastName;
      metadataPatch.full_name = `${firstName} ${lastName}`.trim();
    }

    if (typeof body.productUpdates === "boolean") {
      metadataPatch.email_product_updates = body.productUpdates;
    }
    if (typeof body.signalReceipts === "boolean") {
      metadataPatch.email_signal_receipts = body.signalReceipts;
    }
    if (typeof body.teamLaunch === "boolean") {
      metadataPatch.notify_team_launch = body.teamLaunch;
    }

    if (typeof body.briefLocale === "string") {
      const briefLocale = parseBriefLocale(body.briefLocale);
      if (!briefLocale) {
        return NextResponse.json(
          { error: "Unsupported language." },
          { status: 400 },
        );
      }
      // Auth user_metadata.brief_locale — source of truth for studio language.
      metadataPatch.brief_locale = briefLocale;
    }

    if (!Object.keys(metadataPatch).length) {
      return NextResponse.json(
        { error: "Nothing to update." },
        { status: 400 },
      );
    }

    const nextMetadata = {
      ...user.user_metadata,
      ...metadataPatch,
    };

    // Service-role write lands on the Auth user record reliably.
    const admin = createServiceSupabase();
    let nextUser = user;
    if (admin) {
      const { data, error } = await admin.auth.admin.updateUserById(user.id, {
        user_metadata: nextMetadata,
      });
      if (error || !data.user?.email) {
        console.error({
          event: "auth_profile_admin_failed",
          reason: error?.message,
        });
        return NextResponse.json(
          { error: "Could not update profile." },
          { status: 502 },
        );
      }
      nextUser = data.user;
      // Keep the browser session JWT metadata aligned.
      await ctx.supabase.auth.updateUser({ data: metadataPatch });
    } else {
      const { data, error } = await ctx.supabase.auth.updateUser({
        data: metadataPatch,
      });
      if (error || !data.user?.email) {
        console.error({ event: "auth_profile_failed", reason: error?.message });
        return NextResponse.json(
          { error: "Could not update profile." },
          { status: 502 },
        );
      }
      nextUser = data.user;
    }

    const nextName = nameFromMetadata(nextUser.user_metadata, nextUser.email!);
    const nextPrefs = prefsFromMetadata(nextUser.user_metadata);

    return applyCookies(
      NextResponse.json({
        ok: true,
        user: {
          displayName: nextName.displayName,
          email: nextUser.email!.toLowerCase(),
          firstName: nextName.firstName,
          lastName: nextName.lastName,
          prefs: nextPrefs,
        },
      }),
      ctx.pending,
    );
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json({ error: error.message }, { status: 429 });
    }
    const message = error instanceof Error ? error.message : "Profile failed.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
