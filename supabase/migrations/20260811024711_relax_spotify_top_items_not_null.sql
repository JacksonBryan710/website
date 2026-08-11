-- Real Spotify responses can omit "popularity" on individual track/artist
-- objects -- the not-null constraint assumed it was always present and a
-- live refresh-spotify-cache run failed the insert as soon as one track
-- didn't have it. Relax to nullable rather than fabricating a fake 0, which
-- would misrepresent an unknown popularity as "least popular."
alter table public.spotify_top_tracks alter column popularity drop not null;
alter table public.spotify_top_artists alter column popularity drop not null;
