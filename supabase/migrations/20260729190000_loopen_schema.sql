create table if not exists public.logo_projects (
  id uuid primary key,
  user_email text not null,
  brand_name text not null,
  brief_json jsonb not null,
  status text not null default 'created',
  selected_generation_id uuid,
  created_at bigint not null,
  updated_at bigint not null
);

create index if not exists logo_projects_user_created_idx
  on public.logo_projects (user_email, created_at desc);

create table if not exists public.logo_generations (
  id uuid primary key,
  project_id uuid not null references public.logo_projects(id) on delete cascade,
  user_email text not null,
  direction_key text not null,
  direction_title text not null,
  prompt text not null,
  object_key text not null,
  status text not null default 'completed',
  created_at bigint not null
);

create index if not exists logo_generations_project_idx
  on public.logo_generations (project_id);
create index if not exists logo_generations_user_idx
  on public.logo_generations (user_email);

create table if not exists public.logo_assets (
  id uuid primary key,
  project_id uuid not null references public.logo_projects(id) on delete cascade,
  user_email text not null,
  parent_id uuid not null,
  stage text not null check (stage in ('refine', 'vector')),
  label text not null,
  provider text not null,
  model text not null,
  prompt text not null,
  object_key text not null,
  content_type text not null,
  created_at bigint not null
);

create index if not exists logo_assets_project_stage_idx
  on public.logo_assets (project_id, stage);
create index if not exists logo_assets_user_idx
  on public.logo_assets (user_email);

alter table public.logo_projects enable row level security;
alter table public.logo_generations enable row level security;
alter table public.logo_assets enable row level security;

-- The Worker uses a server-only Supabase secret key and performs ownership
-- checks before every query. No anonymous or browser policies are created.
