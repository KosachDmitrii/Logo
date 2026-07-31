-- Studio billing: "signals" are prepaid credits for expensive AI actions.
create table if not exists public.studio_wallets (
  user_email text primary key,
  balance integer not null default 0 check (balance >= 0),
  created_at bigint not null,
  updated_at bigint not null
);

create table if not exists public.studio_ledger (
  id uuid primary key,
  user_email text not null references public.studio_wallets(user_email),
  delta integer not null,
  reason text not null,
  ref text,
  created_at bigint not null
);

create index if not exists studio_ledger_user_created_idx
  on public.studio_ledger (user_email, created_at desc);

create table if not exists public.studio_rate_limits (
  bucket text primary key,
  hit_count integer not null default 0,
  window_start bigint not null
);

alter table public.studio_wallets enable row level security;
alter table public.studio_ledger enable row level security;
alter table public.studio_rate_limits enable row level security;

create or replace function public.spend_studio_signals(
  p_email text,
  p_amount integer,
  p_reason text,
  p_ref text default null
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_balance integer;
  now_ms bigint := (extract(epoch from now()) * 1000)::bigint;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'INVALID_AMOUNT';
  end if;

  update public.studio_wallets
  set balance = balance - p_amount,
      updated_at = now_ms
  where user_email = lower(p_email)
    and balance >= p_amount
  returning balance into new_balance;

  if not found then
    raise exception 'INSUFFICIENT_SIGNALS';
  end if;

  insert into public.studio_ledger (id, user_email, delta, reason, ref, created_at)
  values (gen_random_uuid(), lower(p_email), -p_amount, p_reason, p_ref, now_ms);

  return new_balance;
end;
$$;

create or replace function public.grant_studio_signals(
  p_email text,
  p_amount integer,
  p_reason text,
  p_ref text default null
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_balance integer;
  now_ms bigint := (extract(epoch from now()) * 1000)::bigint;
  email text := lower(p_email);
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'INVALID_AMOUNT';
  end if;

  insert into public.studio_wallets (user_email, balance, created_at, updated_at)
  values (email, p_amount, now_ms, now_ms)
  on conflict (user_email) do update
    set balance = public.studio_wallets.balance + excluded.balance,
        updated_at = now_ms
  returning balance into new_balance;

  insert into public.studio_ledger (id, user_email, delta, reason, ref, created_at)
  values (gen_random_uuid(), email, p_amount, p_reason, p_ref, now_ms);

  return new_balance;
end;
$$;

create or replace function public.hit_studio_rate_limit(
  p_bucket text,
  p_limit integer,
  p_window_ms bigint
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  now_ms bigint := (extract(epoch from now()) * 1000)::bigint;
  current_count integer;
  current_start bigint;
begin
  select hit_count, window_start
    into current_count, current_start
  from public.studio_rate_limits
  where bucket = p_bucket
  for update;

  if not found then
    insert into public.studio_rate_limits (bucket, hit_count, window_start)
    values (p_bucket, 1, now_ms);
    return true;
  end if;

  if now_ms - current_start >= p_window_ms then
    update public.studio_rate_limits
    set hit_count = 1,
        window_start = now_ms
    where bucket = p_bucket;
    return true;
  end if;

  if current_count >= p_limit then
    return false;
  end if;

  update public.studio_rate_limits
  set hit_count = hit_count + 1
  where bucket = p_bucket;
  return true;
end;
$$;
