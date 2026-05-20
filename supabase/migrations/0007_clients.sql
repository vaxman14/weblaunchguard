-- 0007: client (organization) management for the admin panel.
-- Roman sells to businesses (clients); each client can have multiple users.

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_email text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clients_name_present check (length(trim(name)) > 0)
);

-- Link users to clients (optional — users without a client are "direct" signups)
alter table public.profiles
  add column if not exists client_id uuid references public.clients(id) on delete set null;

create index if not exists profiles_client_id_idx on public.profiles(client_id);

-- Clients are managed exclusively via service role (admin panel only)
alter table public.clients enable row level security;
-- No policies = authenticated role has no access; service role bypasses RLS
