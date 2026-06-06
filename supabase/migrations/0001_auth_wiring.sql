-- Launchwhitly — Supabase Auth wiring
--
-- Run this once in the Supabase SQL Editor (or via `supabase db push`).
-- Idempotent: safe to re-run.
--
-- 1. Mirror the auth.users row into our public.profiles table.
-- 2. Enable RLS on profiles (and the other public tables) so anon/authenticated
--    roles can only see what policies allow. The Prisma client connects with the
--    postgres role, which bypasses RLS — so the app layer is still the source
--    of truth for write authorization.

-- ---------------------------------------------------------------------------
-- 1. Profile auto-create trigger
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do update
    set email      = excluded.email,
        name       = coalesce(excluded.name, public.profiles.name),
        avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
        updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 2. Update name/avatar on subsequent updates
-- ---------------------------------------------------------------------------

create or replace function public.handle_user_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
     set email      = new.email,
         name       = coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', public.profiles.name),
         avatar_url = coalesce(new.raw_user_meta_data->>'avatar_url', public.profiles.avatar_url),
         updated_at = now()
   where id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated
  after update of email, raw_user_meta_data on auth.users
  for each row execute function public.handle_user_update();

-- ---------------------------------------------------------------------------
-- 3. Enable RLS on all public tables
--    The Prisma client uses the postgres role (bypasses RLS) for app queries.
--    The anon/authenticated roles used by supabase-js are locked down.
-- ---------------------------------------------------------------------------

alter table public.profiles              enable row level security;
alter table public.organizations         enable row level security;
alter table public.organization_members  enable row level security;
alter table public.projects              enable row level security;
alter table public.environments          enable row level security;
alter table public.flags                 enable row level security;
alter table public.flag_states           enable row level security;
alter table public.segments              enable row level security;
alter table public.api_keys              enable row level security;
alter table public.audit_logs            enable row level security;

-- ---------------------------------------------------------------------------
-- 4. profiles policies
--    - Anyone authenticated can read all profiles (needed for member lookups
--      and for showing "invited by" names).
--    - Users can only update their own row (name/avatar). Email is set by the
--      trigger and is not user-editable.
-- ---------------------------------------------------------------------------

drop policy if exists "profiles are readable by authenticated users" on public.profiles;
create policy "profiles are readable by authenticated users"
  on public.profiles
  for select
  to authenticated
  using (true);

drop policy if exists "users can update their own profile" on public.profiles;
create policy "users can update their own profile"
  on public.profiles
  for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- No insert/delete policy: rows are created by the trigger and never deleted
-- from the app. The trigger function is `security definer` so it can write
-- regardless of RLS.

-- ---------------------------------------------------------------------------
-- 5. Lock down the rest.
--    We don't expose these via the Data API yet (the app uses Prisma, which
--    bypasses RLS). Deny-by-default is the safe baseline.
-- ---------------------------------------------------------------------------

-- No policies on organizations / organization_members / projects / environments /
-- flags / flag_states / segments / api_keys / audit_logs. Without policies, the
-- anon and authenticated roles get zero rows through the Data API. Tighten or
-- loosen per-table policies later if you start using supabase-js for those.
