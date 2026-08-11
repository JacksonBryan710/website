-- Two ranked-snapshot tables backing the Now page's "Top songs last month" /
-- "Top artists last month" widgets, refreshed monthly (see
-- 20260811022814_reschedule_refresh_spotify_cache_monthly.sql) by the
-- refresh-spotify-cache Edge Function from Spotify's /me/top/{type} endpoint
-- (time_range=short_term, Spotify's own "~last 4 weeks" window -- Spotify
-- has no calendar-month concept, so this is what "this month" means here).
--
-- Deliberately two tables rather than one feed_cache-style table with an
-- item_type discriminator: tracks and artists would otherwise share a
-- single "subtitle" column with two unrelated meanings (joined artist names
-- vs. joined genres). feed_cache's subtitle stays one consistent meaning
-- ("context about the title") across its sources; this data doesn't have
-- that property, so each table gets its own honestly-named column instead.
--
-- time_range is a real column (not hardcoded) even though only 'short_term'
-- is fetched today, so adding medium_term/long_term later is a check
-- constraint change, not a new migration's worth of schema work.
create table public.spotify_top_tracks (
    id            uuid primary key default gen_random_uuid(),
    time_range    text not null check (time_range in ('short_term')),
    sort_order    integer not null,        -- rank, 0-9
    title         text not null,           -- track name
    artist_names  text,                    -- joined artist names, nullable defensively
    image_url     text,                    -- nullable -- smallest available Spotify image
    external_url  text not null,           -- open.spotify.com link
    popularity    integer not null,
    entry_key     text not null,           -- Spotify's track id, for debugging only
    fetched_at    timestamptz not null default now(),
    unique (time_range, sort_order)
);

create table public.spotify_top_artists (
    id            uuid primary key default gen_random_uuid(),
    time_range    text not null check (time_range in ('short_term')),
    sort_order    integer not null,        -- rank, 0-9
    title         text not null,           -- artist name
    genres        text,                    -- joined top genres, nullable (some artists have none)
    image_url     text,                    -- nullable
    external_url  text not null,
    popularity    integer not null,
    entry_key     text not null,           -- Spotify's artist id, for debugging only
    fetched_at    timestamptz not null default now(),
    unique (time_range, sort_order)
);

alter table public.spotify_top_tracks enable row level security;
create policy "spotify_top_tracks_public_read" on public.spotify_top_tracks for select to anon, authenticated using (true);
grant select on public.spotify_top_tracks to anon, authenticated;
grant select, insert, update, delete on public.spotify_top_tracks to service_role;

alter table public.spotify_top_artists enable row level security;
create policy "spotify_top_artists_public_read" on public.spotify_top_artists for select to anon, authenticated using (true);
grant select on public.spotify_top_artists to anon, authenticated;
grant select, insert, update, delete on public.spotify_top_artists to service_role;
