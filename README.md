# Loopen Brand Studio

Strategy-first AI logo production pipeline.

## Architecture

```text
React / Vinext
      │
Cloudflare Worker API
      ├── Cloudflare Workers AI / FLUX.2 Dev — concept exploration
      ├── OpenAI GPT Image 2 — selected-concept refinement
      ├── Recraft API — final SVG
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
