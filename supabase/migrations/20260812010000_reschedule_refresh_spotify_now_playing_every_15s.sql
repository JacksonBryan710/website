-- Backs off refresh-spotify-now-playing from every 10s to every 15s.
--
-- The 10s cadence (20260811080000) assumed Spotify's commonly-cited
-- ~180-requests-per-rolling-30s limit, which only applies to apps approved
-- for Extended Quota Mode. This app was never submitted for that review, so
-- it runs under the default, much stricter Development Mode limit -- in
-- production this tripped 429 QUOTA_EXCEEDED on the recently-played
-- fallback call on nearly every run. The Edge Function itself (see
-- refresh-spotify-now-playing/index.ts) now also caches that fallback for
-- 60s and, on failure, preserves the previously-stored playback state via
-- lastKnownRow() instead of aborting the whole run, so a single over-quota
-- call no longer freezes the row -- this migration addresses the root cause
-- (call volume) rather than just the symptom.

select cron.unschedule('refresh-spotify-now-playing-every-10s');

select cron.schedule(
    'refresh-spotify-now-playing-every-15s',
    '15 seconds',
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
