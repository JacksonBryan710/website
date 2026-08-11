-- Schedules refresh-spotify-now-playing every minute. Unlike top-tracks
-- (monthly) or Hevy history (daily), a "now playing" widget is only useful
-- if it's actually close to live -- checked against Spotify's rate limit
-- first: at most 3 Spotify API calls per run (token refresh + currently-
-- playing + a recently-played fallback only when nothing's playing), so
-- 1/minute is ~4,320 calls/day against an app-level limit on the order of
-- 180 requests per rolling 30 seconds -- nowhere close.
--
-- Same net.http_post + Vault 'refresh_feed_cache_secret_key' apikey-header
-- pattern as every other scheduled job in this project (e.g.
-- 20260811015300_add_refresh_spotify_cache_cron.sql) -- that secret
-- authorizes calls to every Edge Function here, not just the one it was
-- originally named for.

select cron.schedule(
    'refresh-spotify-now-playing-every-minute',
    '* * * * *',
    $$
    select net.http_post(
        url := 'https://anmyqoywvesgnhrctufo.supabase.co/functions/v1/refresh-spotify-now-playing',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'refresh_feed_cache_secret_key')
        ),
        timeout_milliseconds := 30000
    );
    $$
);
