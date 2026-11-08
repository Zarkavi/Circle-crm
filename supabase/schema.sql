-- Circle — Personal CRM schema
-- Run this once in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.
-- Every row belongs to the signed-in user; Row Level Security makes sure nobody else can read it.

create extension if not exists "pgcrypto";

-- People ----------------------------------------------------------------------
create table if not exists public.people (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  full_name text not null,
  nickname text,
  email text,
  phone text,
  birthday text,              -- 'YYYY-MM-DD' or '--MM-DD' when the year is unknown
  city text,
  how_we_met text,
  notes text,
  keep_in_touch_days int,     -- remind me if we haven't talked in N days
  favorite boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Work history ------------------------------------------------------------------
create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  company text not null,
  title text,
  start_date text,            -- free text like '2021' or '2021-03'
  end_date text,
  is_current boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Family & relationships (children, spouse, colleagues, who introduced whom) -----
-- Either links to another person in the CRM (related_person_id) or is just a name (e.g. a child).
create table if not exists public.relationships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  related_person_id uuid references public.people(id) on delete cascade,
  name text,
  relation text not null,     -- child, spouse, partner, parent, sibling, friend, colleague, manager, report, introduced_by, introduced, pet, other
  birthday text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint relationship_target check (related_person_id is not null or name is not null)
);

-- Small details ("loves sushi", "allergic to nuts", "dog named Max") ------------
create table if not exists public.facts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  category text not null default 'other',
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Meetings, calls, messages ----------------------------------------------------
create table if not exists public.interactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  date date not null default current_date,
  kind text not null default 'meeting',  -- meeting, call, coffee, meal, message, event, other
  title text,
  notes text,
  location text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Reminders --------------------------------------------------------------------
create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  person_id uuid references public.people(id) on delete cascade,
  title text not null,
  due_date date not null,
  repeat text not null default 'none',   -- none, monthly, yearly
  done boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Tags -------------------------------------------------------------------------
create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  color text not null default 'violet',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

create table if not exists public.person_tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (person_id, tag_id)
);

-- Indexes, updated_at trigger and Row Level Security for every table ------------
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;

do $$
declare t text;
begin
  foreach t in array array['people','jobs','relationships','facts','interactions','reminders','tags','person_tags'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format(
      'create policy "own rows" on public.%I for all to authenticated
         using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
    execute format('create index if not exists %I on public.%I (user_id)', t || '_user_idx', t);
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format('create trigger set_updated_at before update on public.%I
                    for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

create index if not exists jobs_person_idx on public.jobs (person_id);
create index if not exists relationships_person_idx on public.relationships (person_id);
create index if not exists relationships_related_idx on public.relationships (related_person_id);
create index if not exists facts_person_idx on public.facts (person_id);
create index if not exists interactions_person_idx on public.interactions (person_id);
create index if not exists reminders_person_idx on public.reminders (person_id);
create index if not exists person_tags_person_idx on public.person_tags (person_id);
create index if not exists person_tags_tag_idx on public.person_tags (tag_id);

-- ===== Update 2 (also in migrations/002_photos_and_notifications.sql) =====
-- Photos ------------------------------------------------------------------------
alter table public.people add column if not exists photo_path text;

-- Private bucket; each user can only touch files inside a folder named after their user id.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "avatars: read own" on storage.objects;
drop policy if exists "avatars: insert own" on storage.objects;
drop policy if exists "avatars: update own" on storage.objects;
drop policy if exists "avatars: delete own" on storage.objects;

create policy "avatars: read own" on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "avatars: insert own" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "avatars: update own" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "avatars: delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Push notifications -------------------------------------------------------------
-- One row per phone/browser that turned notifications on.
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  timezone text not null default 'UTC',
  lang text not null default 'en',
  notify_hour int not null default 9,
  last_sent_on date,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;
drop policy if exists "own rows" on public.push_subscriptions;
create policy "own rows" on public.push_subscriptions for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);
drop trigger if exists set_updated_at on public.push_subscriptions;
create trigger set_updated_at before update on public.push_subscriptions
  for each row execute function public.set_updated_at();
