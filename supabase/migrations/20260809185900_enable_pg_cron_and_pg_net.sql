-- pg_cron and pg_net were enabled by hand in the hosted project's dashboard
-- (Database > Extensions) before this repo had any cron migrations, so a
-- fresh database (e.g. local `supabase start`) doesn't have them and fails
-- replaying 20260809190000_add_sync_hevy_history_cron.sql with "schema cron
-- does not exist". IF NOT EXISTS makes this a no-op against the hosted
-- project, and version-controls the setup step going forward for anyone
-- spinning up a new environment.

create extension if not exists pg_cron;
create extension if not exists pg_net;
