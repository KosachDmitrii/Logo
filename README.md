# Loopen Brand Studio

Strategy-first AI logo production pipeline.

## Architecture

```text
React / Vinext
      │
Cloudflare Worker API
      ├── OpenAI GPT-5.6 Terra — brand strategy and art-direction briefs
      ├── Gemini 3 Pro Image — four explorations and two refinements
      ├── Gemini + GPT-5.6 Sol — independent visual jury
      ├── Recraft — selected raster-to-SVG production
      ├── Recraft API — legacy raster-to-vector fallback
      ├── Supabase PostgreSQL — projects and metadata
      └── Cloudflare R2 — PNG and SVG assets
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
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_API_TOKEN=
```

Apply `supabase/migrations/20260729190000_loopen_schema.sql` to the Supabase
project before starting the app.

```bash
npm install
npm test
npm run dev
```

The local development server uses the private `Local Studio` identity, so no
sign-in step is required.

## Data ownership

- Supabase stores project, generation, selection, and asset metadata.
- R2 stores generated PNG and SVG bytes.
- API keys stay server-side and must never use a `VITE_` prefix.
# Production quality control

Loopen treats generated concepts as untrusted candidates:

- A strategy pass creates six brand-specific territories from the complete brief.
- A separate design-director pass selects and briefs only the strongest routes.
- Gemini creates one visual exploration per route (four total).
- Gemini and GPT independently score specification fidelity, idea, distinctiveness,
  craft, small-size clarity and brief fit, then all four scored directions are returned.
- Paid Gemini refinement stays a separate user-triggered step on the concept you pick.
- Recraft vectorizes only user-selected, refined artwork.

The older FLUX/Moondream/raster-vectorization path remains only as a compatibility fallback
for existing raster projects.
