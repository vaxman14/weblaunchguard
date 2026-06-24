-- 0009: Free tool pivot. Web Launch Guard is now a FREE lead-magnet for
-- CTF Designs, not a paid SaaS. There is no Stripe, no plan selection, and no
-- paid tier shown to anyone. To avoid rewriting the (working) subscription-
-- gated scan/verify/quota code path, every signup is automatically granted a
-- single invisible "comp" subscription:
--   * tier 'enterprise'  -> AI enabled, generous per-domain run cap
--   * status 'active'     -> passes every existing gate
--   * no stripe ids       -> never billed, no payment surface
-- The per-domain run quota stays in place purely as abuse protection for the
-- free Groq backend (it is never surfaced as a paid limit).

-- Extend the existing new-user trigger to also provision a personal workspace
-- and the free comp subscription.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workspace_id uuid;
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name')
  )
  on conflict (id) do nothing;

  -- Ensure a personal workspace exists.
  select id into v_workspace_id
  from public.workspaces
  where owner_user_id = new.id and workspace_type = 'personal'
  limit 1;

  if v_workspace_id is null then
    insert into public.workspaces (name, owner_user_id, workspace_type)
    values (coalesce(new.email, 'Personal') || '''s workspace', new.id, 'personal')
    returning id into v_workspace_id;
  end if;

  -- Grant the free comp subscription if the user has no active one yet.
  if not exists (
    select 1 from public.subscriptions
    where user_id = new.id and status in ('active', 'trialing')
  ) then
    insert into public.subscriptions (user_id, workspace_id, tier, status, current_period_start)
    values (new.id, v_workspace_id, 'enterprise', 'active', now());
  end if;

  return new;
end;
$$;

-- Backfill every existing auth user with a workspace + free comp subscription.
do $$
declare
  r record;
  v_workspace_id uuid;
begin
  for r in select id, email from auth.users loop
    select id into v_workspace_id
    from public.workspaces
    where owner_user_id = r.id and workspace_type = 'personal'
    limit 1;

    if v_workspace_id is null then
      insert into public.workspaces (name, owner_user_id, workspace_type)
      values (coalesce(r.email, 'Personal') || '''s workspace', r.id, 'personal')
      returning id into v_workspace_id;
    end if;

    if not exists (
      select 1 from public.subscriptions
      where user_id = r.id and status in ('active', 'trialing')
    ) then
      insert into public.subscriptions (user_id, workspace_id, tier, status, current_period_start)
      values (r.id, v_workspace_id, 'enterprise', 'active', now());
    end if;
  end loop;
end;
$$;
