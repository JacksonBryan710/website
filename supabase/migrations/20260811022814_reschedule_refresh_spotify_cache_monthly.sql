-- Switches refresh-spotify-cache from daily to monthly, on the 1st. The
-- widgets show "last month's" top 10, not a live rolling window -- Spotify's
-- short_term range (~last 4 weeks) is closest to the just-completed
-- calendar month when captured right after the month rolls over, so
-- snapshotting on the 1st (rather than continuously) is what makes "last
-- month" a stable, meaningful label instead of a number that silently
-- drifts underneath it every day.
--
-- Table/Edge Function logic are unchanged -- still a single delete-then-
-- insert snapshot per table, just refreshed 12x/year instead of 365x/year.

select cron.unschedule('refresh-spotify-cache-daily');

select cron.schedule(
    'refresh-spotify-cache-monthly',
    '0 6 1 * *',
    $$
    select net.http_post(
        url := 'https://anmyqoywvesgnhrctufo.supabase.co/functions/v1/refresh-spotify-cache',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'refresh_feed_cache_secret_key')
        ),
        timeout_milliseconds := 30000
    );
    $$
);
