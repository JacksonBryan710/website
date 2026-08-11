-- 20260811034301_restrict_spotify_top_items_service_role_grants.sql revoked
-- select/update from service_role on spotify_top_tracks/spotify_top_artists,
-- reasoning that refresh-spotify-cache only calls delete()/insert(). Wrong:
-- DELETE ... WHERE needs SELECT privilege to evaluate the WHERE clause, even
-- for a role with BYPASSRLS -- same mistake caught (and fixed) for
-- spotify_now_playing in 20260811050000_grant_spotify_now_playing_service_role_select.sql,
-- reproduced here locally with a zero-row-matching DELETE
-- (`permission denied for table spotify_top_tracks`, hint: "GRANT SELECT").
--
-- This means refresh-spotify-cache's monthly delete-then-insert has been
-- failing on both tables since 20260811034301 landed -- update is correctly
-- left revoked (nothing here ever calls update()).
--
-- Left as a follow-up rather than editing the original grant statement,
-- since that migration already ran against the live database -- same
-- reasoning as 20260808032052_revoke_authenticated_write_until_admin_auth.sql.
grant select on public.spotify_top_tracks to service_role;
grant select on public.spotify_top_artists to service_role;
