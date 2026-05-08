-- 0003: tiered billing model (basic/pro/enterprise), per-domain subscriptions
-- for basic, server-issued verification tokens, run-quota tracking, rate
-- limiting, and richer report persistence.

-- subscriptions: allow multiple per workspace, add tier + period start
alter table public.subscriptions
  drop constraint if exists subscriptions_workspace_id_key;

alter table public.subscriptions
  drop constraint if exists subscriptions_plan_check;

alter table public.subscriptions
  add column if not exists tier text not null default 'basic',
  add column if not exists current_period_start timestamptz;

alter table public.subscriptions
  add constraint subscriptions_tier_check
    check (tier in ('basic', 'pro', 'enterprise'));

-- Replace partial unique index with a real unique constraint so
-- postgrest upsert(onConflict: stripe_subscription_id) is valid.
drop index if exists public.subscriptions_stripe_subscription_id_idx;

alter table public.subscriptions
  add constraint subscriptions_stripe_subscription_id_unique
    unique (stripe_subscription_id);

-- domains: attach to a subscription, server-issued verification token,
-- last verified timestamp.
alter table public.domains
  add column if not exists subscription_id uuid references public.subscriptions(id) on delete set null,
  add column if not exists verification_token text,
  add column if not exists verified_at timestamptz;

create index if not exists domains_subscription_id_idx
  on public.domains(subscription_id);

create unique index if not exists domains_verification_token_idx
  on public.domains(verification_token)
  where verification_token is not null;

-- domains: tighten RLS so users cannot self-mark verified or set tokens.
-- only the service role (via netlify functions) writes those fields.
drop policy if exists "Users can insert their domains" on public.domains;
drop policy if exists "Users can update their domains" on public.domains;

-- reports: richer persistence for scan output. existing columns kept.
alter table public.reports
  add column if not exists target_url text,
  add column if not exists scan_type text,
  add column if not exists subscription_id uuid references public.subscriptions(id) on delete set null,
  add column if not exists payload jsonb not null default '{}'::jsonb;

alter table public.reports
  drop constraint if exists reports_status_check;

alter table public.reports
  add constraint reports_status_check
    check (status in ('draft', 'ready', 'archived'));

create index if not exists reports_subscription_id_idx
  on public.reports(subscription_id);

-- findings: broaden category to match analyzer output.
alter table public.findings
  drop constraint if exists findings_category_check;

alter table public.findings
  add constraint findings_category_check check (
    category in (
      'transport',
      'security-headers',
      'privacy-headers',
      'cookies',
      'accessibility',
      'soc2',
      'ai-review',
      'controlled-inspection',
      'general'
    )
  );

-- scan_runs: per-run audit + quota counting source of truth.
create table if not exists public.scan_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  subscription_id uuid not null references public.subscriptions(id) on delete cascade,
  domain_id uuid not null references public.domains(id) on delete cascade,
  report_id uuid references public.reports(id) on delete set null,
  scan_type text not null,
  ip_address inet,
  created_at timestamptz not null default now(),
  constraint scan_runs_scan_type_check
    check (scan_type in ('passive', 'guided-ai-review', 'controlled-live-inspection'))
);

create index if not exists scan_runs_domain_id_created_at_idx
  on public.scan_runs(domain_id, created_at);

create index if not exists scan_runs_subscription_id_created_at_idx
  on public.scan_runs(subscription_id, created_at);

alter table public.scan_runs enable row level security;

create policy "Users can select their scan runs"
  on public.scan_runs for select
  to authenticated
  using (user_id = (select auth.uid()));

-- inserts and deletes are service-role only (no policy = denied for
-- authenticated role).

-- rate_limits: rolling-window per-bucket counters. service-role only.
create table if not exists public.rate_limits (
  id uuid primary key default gen_random_uuid(),
  bucket text not null,
  created_at timestamptz not null default now()
);

create index if not exists rate_limits_bucket_created_at_idx
  on public.rate_limits(bucket, created_at);

alter table public.rate_limits enable row level security;
-- no policies = no authenticated access, only service role writes.

-- helper: count rows in scan_runs for a domain within a window.
-- exposed for service role queries via PostgREST is unnecessary; the function
-- handlers use direct sql via supabase-js.

-- helper: prune rate_limits older than 1 hour. called periodically by the
-- functions themselves on insert (best-effort).
create or replace function public.prune_rate_limits(bucket_filter text, window_seconds int)
returns void
language sql
as $$
  delete from public.rate_limits
  where bucket = bucket_filter
    and created_at < now() - make_interval(secs => window_seconds);
$$;
