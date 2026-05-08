-- 0004: defence-in-depth follow-ups identified during the post-merge review.
--   * atomic scan-slot reservation (closes a count-then-insert race),
--   * uniqueness on verified hostnames (so the system has one truth per domain),
--   * RLS for reports + findings: writes are service-role only.

-- Atomic quota reservation. Holds a transaction-scoped advisory lock keyed
-- on (subscription_id, domain_id) so two concurrent reservations cannot both
-- pass the count check. Returns the new scan_runs id when allowed, or null.
create or replace function public.reserve_scan_slot(
  p_user_id uuid,
  p_workspace_id uuid,
  p_subscription_id uuid,
  p_domain_id uuid,
  p_scan_type text,
  p_ip inet,
  p_period_start timestamptz,
  p_limit int
) returns table (run_id uuid, allowed boolean, used int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_used int;
  v_run_id uuid;
begin
  perform pg_advisory_xact_lock(
    hashtextextended(p_subscription_id::text || ':' || p_domain_id::text, 0)
  );

  select count(*) into v_used
  from public.scan_runs
  where subscription_id = p_subscription_id
    and domain_id = p_domain_id
    and created_at >= p_period_start;

  if v_used >= p_limit then
    return query select null::uuid, false, v_used;
    return;
  end if;

  insert into public.scan_runs (
    user_id,
    workspace_id,
    subscription_id,
    domain_id,
    scan_type,
    ip_address
  ) values (
    p_user_id,
    p_workspace_id,
    p_subscription_id,
    p_domain_id,
    p_scan_type,
    p_ip
  )
  returning id into v_run_id;

  return query select v_run_id, true, v_used + 1;
end;
$$;

revoke all on function public.reserve_scan_slot from public, anon, authenticated;

-- Hostname uniqueness limited to verified rows. Two users may both have a
-- pending claim on example.com; only the first to verify locks it system-wide.
create unique index if not exists domains_verified_hostname_idx
  on public.domains(hostname)
  where verification_status = 'verified';

-- Reports and findings: writes go through the netlify functions (service
-- role), not the supabase-js client. Drop the authenticated-role write
-- policies; SELECT and DELETE policies (for the user's own rows) are kept.
drop policy if exists "Users can insert their reports" on public.reports;
drop policy if exists "Users can update their reports" on public.reports;
drop policy if exists "Users can insert findings into their reports" on public.findings;
drop policy if exists "Users can update findings from their reports" on public.findings;
