create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_email_format check (position('@' in email) > 1)
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  workspace_type text not null default 'personal',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workspaces_name_present check (length(trim(name)) > 0),
  constraint workspaces_type_check check (workspace_type in ('personal'))
);

create table public.domains (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  hostname text not null,
  verification_status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint domains_hostname_present check (length(trim(hostname)) > 0),
  constraint domains_verification_status_check check (
    verification_status in ('pending', 'verified', 'failed')
  ),
  unique (workspace_id, hostname)
);

create table public.scan_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  domain_id uuid not null references public.domains(id) on delete cascade,
  status text not null default 'queued',
  requested_url text not null,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint scan_jobs_status_check check (
    status in ('queued', 'running', 'succeeded', 'failed', 'canceled')
  ),
  constraint scan_jobs_requested_url_present check (length(trim(requested_url)) > 0)
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  domain_id uuid not null references public.domains(id) on delete cascade,
  scan_job_id uuid references public.scan_jobs(id) on delete set null,
  status text not null default 'draft',
  summary text,
  score integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reports_status_check check (status in ('draft', 'ready', 'archived')),
  constraint reports_score_range check (score is null or (score >= 0 and score <= 100))
);

create table public.findings (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete cascade,
  category text not null,
  severity text not null,
  title text not null,
  description text,
  evidence jsonb not null default '{}'::jsonb,
  remediation text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint findings_category_check check (
    category in ('accessibility', 'security', 'performance', 'seo', 'trust', 'privacy')
  ),
  constraint findings_severity_check check (severity in ('low', 'medium', 'high', 'critical')),
  constraint findings_title_present check (length(trim(title)) > 0)
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  plan text not null default 'free',
  status text not null default 'inactive',
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscriptions_plan_check check (plan in ('free', 'pro')),
  constraint subscriptions_status_check check (
    status in ('inactive', 'trialing', 'active', 'past_due', 'canceled')
  ),
  unique (workspace_id)
);

create index workspaces_owner_user_id_idx on public.workspaces(owner_user_id);
create index domains_user_id_idx on public.domains(user_id);
create index domains_workspace_id_idx on public.domains(workspace_id);
create index scan_jobs_user_id_idx on public.scan_jobs(user_id);
create index scan_jobs_domain_id_idx on public.scan_jobs(domain_id);
create index reports_user_id_idx on public.reports(user_id);
create index reports_scan_job_id_idx on public.reports(scan_job_id);
create index findings_report_id_idx on public.findings(report_id);
create index subscriptions_user_id_idx on public.subscriptions(user_id);

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.domains enable row level security;
alter table public.scan_jobs enable row level security;
alter table public.reports enable row level security;
alter table public.findings enable row level security;
alter table public.subscriptions enable row level security;

create policy "Users can select their profile"
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()));

create policy "Users can insert their profile"
  on public.profiles for insert
  to authenticated
  with check (id = (select auth.uid()));

create policy "Users can update their profile"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "Users can delete their profile"
  on public.profiles for delete
  to authenticated
  using (id = (select auth.uid()));

create policy "Users can select their workspaces"
  on public.workspaces for select
  to authenticated
  using (owner_user_id = (select auth.uid()));

create policy "Users can insert their workspaces"
  on public.workspaces for insert
  to authenticated
  with check (owner_user_id = (select auth.uid()));

create policy "Users can update their workspaces"
  on public.workspaces for update
  to authenticated
  using (owner_user_id = (select auth.uid()))
  with check (owner_user_id = (select auth.uid()));

create policy "Users can delete their workspaces"
  on public.workspaces for delete
  to authenticated
  using (owner_user_id = (select auth.uid()));

create policy "Users can select their domains"
  on public.domains for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "Users can insert their domains"
  on public.domains for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.workspaces
      where workspaces.id = domains.workspace_id
        and workspaces.owner_user_id = (select auth.uid())
    )
  );

create policy "Users can update their domains"
  on public.domains for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.workspaces
      where workspaces.id = domains.workspace_id
        and workspaces.owner_user_id = (select auth.uid())
    )
  );

create policy "Users can delete their domains"
  on public.domains for delete
  to authenticated
  using (user_id = (select auth.uid()));

create policy "Users can select their scan jobs"
  on public.scan_jobs for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "Users can insert their scan jobs"
  on public.scan_jobs for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.workspaces
      where workspaces.id = scan_jobs.workspace_id
        and workspaces.owner_user_id = (select auth.uid())
    )
    and exists (
      select 1 from public.domains
      where domains.id = scan_jobs.domain_id
        and domains.user_id = (select auth.uid())
        and domains.workspace_id = scan_jobs.workspace_id
    )
  );

create policy "Users can update their scan jobs"
  on public.scan_jobs for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.workspaces
      where workspaces.id = scan_jobs.workspace_id
        and workspaces.owner_user_id = (select auth.uid())
    )
    and exists (
      select 1 from public.domains
      where domains.id = scan_jobs.domain_id
        and domains.user_id = (select auth.uid())
        and domains.workspace_id = scan_jobs.workspace_id
    )
  );

create policy "Users can delete their scan jobs"
  on public.scan_jobs for delete
  to authenticated
  using (user_id = (select auth.uid()));

create policy "Users can select their reports"
  on public.reports for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "Users can insert their reports"
  on public.reports for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.workspaces
      where workspaces.id = reports.workspace_id
        and workspaces.owner_user_id = (select auth.uid())
    )
    and exists (
      select 1 from public.domains
      where domains.id = reports.domain_id
        and domains.user_id = (select auth.uid())
        and domains.workspace_id = reports.workspace_id
    )
    and (
      reports.scan_job_id is null
      or exists (
        select 1 from public.scan_jobs
        where scan_jobs.id = reports.scan_job_id
          and scan_jobs.user_id = (select auth.uid())
          and scan_jobs.workspace_id = reports.workspace_id
          and scan_jobs.domain_id = reports.domain_id
      )
    )
  );

create policy "Users can update their reports"
  on public.reports for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.workspaces
      where workspaces.id = reports.workspace_id
        and workspaces.owner_user_id = (select auth.uid())
    )
    and exists (
      select 1 from public.domains
      where domains.id = reports.domain_id
        and domains.user_id = (select auth.uid())
        and domains.workspace_id = reports.workspace_id
    )
    and (
      reports.scan_job_id is null
      or exists (
        select 1 from public.scan_jobs
        where scan_jobs.id = reports.scan_job_id
          and scan_jobs.user_id = (select auth.uid())
          and scan_jobs.workspace_id = reports.workspace_id
          and scan_jobs.domain_id = reports.domain_id
      )
    )
  );

create policy "Users can delete their reports"
  on public.reports for delete
  to authenticated
  using (user_id = (select auth.uid()));

create policy "Users can select findings from their reports"
  on public.findings for select
  to authenticated
  using (
    exists (
      select 1 from public.reports
      where reports.id = findings.report_id
        and reports.user_id = (select auth.uid())
    )
  );

create policy "Users can insert findings into their reports"
  on public.findings for insert
  to authenticated
  with check (
    exists (
      select 1 from public.reports
      where reports.id = findings.report_id
        and reports.user_id = (select auth.uid())
    )
  );

create policy "Users can update findings from their reports"
  on public.findings for update
  to authenticated
  using (
    exists (
      select 1 from public.reports
      where reports.id = findings.report_id
        and reports.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.reports
      where reports.id = findings.report_id
        and reports.user_id = (select auth.uid())
    )
  );

create policy "Users can delete findings from their reports"
  on public.findings for delete
  to authenticated
  using (
    exists (
      select 1 from public.reports
      where reports.id = findings.report_id
        and reports.user_id = (select auth.uid())
    )
  );

create policy "Users can select their subscriptions"
  on public.subscriptions for select
  to authenticated
  using (user_id = (select auth.uid()));
