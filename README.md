# Loopen Brand Studio

Strategy-first AI logo production pipeline.

## Architecture

```text
React / Vinext
      │
Cloudflare Worker API
      ├── OpenAI GPT-5.6 Terra — brand strategy and concept territories
      ├── OpenAI GPT-5.6 Terra — design-director briefs and vector refinement
      ├── Recraft V4.1 Vector — editable SVG execution
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
- A separate design-director pass selects and resolves only the strongest routes.
- Recraft V4.1 Vector executes the selected art-direction briefs as editable SVG.
- Application validation rejects text, external assets and unsafe SVG markup.
- Concepts are scored on idea, distinctiveness, craft, small-size clarity and brief fit.
- Selected concepts remain editable vectors throughout refinement and delivery.

The older FLUX/Moondream/raster-vectorization path remains only as a compatibility fallback
for existing raster projects.
