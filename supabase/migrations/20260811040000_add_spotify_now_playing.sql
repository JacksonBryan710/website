-- Backs the Now page's "Now playing" widget: unlike spotify_top_tracks/
-- spotify_top_artists (a ranked top-10 snapshot, refreshed monthly), this is
-- a single row holding whatever Spotify says is happening right now,
-- refreshed every minute by the refresh-spotify-now-playing Edge Function
-- (see 20260811040100_add_refresh_spotify_now_playing_cron.sql).
--
-- state distinguishes three cases the widget renders differently:
--   'playing' -- GET /me/player/currently-playing returned an active track
--   'recent'  -- nothing's currently playing, but GET
--               /me/player/recently-played has a last-played track
--   'idle'    -- neither endpoint has anything (e.g. brand new account with
--               no listening history at all) -- expected to be rare/never
--               in practice, not the widget's normal resting state
--
-- One row at all times (delete-then-insert on every refresh, same idiom as
-- feed_cache/spotify_top_tracks), so the frontend never has to special-case
-- "no row yet".
create table public.spotify_now_playing (
    id            uuid primary key default gen_random_uuid(),
    state         text not null check (state in ('playing', 'recent', 'idle')),
    title         text,                    -- track name; null only for state='idle'
    artist_names  text,                    -- joined artist names
    album         text,
    release_year  text,                    -- year prefix of Spotify's release_date, for "album · year"
    image_url     text,                    -- nullable -- smallest available Spotify image
    external_url  text,                    -- open.spotify.com link
    duration_ms   integer,
    progress_ms   integer,                 -- playback position at fetched_at; null unless state='playing'
    is_playing    boolean not null default false,
    played_at     timestamptz,             -- when the track was last played; only set for state='recent'
    fetched_at    timestamptz not null default now()
);

alter table public.spotify_now_playing enable row level security;
create policy "spotify_now_playing_public_read" on public.spotify_now_playing for select to anon, authenticated using (true);
grant select on public.spotify_now_playing to anon, authenticated;

-- refresh-spotify-now-playing only ever calls delete() and insert() (never
-- select()/update()) -- granting only what's used, per the least-privilege
-- correction already made for spotify_top_tracks/spotify_top_artists in
-- 20260811034301_restrict_spotify_top_items_service_role_grants.sql, so this
-- table doesn't need its own follow-up migration to get there.
grant insert, delete on public.spotify_now_playing to service_role;
