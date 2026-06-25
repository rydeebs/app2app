-- app-app initial schema
-- Tables: profiles, apps, app_logs, reminders, push_subscriptions

create extension if not exists "pgcrypto";

-- profiles ---------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  created_at timestamptz not null default now()
);

-- auto-create a profile when a new auth user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- apps -------------------------------------------------------------------
create table if not exists public.apps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  icon jsonb not null default '{"emoji":"📦","color":"#9b86d4"}'::jsonb,
  app_spec jsonb not null,
  source_md text,
  created_at timestamptz not null default now()
);
create index if not exists apps_user_id_idx on public.apps(user_id);

-- app_logs ---------------------------------------------------------------
create table if not exists public.app_logs (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references public.apps(id) on delete cascade,
  metric_key text not null,
  value jsonb not null,
  logged_at timestamptz not null default now()
);
create index if not exists app_logs_app_metric_idx on public.app_logs(app_id, metric_key, logged_at);

-- reminders --------------------------------------------------------------
create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references public.apps(id) on delete cascade,
  title text not null,
  body text not null,
  days text[] not null,
  time text not null,
  enabled boolean not null default true,
  next_fire_at timestamptz
);
create index if not exists reminders_next_fire_idx on public.reminders(next_fire_at) where enabled;

-- push_subscriptions -----------------------------------------------------
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  keys jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists push_subs_user_idx on public.push_subscriptions(user_id);

-- Row Level Security -----------------------------------------------------
alter table public.profiles enable row level security;
alter table public.apps enable row level security;
alter table public.app_logs enable row level security;
alter table public.reminders enable row level security;
alter table public.push_subscriptions enable row level security;

-- profiles
drop policy if exists "profiles self" on public.profiles;
create policy "profiles self" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

-- apps
drop policy if exists "apps owner" on public.apps;
create policy "apps owner" on public.apps
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- app_logs (ownership via parent app)
drop policy if exists "app_logs owner" on public.app_logs;
create policy "app_logs owner" on public.app_logs
  for all using (
    exists (select 1 from public.apps a where a.id = app_logs.app_id and a.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.apps a where a.id = app_logs.app_id and a.user_id = auth.uid())
  );

-- reminders (ownership via parent app)
drop policy if exists "reminders owner" on public.reminders;
create policy "reminders owner" on public.reminders
  for all using (
    exists (select 1 from public.apps a where a.id = reminders.app_id and a.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.apps a where a.id = reminders.app_id and a.user_id = auth.uid())
  );

-- push_subscriptions
drop policy if exists "push subs owner" on public.push_subscriptions;
create policy "push subs owner" on public.push_subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
