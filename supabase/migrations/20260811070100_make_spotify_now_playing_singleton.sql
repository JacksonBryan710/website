-- Switches spotify_now_playing from delete-then-insert (two non-atomic
-- round trips, briefly leaving the table with zero rows on every refresh)
-- to a true singleton row updated in place via upsert. That empty window
-- was a real bug: a page load landing in it got .maybeSingle() back as
-- {data: null, error: null} -- indistinguishable, on the frontend, from
-- "still loading" -- and since the widget never refetches after mount, it
-- got stuck on "Loading now playing..." permanently for that page view.
-- delete-then-insert was copied from the ranked-list caches (spotify_top_tracks
-- etc.), where it's the right idiom because row count/order changes between
-- refreshes; this table only ever holds exactly one logical row, so upsert
-- against a fixed id is the more natural fit and removes the race
-- structurally rather than papering over it with frontend retries.
--
-- Clears any row(s) inserted under the old random-gen_random_uuid() scheme
-- (there's at most one, from this branch's own testing -- this table has no
-- other consumers), then seeds one row at the fixed id
-- refresh-spotify-now-playing now upserts against
-- (00000000-0000-0000-0000-000000000000), so the table is never empty from
-- this point forward, including the window before the very first cron run
-- after a fresh deploy.
delete from public.spotify_now_playing;

insert into public.spotify_now_playing (id, state, fetched_at)
values ('00000000-0000-0000-0000-000000000000', 'idle', now());

-- Upsert's ON CONFLICT DO UPDATE needs UPDATE privilege in addition to the
-- INSERT already granted; delete() is no longer called by the function, so
-- it's revoked rather than left unused -- this time granting exactly what's
-- needed from the start instead of narrowing after a live failure, per the
-- lesson from this table's own 20260811050000 migration (see CLAUDE.md's
-- Backend section for the general rule).
grant update on public.spotify_now_playing to service_role;
revoke delete on public.spotify_now_playing from service_role;
