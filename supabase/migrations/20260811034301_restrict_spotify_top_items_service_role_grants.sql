-- refresh-spotify-cache only ever calls delete() and insert() on these two
-- tables (never select()/update()) -- the original migration granted full
-- CRUD to service_role anyway, matching every other cache table in this
-- repo (feed_cache, hevy_workouts, hevy_sets, hevy_exercise_templates all
-- do the same). Narrowing just these two to what's actually used, per
-- least-privilege; left as a follow-up rather than editing the original
-- grant statement, since that migration already ran against the live
-- database and shouldn't be rewritten after the fact (same reasoning as
-- 20260808032052_revoke_authenticated_write_until_admin_auth.sql).
revoke select, update on public.spotify_top_tracks from service_role;
revoke select, update on public.spotify_top_artists from service_role;
