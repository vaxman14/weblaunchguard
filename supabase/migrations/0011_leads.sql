-- 0011: lead-magnet pivot. WebLaunchGuard captures leads instead of accounts.
-- A free scan is shown ungated; the full report is unlocked by submitting
-- name + business + email (stored here), optionally joining the newsletter.
-- Service-role only — never readable by the public/anon role.

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  name text,
  business text,
  scanned_url text,
  hostname text,
  score int,
  findings_count int,
  newsletter_opt_in boolean not null default false,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now(),
  constraint leads_email_format check (position('@' in email) > 1)
);

create index if not exists leads_created_at_idx on public.leads(created_at desc);
create index if not exists leads_email_idx on public.leads(lower(email));

alter table public.leads enable row level security;
-- No policies = no anon/authenticated access. Only the service role (used by
-- the netlify submit-lead function) can read or write leads.
