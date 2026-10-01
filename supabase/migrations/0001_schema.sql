-- ═══════════════════════════════════════════════════════════════════════════
-- CineMood — core schema, indexes, RLS, analytics views
-- Run in the Supabase SQL editor or with `supabase db push`.
-- ═══════════════════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";

-- ───────────────────────── Users ─────────────────────────

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text,
  avatar_url text,
  preferred_language text,
  preferred_region text,
  theme text check (theme in ('system', 'light', 'dark')) default 'system',
  is_suspended boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Create a profile row automatically on sign-up.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('super_admin', 'admin', 'editor', 'moderator')),
  created_at timestamptz not null default now()
);

-- Role check used by RLS policies. SECURITY DEFINER so it can read admin_users.
create or replace function public.has_admin_role(min_role text default 'editor') returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.admin_users a
    where a.user_id = auth.uid()
      and array_position(array['moderator', 'editor', 'admin', 'super_admin'], a.role)
          >= array_position(array['moderator', 'editor', 'admin', 'super_admin'], min_role)
  );
$$;

-- ───────────────────────── Catalog ─────────────────────────

create table if not exists public.movies (
  id uuid primary key default gen_random_uuid(),
  tmdb_id integer not null unique,
  title text not null,
  original_title text,
  original_language text,
  overview text,
  poster_path text,
  backdrop_path text,
  release_date date,
  runtime integer,
  vote_average numeric(3, 1),
  vote_count integer,
  popularity numeric(12, 3),
  adult boolean not null default false,
  status text,
  homepage text,
  keywords text[] not null default '{}',
  is_hidden boolean not null default false,
  is_featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_synced_at timestamptz
);

create table if not exists public.languages (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,          -- ISO 639-1
  name text not null,
  native_name text,
  region text,
  is_active boolean not null default true
);

-- Spoken languages. Deliberately separate from movies.original_language and from countries.
create table if not exists public.movie_languages (
  movie_id uuid references public.movies (id) on delete cascade,
  language_id uuid references public.languages (id) on delete cascade,
  primary key (movie_id, language_id)
);

create table if not exists public.genres (
  id uuid primary key default gen_random_uuid(),
  tmdb_id integer not null unique,
  name text not null,
  slug text not null unique
);

create table if not exists public.movie_genres (
  movie_id uuid references public.movies (id) on delete cascade,
  genre_id uuid references public.genres (id) on delete cascade,
  primary key (movie_id, genre_id)
);

create table if not exists public.countries (
  id uuid primary key default gen_random_uuid(),
  iso_code text not null unique,      -- ISO 3166-1
  name text not null
);

create table if not exists public.movie_countries (
  movie_id uuid references public.movies (id) on delete cascade,
  country_id uuid references public.countries (id) on delete cascade,
  primary key (movie_id, country_id)
);

create table if not exists public.people (
  id uuid primary key default gen_random_uuid(),
  tmdb_id integer not null unique,
  name text not null,
  profile_path text,
  biography text
);

create table if not exists public.movie_cast (
  movie_id uuid references public.movies (id) on delete cascade,
  person_id uuid references public.people (id) on delete cascade,
  character_name text,
  cast_order integer
);

create table if not exists public.movie_crew (
  movie_id uuid references public.movies (id) on delete cascade,
  person_id uuid references public.people (id) on delete cascade,
  department text,
  job text
);

-- ───────────────────────── Moods ─────────────────────────

create table if not exists public.moods (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  icon text not null,
  description text,
  tagline text,
  accent text,
  featured boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0
);

create table if not exists public.movie_moods (
  movie_id uuid references public.movies (id) on delete cascade,
  mood_id uuid references public.moods (id) on delete cascade,
  score numeric(3, 2) not null check (score between 0 and 1),
  confidence numeric(3, 2) not null check (confidence between 0 and 1),
  source text not null check (source in ('ai', 'rules', 'manual')),
  model_version text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),   -- = last_calculated_at
  primary key (movie_id, mood_id)
);

-- ───────────────────────── Streaming availability (licensed data only) ─────────────────────────

create table if not exists public.streaming_providers (
  id uuid primary key default gen_random_uuid(),
  tmdb_provider_id integer unique,
  name text not null,
  logo_path text,
  website text
);

create table if not exists public.movie_availability (
  movie_id uuid references public.movies (id) on delete cascade,
  provider_id uuid references public.streaming_providers (id) on delete cascade,
  region text not null,
  availability_type text not null check (availability_type in ('subscription', 'rent', 'buy', 'free', 'ads')),
  link text,
  last_verified_at timestamptz not null default now(),
  primary key (movie_id, provider_id, region, availability_type)
);

-- ───────────────────────── User data ─────────────────────────

-- Keyed on tmdb_id so users can save any TMDB movie, ingested or not.
-- `snapshot` caches title/poster/etc. for fast list rendering.
create table if not exists public.watchlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  tmdb_id integer not null,
  movie_id uuid references public.movies (id) on delete set null,
  status text not null check (status in ('want', 'watched')) default 'want',
  is_favorite boolean not null default false,
  my_rating smallint check (my_rating between 1 and 5),
  snapshot jsonb not null default '{}',
  watched_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, tmdb_id)
);

create table if not exists public.user_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  mood_id uuid not null references public.moods (id) on delete cascade,
  preference_score numeric(6, 3) not null default 0,
  unique (user_id, mood_id)
);

create table if not exists public.user_genre_preferences (
  user_id uuid not null references auth.users (id) on delete cascade,
  genre_id uuid not null references public.genres (id) on delete cascade,
  preference_score numeric(6, 3) not null default 0,
  primary key (user_id, genre_id)
);

create table if not exists public.user_language_preferences (
  user_id uuid not null references auth.users (id) on delete cascade,
  language_id uuid not null references public.languages (id) on delete cascade,
  preference_score numeric(6, 3) not null default 0,
  primary key (user_id, language_id)
);

create table if not exists public.user_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,   -- null for anonymous visitors
  event_type text not null,
  tmdb_id integer,
  movie_id uuid references public.movies (id) on delete set null,
  mood_id uuid references public.moods (id) on delete set null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.recommendation_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  tmdb_id integer not null,
  movie_id uuid references public.movies (id) on delete set null,
  request_id uuid not null,
  recommendation_score numeric(6, 4) not null,
  ranking_position integer not null,
  reason jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- ───────────────────────── Admin configuration ─────────────────────────

create table if not exists public.recommendation_configs (
  id uuid primary key default gen_random_uuid(),
  version integer not null unique,
  weights jsonb not null,
  note text,
  is_active boolean not null default false,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index if not exists recommendation_configs_one_active on public.recommendation_configs (is_active) where is_active;

create table if not exists public.feature_flags (
  key text primary key,
  enabled boolean not null default false,
  description text,
  updated_at timestamptz not null default now()
);

create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  description text,
  cover_image text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  start_date date,
  end_date date,
  created_at timestamptz not null default now()
);

create table if not exists public.collection_movies (
  collection_id uuid references public.collections (id) on delete cascade,
  movie_id uuid references public.movies (id) on delete cascade,
  position integer not null default 0,
  primary key (collection_id, movie_id)
);

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('movie_sync', 'mood_classification', 'image_refresh', 'availability_refresh', 'recommendation_recalc')),
  status text not null check (status in ('queued', 'running', 'completed', 'failed')) default 'queued',
  payload jsonb not null default '{}',
  result jsonb,
  attempts integer not null default 0,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);

-- ───────────────────────── Indexes ─────────────────────────

create index if not exists movies_original_language_idx on public.movies (original_language);
create index if not exists movies_release_date_idx on public.movies (release_date desc);
create index if not exists movies_vote_average_idx on public.movies (vote_average desc);
create index if not exists movies_popularity_idx on public.movies (popularity desc);
create index if not exists movie_moods_mood_idx on public.movie_moods (mood_id);
create index if not exists movie_moods_mood_score_idx on public.movie_moods (mood_id, score desc);
create index if not exists movie_languages_language_idx on public.movie_languages (language_id);
create index if not exists movie_genres_genre_idx on public.movie_genres (genre_id);
create index if not exists movie_countries_country_idx on public.movie_countries (country_id);
create index if not exists movie_cast_movie_idx on public.movie_cast (movie_id);
create index if not exists movie_crew_movie_idx on public.movie_crew (movie_id);
create index if not exists user_events_user_idx on public.user_events (user_id);
create index if not exists user_events_created_idx on public.user_events (created_at desc);
create index if not exists user_events_type_created_idx on public.user_events (event_type, created_at desc);
create index if not exists movie_availability_region_idx on public.movie_availability (region);
create index if not exists movie_availability_provider_idx on public.movie_availability (provider_id);
create index if not exists watchlists_user_idx on public.watchlists (user_id, created_at desc);
create index if not exists recommendation_logs_request_idx on public.recommendation_logs (request_id);
create index if not exists recommendation_logs_created_idx on public.recommendation_logs (created_at desc);

-- ───────────────────────── Row Level Security ─────────────────────────

alter table public.profiles enable row level security;
alter table public.admin_users enable row level security;
alter table public.movies enable row level security;
alter table public.languages enable row level security;
alter table public.movie_languages enable row level security;
alter table public.genres enable row level security;
alter table public.movie_genres enable row level security;
alter table public.countries enable row level security;
alter table public.movie_countries enable row level security;
alter table public.people enable row level security;
alter table public.movie_cast enable row level security;
alter table public.movie_crew enable row level security;
alter table public.moods enable row level security;
alter table public.movie_moods enable row level security;
alter table public.streaming_providers enable row level security;
alter table public.movie_availability enable row level security;
alter table public.watchlists enable row level security;
alter table public.user_preferences enable row level security;
alter table public.user_genre_preferences enable row level security;
alter table public.user_language_preferences enable row level security;
alter table public.user_events enable row level security;
alter table public.recommendation_logs enable row level security;
alter table public.recommendation_configs enable row level security;
alter table public.feature_flags enable row level security;
alter table public.collections enable row level security;
alter table public.collection_movies enable row level security;
alter table public.jobs enable row level security;

-- Public catalog: anyone can read; only admins (editor+) can write.
do $$
declare t text;
begin
  foreach t in array array['languages', 'movie_languages', 'genres', 'movie_genres', 'countries', 'movie_countries',
                           'people', 'movie_cast', 'movie_crew', 'movie_moods', 'streaming_providers', 'movie_availability',
                           'collection_movies']
  loop
    execute format('drop policy if exists "%1$s public read" on public.%1$I', t);
    execute format('create policy "%1$s public read" on public.%1$I for select using (true)', t);
    execute format('drop policy if exists "%1$s admin write" on public.%1$I', t);
    execute format('create policy "%1$s admin write" on public.%1$I for all using (public.has_admin_role(''editor'')) with check (public.has_admin_role(''editor''))', t);
  end loop;
end $$;

drop policy if exists "movies public read" on public.movies;
create policy "movies public read" on public.movies for select using (not is_hidden or public.has_admin_role('moderator'));
drop policy if exists "movies admin write" on public.movies;
create policy "movies admin write" on public.movies for all using (public.has_admin_role('editor')) with check (public.has_admin_role('editor'));

drop policy if exists "moods public read" on public.moods;
create policy "moods public read" on public.moods for select using (is_active or public.has_admin_role('moderator'));
drop policy if exists "moods admin write" on public.moods;
create policy "moods admin write" on public.moods for all using (public.has_admin_role('admin')) with check (public.has_admin_role('admin'));

drop policy if exists "collections public read" on public.collections;
create policy "collections public read" on public.collections for select
  using ((is_active and (start_date is null or start_date <= current_date) and (end_date is null or end_date >= current_date)) or public.has_admin_role('moderator'));
drop policy if exists "collections admin write" on public.collections;
create policy "collections admin write" on public.collections for all using (public.has_admin_role('editor')) with check (public.has_admin_role('editor'));

-- Profiles: owner read/update; admins read.
drop policy if exists "profiles own read" on public.profiles;
create policy "profiles own read" on public.profiles for select using (id = auth.uid() or public.has_admin_role('moderator'));
drop policy if exists "profiles own update" on public.profiles;
create policy "profiles own update" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid() and is_suspended = (select p.is_suspended from public.profiles p where p.id = auth.uid()));
drop policy if exists "profiles admin update" on public.profiles;
create policy "profiles admin update" on public.profiles for update using (public.has_admin_role('admin'));

-- Watchlist & preferences: strictly owner-only.
do $$
declare t text;
begin
  foreach t in array array['watchlists', 'user_preferences', 'user_genre_preferences', 'user_language_preferences']
  loop
    execute format('drop policy if exists "%1$s owner" on public.%1$I', t);
    execute format('create policy "%1$s owner" on public.%1$I for all using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;

-- Events: users may insert/read their own; anonymous inserts go through the server (service role).
drop policy if exists "events own insert" on public.user_events;
create policy "events own insert" on public.user_events for insert with check (user_id = auth.uid());
drop policy if exists "events own read" on public.user_events;
create policy "events own read" on public.user_events for select using (user_id = auth.uid() or public.has_admin_role('moderator'));

-- Admin-only tables (the server's service role bypasses RLS for jobs and logs).
drop policy if exists "admin_users read" on public.admin_users;
create policy "admin_users read" on public.admin_users for select using (user_id = auth.uid() or public.has_admin_role('admin'));
drop policy if exists "admin_users manage" on public.admin_users;
create policy "admin_users manage" on public.admin_users for all using (public.has_admin_role('super_admin')) with check (public.has_admin_role('super_admin'));

drop policy if exists "configs admin read" on public.recommendation_configs;
create policy "configs admin read" on public.recommendation_configs for select using (public.has_admin_role('moderator'));
drop policy if exists "configs admin write" on public.recommendation_configs;
create policy "configs admin write" on public.recommendation_configs for all using (public.has_admin_role('admin')) with check (public.has_admin_role('admin'));

drop policy if exists "flags public read" on public.feature_flags;
create policy "flags public read" on public.feature_flags for select using (true);
drop policy if exists "flags admin write" on public.feature_flags;
create policy "flags admin write" on public.feature_flags for all using (public.has_admin_role('admin')) with check (public.has_admin_role('admin'));

drop policy if exists "jobs admin read" on public.jobs;
create policy "jobs admin read" on public.jobs for select using (public.has_admin_role('moderator'));

drop policy if exists "rec logs admin read" on public.recommendation_logs;
create policy "rec logs admin read" on public.recommendation_logs for select using (public.has_admin_role('moderator'));

-- ───────────────────────── Analytics & admin views ─────────────────────────
-- Read by the server with the service role; not exposed to anon/authenticated.

create or replace view public.movies_missing_moods as
  select m.tmdb_id from public.movies m
  where not exists (select 1 from public.movie_moods mm where mm.movie_id = m.id)
  order by m.popularity desc nulls last;

create or replace view public.admin_overview as
  select
    (select count(*) from public.movies) as total_movies,
    (select count(*) from public.movies where created_at > now() - interval '7 days') as movies_this_week,
    (select count(distinct movie_id) from public.movie_moods) as movies_with_moods,
    (select count(*) from public.movies_missing_moods) as pending_moods,
    (select count(*) from public.profiles) as users,
    (select count(distinct user_id) from public.user_events where user_id is not null and created_at > now() - interval '7 days') as active_users_7d,
    (select count(distinct request_id) from public.recommendation_logs) as recommendations;

create or replace view public.analytics_daily as
  select date_trunc('day', created_at)::date as day,
         count(distinct coalesce(user_id::text, metadata ->> 'anon')) filter (where true) as active_users,
         count(*) filter (where event_type = 'movie_view') as movies_viewed,
         count(*) filter (where event_type = 'movie_save') as movies_saved,
         count(*) filter (where event_type = 'movie_like') as movies_liked,
         count(*) filter (where event_type = 'search') as searches
  from public.user_events
  where created_at > now() - interval '30 days'
  group by 1;

create or replace view public.analytics_top_moods as
  select metadata ->> 'mood' as mood, count(*) as count
  from public.user_events
  where event_type = 'mood_selected' and created_at > now() - interval '30 days'
  group by 1 order by 2 desc;

create or replace view public.analytics_top_languages as
  select metadata ->> 'language' as language, count(*) as count
  from public.user_events
  where event_type = 'language_selected' and created_at > now() - interval '30 days'
  group by 1 order by 2 desc;

create or replace view public.analytics_top_searches as
  select lower(metadata ->> 'q') as query, count(*) as count
  from public.user_events
  where event_type = 'search' and metadata ? 'q' and created_at > now() - interval '30 days'
  group by 1 order by 2 desc;

create or replace view public.analytics_most_skipped as
  select tmdb_id, count(*) as count
  from public.user_events
  where event_type = 'movie_skip' and created_at > now() - interval '30 days'
  group by 1 order by 2 desc;

create or replace view public.analytics_ctr as
  select
    (select count(*) from public.recommendation_logs where created_at > now() - interval '30 days') as impressions,
    (select count(*) from public.user_events where event_type = 'recommendation_clicked' and created_at > now() - interval '30 days') as clicks,
    (select count(*) from public.user_events where event_type = 'movie_save' and created_at > now() - interval '30 days') as saves;

create or replace view public.admin_mood_stats as
  select mo.slug, mo.name, mo.icon, mo.sort_order,
         count(mm.movie_id) as movies,
         avg(mm.score) as avg_score,
         avg(mm.confidence) as avg_confidence,
         max(mm.updated_at) as last_updated,
         mode() within group (order by mm.model_version) as model_version
  from public.moods mo left join public.movie_moods mm on mm.mood_id = mo.id
  group by mo.id order by mo.sort_order;

create or replace view public.admin_user_summary as
  select p.id, p.email, p.display_name, p.created_at, p.is_suspended, a.role,
         (select max(created_at) from public.user_events e where e.user_id = p.id) as last_active,
         (select count(*) from public.watchlists w where w.user_id = p.id) as watchlist_count,
         (select count(*) from public.user_events e where e.user_id = p.id) as interactions
  from public.profiles p left join public.admin_users a on a.user_id = p.id;

revoke all on public.movies_missing_moods, public.admin_overview, public.analytics_daily, public.analytics_top_moods,
  public.analytics_top_languages, public.analytics_top_searches, public.analytics_most_skipped, public.analytics_ctr,
  public.admin_mood_stats, public.admin_user_summary from anon, authenticated;
