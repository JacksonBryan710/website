-- projects
create table public.projects (
    id           uuid primary key default gen_random_uuid(),
    name         text not null,
    description  text not null,
    tech         text not null,
    href         text not null,
    link_label   text not null,
    sort_order   integer not null default 0,
    created_at   timestamptz not null default now(),
    updated_at   timestamptz not null default now()
);

-- recipes
create table public.recipes (
    id           uuid primary key default gen_random_uuid(),
    name         text not null,
    url          text not null,
    prep_time    text not null,
    cook_time    text not null,
    total_time   text not null,
    sort_order   integer not null default 0,
    created_at   timestamptz not null default now(),
    updated_at   timestamptz not null default now()
);

-- one cache table for both rss2json-backed widgets, keyed generically
create table public.feed_cache (
    id           uuid primary key default gen_random_uuid(),
    source       text not null check (source in ('letterboxd', 'goodreads')),
    feed_key     text not null,        -- 'diary' (letterboxd); 'read' | 'currently-reading' (goodreads shelves)
    sort_order   integer not null,
    title        text not null,        -- film name / book title
    subtitle     text,                 -- year / author, nullable
    rating       numeric(3,1),         -- nullable
    link         text not null,
    entry_key    text,                 -- original RSS guid/link, for debugging only
    fetched_at   timestamptz not null default now(),
    unique (source, feed_key, sort_order)
);
create index feed_cache_source_feed_key_idx on public.feed_cache (source, feed_key);

-- updated_at trigger for projects/recipes
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
    new.updated_at = now();
    return new;
end;
$$;
create trigger projects_set_updated_at before update on public.projects
    for each row execute function public.set_updated_at();
create trigger recipes_set_updated_at before update on public.recipes
    for each row execute function public.set_updated_at();

-- RLS: public read on all three; authenticated write on projects/recipes only.
-- (feed_cache is machine-managed — written only by the Edge Function via the
-- service_role key, which bypasses RLS entirely, so no write policy for it.)
alter table public.projects enable row level security;
create policy "projects_public_read" on public.projects for select to anon, authenticated using (true);
create policy "projects_admin_write" on public.projects for all to authenticated using (true) with check (true);

alter table public.recipes enable row level security;
create policy "recipes_public_read" on public.recipes for select to anon, authenticated using (true);
create policy "recipes_admin_write" on public.recipes for all to authenticated using (true) with check (true);

alter table public.feed_cache enable row level security;
create policy "feed_cache_public_read" on public.feed_cache for select to anon, authenticated using (true);

-- "Automatically expose new tables" was left off at project creation (best
-- practice: explicit grants per table instead of blanket default privileges
-- for every future table), so the Data API roles need explicit grants here.
-- RLS policies above still govern actual row access on top of these grants.
grant usage on schema public to anon, authenticated;

grant select on public.projects to anon, authenticated;
grant insert, update, delete on public.projects to authenticated;

grant select on public.recipes to anon, authenticated;
grant insert, update, delete on public.recipes to authenticated;

grant select on public.feed_cache to anon, authenticated;
