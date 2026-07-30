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

Create `.env.local`:

```env
OPENAI_API_KEY=
RECRAFT_API_KEY=
GEMINI_API_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_STORAGE_BUCKET=logo-files
```

Apply migrations in `backend/supabase/migrations/` to the Supabase project
(schema + private `logo-files` storage bucket) before starting the app.

```bash
npm install
npm test
npm run dev
```

The local development server uses the private `Local Studio` identity, so no
sign-in step is required.

## Railway

- Build: `npm run build`
- Start: `npm start`
- Healthcheck: `/`
- Variables: same as `.env.example` (no Cloudflare keys)

Config-as-code: [`railway.json`](railway.json).

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
