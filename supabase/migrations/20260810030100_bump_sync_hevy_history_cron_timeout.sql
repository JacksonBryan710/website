-- Bumps sync-hevy-history's cron request timeout from 20s to 60s. The
-- exercise-templates sync (up to TEMPLATES_MAX_PAGES=50 pages) plus
-- reconcile-event pagination and their Supabase writes can together take
-- longer than 20s; when they do, pg_net records a timeout in
-- net._http_response even though the Edge Function itself keeps running
-- server-side and completes successfully -- a confusing false alarm, not
-- an actual failure. Unschedule-then-reschedule rather than relying on
-- cron.schedule's by-name replace semantics, to guarantee no duplicate job
-- regardless of pg_cron version behavior.
select cron.unschedule('sync-hevy-history-daily');

select cron.schedule(
    'sync-hevy-history-daily',
    '0 6 * * *',
    $$
    select net.http_post(
        url := 'https://anmyqoywvesgnhrctufo.supabase.co/functions/v1/sync-hevy-history',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'refresh_feed_cache_secret_key')
        ),
        timeout_milliseconds := 60000
    );
    $$
);
