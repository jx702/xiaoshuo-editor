-- Fabula Studio / Supabase complete schema
-- Run this whole file in Supabase SQL Editor.

create extension if not exists pgcrypto;

-- ---------- profiles ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

-- ---------- projects ----------
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  title text not null,
  slug text not null,
  description text default '',
  cover_url text,
  category text default 'Novel',
  status text not null default 'draft' check (status in ('draft','published','archived')),
  word_count integer not null default 0,
  target_words integer not null default 200000,
  chapter_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id, slug)
);

-- ---------- chapters ----------
create table if not exists public.chapters (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  chapter_number integer not null default 1,
  content text not null default '',
  summary text default '',
  status text not null default 'draft' check (status in ('draft','published')),
  word_count integer not null default 0,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- characters ----------
create table if not exists public.characters (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  role text default '',
  age text default '',
  identity text default '',
  description text default '',
  avatar_url text,
  tags text[] not null default '{}',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- world entries ----------
create table if not exists public.world_entries (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  entry_type text not null default 'Lore',
  parent_id uuid references public.world_entries(id) on delete set null,
  description text default '',
  image_url text,
  tags text[] not null default '{}',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- locations ----------
create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  description text default '',
  region text default '',
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- factions ----------
create table if not exists public.factions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  description text default '',
  emblem_url text,
  ideology text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- timeline ----------
create table if not exists public.timeline_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  event_date text default '',
  era text default '',
  description text default '',
  importance text not null default 'normal' check (importance in ('low','normal','high','critical')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- items ----------
create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  item_type text default '',
  description text default '',
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- abilities ----------
create table if not exists public.abilities (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  ability_type text default 'Ability',
  description text default '',
  cost text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- media ----------
create table if not exists public.media (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  file_url text not null,
  media_type text default 'image',
  created_at timestamptz not null default now()
);

-- ---------- relationships ----------
create table if not exists public.relationships (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  from_character_id uuid not null references public.characters(id) on delete cascade,
  to_character_id uuid not null references public.characters(id) on delete cascade,
  relation_type text not null default 'related',
  description text default '',
  created_at timestamptz not null default now(),
  unique(from_character_id, to_character_id, relation_type)
);

-- ---------- helper functions ----------
create or replace function public.is_project_owner(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.projects
    where id = p_project_id and owner_id = auth.uid()
  );
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- updated_at triggers
do $$
declare
  t text;
begin
  foreach t in array array[
    'projects','chapters','characters','world_entries','locations',
    'factions','timeline_events','items','abilities'
  ]
  loop
    execute format('drop trigger if exists %I_updated_at on public.%I', t, t);
    execute format(
      'create trigger %I_updated_at before update on public.%I for each row execute function public.touch_updated_at()',
      t, t
    );
  end loop;
end $$;

-- chapter word count
create or replace function public.update_chapter_word_count()
returns trigger
language plpgsql
as $$
begin
  new.word_count = array_length(regexp_split_to_array(trim(coalesce(new.content,'')), '\s+'), 1);
  if trim(coalesce(new.content,'')) = '' then new.word_count = 0; end if;
  return new;
end;
$$;

drop trigger if exists chapters_word_count on public.chapters;
create trigger chapters_word_count before insert or update of content on public.chapters
for each row execute function public.update_chapter_word_count();

-- project counters
create or replace function public.refresh_project_counters(p_project_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.projects p
  set word_count = coalesce((select sum(c.word_count) from public.chapters c where c.project_id = p_project_id),0),
      chapter_count = coalesce((select count(*) from public.chapters c where c.project_id = p_project_id),0),
      updated_at = now()
  where p.id = p_project_id;
end;
$$;

create or replace function public.on_chapter_change()
returns trigger
language plpgsql
as $$
begin
  perform public.refresh_project_counters(coalesce(new.project_id, old.project_id));
  return coalesce(new, old);
end;
$$;

drop trigger if exists chapters_refresh_project on public.chapters;
create trigger chapters_refresh_project after insert or update or delete on public.chapters
for each row execute function public.on_chapter_change();

-- ---------- RLS ----------
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.chapters enable row level security;
alter table public.characters enable row level security;
alter table public.world_entries enable row level security;
alter table public.locations enable row level security;
alter table public.factions enable row level security;
alter table public.timeline_events enable row level security;
alter table public.items enable row level security;
alter table public.abilities enable row level security;
alter table public.media enable row level security;
alter table public.relationships enable row level security;

-- profiles
drop policy if exists "profiles own read" on public.profiles;
create policy "profiles own read" on public.profiles for select to authenticated using (id = auth.uid());
drop policy if exists "profiles own insert" on public.profiles;
create policy "profiles own insert" on public.profiles for insert to authenticated with check (id = auth.uid());
drop policy if exists "profiles own update" on public.profiles;
create policy "profiles own update" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- projects: owner full access, published projects public read
drop policy if exists "projects public published read" on public.projects;
create policy "projects public published read" on public.projects for select to anon, authenticated using (status = 'published' or owner_id = auth.uid());
drop policy if exists "projects owner insert" on public.projects;
create policy "projects owner insert" on public.projects for insert to authenticated with check (owner_id = auth.uid());
drop policy if exists "projects owner update" on public.projects;
create policy "projects owner update" on public.projects for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "projects owner delete" on public.projects;
create policy "projects owner delete" on public.projects for delete to authenticated using (owner_id = auth.uid());

-- project child tables
create or replace function public.enable_project_child_policies(p_table text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  execute format('drop policy if exists "%s public published read" on public.%I', p_table, p_table);
  execute format('create policy "%s public published read" on public.%I for select to anon, authenticated using (exists (select 1 from public.projects p where p.id = project_id and (p.status = ''published'' or p.owner_id = auth.uid())))', p_table, p_table);

  execute format('drop policy if exists "%s owner insert" on public.%I', p_table, p_table);
  execute format('create policy "%s owner insert" on public.%I for insert to authenticated with check (public.is_project_owner(project_id))', p_table, p_table);

  execute format('drop policy if exists "%s owner update" on public.%I', p_table, p_table);
  execute format('create policy "%s owner update" on public.%I for update to authenticated using (public.is_project_owner(project_id)) with check (public.is_project_owner(project_id))', p_table, p_table);

  execute format('drop policy if exists "%s owner delete" on public.%I', p_table, p_table);
  execute format('create policy "%s owner delete" on public.%I for delete to authenticated using (public.is_project_owner(project_id))', p_table, p_table);
end $$;

select public.enable_project_child_policies('chapters');
select public.enable_project_child_policies('characters');
select public.enable_project_child_policies('world_entries');
select public.enable_project_child_policies('locations');
select public.enable_project_child_policies('factions');
select public.enable_project_child_policies('timeline_events');
select public.enable_project_child_policies('items');
select public.enable_project_child_policies('abilities');
select public.enable_project_child_policies('media');
select public.enable_project_child_policies('relationships');

-- ---------- Storage ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('gallery', 'gallery', true, 52428800, array['image/*','audio/*','video/*','application/pdf'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "gallery public read" on storage.objects;
create policy "gallery public read" on storage.objects
for select to anon, authenticated
using (bucket_id = 'gallery');

drop policy if exists "gallery authenticated upload" on storage.objects;
create policy "gallery authenticated upload" on storage.objects
for insert to authenticated
with check (bucket_id = 'gallery');

drop policy if exists "gallery authenticated update" on storage.objects;
create policy "gallery authenticated update" on storage.objects
for update to authenticated
using (bucket_id = 'gallery' and owner_id = auth.uid())
with check (bucket_id = 'gallery' and owner_id = auth.uid());

drop policy if exists "gallery authenticated delete" on storage.objects;
create policy "gallery authenticated delete" on storage.objects
for delete to authenticated
using (bucket_id = 'gallery' and owner_id = auth.uid());

-- Optional starter project data is intentionally omitted.
-- The app can create the first project after login.
