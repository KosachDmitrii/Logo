# Loopen Brand Studio

Strategy-first AI logo production pipeline.

## Layout

```text
frontend/          React studio UI, styles, client session helpers
backend/           API handlers, auth, Supabase, server libs
app/               Next.js entry points (thin re-exports into FE/BE)
public/            Static assets
tests/             Node test suite
```

## Architecture

```text
frontend (React / Next.js)
      │
backend (Next.js Route Handlers)
      ├── OpenAI — brand strategy, art-direction, vector refine
      ├── Gemini — explorations, refinements, visual jury
      ├── Recraft — legacy raster-to-SVG
      ├── Supabase PostgreSQL — projects and metadata
      └── Supabase Storage (logo-files) — PNG and SVG assets
```

## Local setup

Requires Node.js 22.13 or newer.

Create `.env.local` (see [`.env.example`](.env.example)). For UI-local /
API-on-Railway you mainly need the proxy lines; API keys live on Railway.

Apply migrations in `backend/supabase/migrations/` to the Supabase project
(schema + private `logo-files` storage bucket) before starting the app.

```bash
npm install
npm test
npm run dev
```

Open http://localhost:3000. Local UI uses the Local Studio identity; API
calls go to Railway when `API_PROXY_TARGET` is set.

## Railway = API (backend)

Recommended workflow: UI on localhost, API on Railway.

- Railway runs the Next.js server (API routes + keys + Supabase)
- Local `npm run dev` serves the studio UI and proxies `/api/*` → Railway
- On Railway Variables set all secrets from `.env.example` plus
  `ALLOW_LOCAL_STUDIO=1` (temporary until regular login)

Local `.env.local`:

```env
NEXT_PUBLIC_API_URL=/api
API_PROXY_TARGET=https://logo-production-043e.up.railway.app
```

Restart `next dev` after changing `API_PROXY_TARGET` (it is read by
`next.config.ts`). Open http://localhost:3000 — generate/history hit Railway.

Config-as-code: [`railway.json`](railway.json). Build/start on Railway:
`npm run build` / `npm start`, healthcheck `/`.

## Data ownership

- Supabase stores project, generation, selection, and asset metadata.
- Supabase Storage stores generated PNG and SVG bytes.
- API keys stay server-side and must never use a `NEXT_PUBLIC_` prefix for secrets.

# Production quality control

Loopen treats generated concepts as untrusted candidates:

- A strategy pass creates six brand-specific territories from the complete brief.
- A separate design-director pass selects and briefs only the strongest routes.
- Gemini creates one visual exploration per route (four total).
- Gemini and GPT independently score specification fidelity, idea, distinctiveness,
  craft, small-size clarity and brief fit, then all four scored directions are returned.
- Paid Gemini refinement stays a separate user-triggered step on the concept you pick.
- Recraft vectorizes only user-selected, refined artwork when the source is still raster.
