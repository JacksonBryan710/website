-- Schedules refresh-spotify-cache to run daily. A short_term (~4 week
-- rolling window) top-10 ranking doesn't meaningfully shift hour to hour,
-- and there's no event to react to the way sync-hevy-workout reacts to
-- Hevy's webhook -- Spotify has no "your top tracks changed" push -- so a
-- daily poll is the same cadence judgment call already made for
-- sync-hevy-history-daily.
--
-- Offset by 30 minutes from sync-hevy-history-daily ('0 6 * * *') purely so
-- the two jobs don't fire in the same instant; not load-bearing.
--
-- Reuses the same Vault secret ('refresh_feed_cache_secret_key') as every
-- other scheduled job in this project rather than creating a new one: the
-- apikey header is validated by Supabase's function gateway at the project
-- level, not per-function, so one project secret key already authorizes
-- calls to every Edge Function here.

select cron.schedule(
    'refresh-spotify-cache-daily',
    '30 6 * * *',
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
