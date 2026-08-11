-- is_playing was fully redundant with state: refresh-spotify-now-playing
-- only ever set is_playing=true when state='playing' (every other branch
-- set it false), and the only frontend reader of row.is_playing
-- (PlayingTrack) only ever renders when state='playing' -- so it was dead
-- scaffolding for information state already encodes. Dropped rather than
-- left as unused surface area; the table is brand-new in this branch and
-- has no other consumers to break.
alter table public.spotify_now_playing drop column is_playing;
