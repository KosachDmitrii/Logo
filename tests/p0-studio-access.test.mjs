import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("P0 auth uses Supabase session with local-only fallback", async () => {
  const [session, page, otp, callback] = await Promise.all([
    readFile(new URL("../backend/auth/session.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../backend/api/auth/otp/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/auth/callback/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(session, /getStudioUser/);
  assert.match(session, /getStudioSession/);
  assert.match(session, /studioSignInPath/);
  assert.match(session, /createServerClient/);
  assert.match(session, /Bearer/);
  assert.match(session, /ALLOW_LOCAL_STUDIO/);
  assert.match(session, /local@loopen\.dev/);
  assert.match(session, /ensureStudioWallet/);
  assert.doesNotMatch(session, /chatgpt|oai-authenticated/i);
  assert.match(page, /studioSignInPath/);
  assert.match(page, /getStudioSession/);
  assert.match(page, /ensureStudioWallet/);
  assert.match(otp, /signInWithOtp/);
  assert.match(callback, /exchangeCodeForSession/);

  const roles = await readFile(
    new URL("../backend/lib/roles.ts", import.meta.url),
    "utf8",
  );
  assert.match(roles, /"guest"/);
  assert.match(roles, /"user"/);
  assert.match(roles, /"admin"/);
});

test("P0 signals billing and hard spend caps are wired", async () => {
  const [signals, migration, projects, refine, vectorize, checkout, webhook, studio] =
    await Promise.all([
      readFile(new URL("../backend/lib/signals.ts", import.meta.url), "utf8"),
      readFile(
        new URL(
          "../backend/supabase/migrations/20260731120000_studio_signals.sql",
          import.meta.url,
        ),
        "utf8",
      ),
      readFile(new URL("../backend/api/projects/route.ts", import.meta.url), "utf8"),
      readFile(
        new URL("../backend/api/projects/[id]/refine/route.ts", import.meta.url),
        "utf8",
      ),
      readFile(
        new URL("../backend/api/projects/[id]/vectorize/route.ts", import.meta.url),
        "utf8",
      ),
      readFile(
        new URL("../backend/api/billing/checkout/route.ts", import.meta.url),
        "utf8",
      ),
      readFile(
        new URL("../backend/api/billing/webhook/route.ts", import.meta.url),
        "utf8",
      ),
      readFile(new URL("../frontend/loopen-studio.tsx", import.meta.url), "utf8"),
    ]);

  assert.match(signals, /generateBatch:\s*4/);
  assert.match(signals, /extraConcept:\s*1/);
  assert.match(signals, /refine:\s*2/);
  assert.match(signals, /vectorize:\s*1/);
  assert.match(signals, /SIGNAL_PACKS/);
  assert.match(migration, /spend_studio_signals/);
  assert.match(migration, /grant_studio_signals/);
  assert.match(migration, /hit_studio_rate_limit/);
  assert.match(projects, /spendSignals/);
  assert.match(projects, /refundSignals/);
  assert.match(projects, /InsufficientSignalsError/);
  assert.match(refine, /spendSignals\(user\.email, "refine"/);
  assert.match(vectorize, /spendSignals\(userEmail, "vectorize"/);
  assert.match(checkout, /checkout\.sessions\.create/);
  assert.match(webhook, /grantPackSignals/);
  assert.match(studio, /signal-vault|Signal vault/);
  assert.match(studio, /Enter the/);
  assert.match(studio, /handlePaymentRequired/);
  assert.match(studio, /status === 402/);
});

test("P0 rate limits cover expensive routes and OTP", async () => {
  const rateLimit = await readFile(
    new URL("../backend/lib/rate-limit.ts", import.meta.url),
    "utf8",
  );
  const projects = await readFile(
    new URL("../backend/api/projects/route.ts", import.meta.url),
    "utf8",
  );
  const otp = await readFile(
    new URL("../backend/api/auth/otp/route.ts", import.meta.url),
    "utf8",
  );

  assert.match(rateLimit, /generateUser/);
  assert.match(rateLimit, /generateIp/);
  assert.match(rateLimit, /refineUser/);
  assert.match(rateLimit, /vectorizeUser/);
  assert.match(rateLimit, /otpIp/);
  assert.match(projects, /assertRateLimit\(userEmail, RATE_LIMITS\.generateUser\)/);
  assert.match(projects, /assertRateLimit\(clientIp\(request\), RATE_LIMITS\.generateIp\)/);
  assert.match(otp, /RATE_LIMITS\.otpIp/);
});

test("ownership checks stay email-scoped on read paths", async () => {
  const files = await Promise.all([
    readFile(new URL("../backend/api/projects/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../backend/api/projects/[id]/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../backend/api/images/[id]/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../backend/api/assets/[id]/route.ts", import.meta.url), "utf8"),
    readFile(
      new URL("../backend/api/projects/[id]/select/route.ts", import.meta.url),
      "utf8",
    ),
  ]);

  for (const source of files) {
    assert.match(source, /getStudioUser/);
    assert.match(source, /user_email:\s*`eq\.\$\{/);
    assert.doesNotMatch(source, /chatgpt-auth|getChatGPTUser/);
  }
});
