-- 0006: auto-create profile row on new user signup.
-- Without this trigger, profiles must be created manually — the admin
-- is_admin check silently falls through when no row exists.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute procedure public.handle_new_user();

-- Backfill any existing auth users who don't have a profile row yet.
insert into public.profiles (id, email, full_name)
select
  au.id,
  au.email,
  coalesce(au.raw_user_meta_data->>'full_name', au.raw_user_meta_data->>'name')
from auth.users au
where not exists (
  select 1 from public.profiles p where p.id = au.id
);
