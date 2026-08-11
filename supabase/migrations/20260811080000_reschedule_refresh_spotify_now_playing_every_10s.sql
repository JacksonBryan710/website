-- Tightens refresh-spotify-now-playing from once/minute to every 10 seconds
-- so the widget reflects skips/song-end without a page refresh. pg_cron
-- (1.4+, which Supabase ships) supports sub-minute schedules via a plain
-- "N seconds" string in place of the 5-field cron expression.
--
-- Rate-limit math still holds: same <=3 Spotify API calls per run as the
-- 1/minute job (token refresh + currently-playing + recently-played
-- fallback), so 6x the frequency is ~25,920 calls/day -- still nowhere
-- close to the ~180-per-rolling-30s app-level limit noted in
-- 20260811040100_add_refresh_spotify_now_playing_cron.sql.

select cron.unschedule('refresh-spotify-now-playing-every-minute');

select cron.schedule(
    'refresh-spotify-now-playing-every-10s',
    '10 seconds',
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
