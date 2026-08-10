-- Schedules sync-hevy-history's default "reconcile" mode (last 3 days via
-- Hevy's /v1/workouts/events, see supabase/functions/sync-hevy-history) to
-- run daily as a safety net for any refresh-hevy-cache webhook call that
-- never arrived. Mirrors the pg_cron + pg_net job that already exists for
-- refresh-feed-cache -- that one predates this repo's migrations and was
-- set up by hand in the SQL editor, so it isn't version-controlled; this
-- one is, going forward.
--
-- Reuses the same Vault secret ('refresh_feed_cache_secret_key') as the
-- refresh-feed-cache job rather than creating a second copy of the same
-- value: the apikey header is validated by Supabase's function gateway at
-- the project level, not per-function, so one project secret key already
-- authorizes calls to every Edge Function in this project. The name is a
-- pre-existing misnomer (it predates this function existing at all), not a
-- sign of function-scoping.

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
        timeout_milliseconds := 20000
    );
    $$
);
