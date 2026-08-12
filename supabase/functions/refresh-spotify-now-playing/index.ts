// Refreshes public.spotify_now_playing from Spotify's playback endpoints,
// preferring live state and falling back to history so the widget almost
// never has to show "nothing playing":
//   1. GET /me/player/currently-playing -- if there's an active track,
//      state='playing'.
//   2. Otherwise GET /me/player/recently-played?limit=1 -- if there's any
//      listening history at all, state='recent'.
//   3. Otherwise state='idle' -- expected to be rare (a brand new account
//      with zero history), not the normal resting state.
//
// Same per-user OAuth model as refresh-spotify-cache (see CLAUDE.md and
// _shared/spotify.ts) -- SPOTIFY_REFRESH_TOKEN here additionally needs the
// user-read-currently-playing and user-read-recently-played scopes, which
// weren't required for the original user-top-read-only token.
//
// Meant to be invoked every 15s by Supabase Cron, so it only accepts the
// project's secret key, not the public key.

import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import { getAccessToken, pickImage, errorMessage, type SpotifyImage } from "../_shared/spotify.ts";

// release_date marked optional (not just album/images) -- refresh-spotify-cache's
// own comment documents Spotify omitting fields its docs mark required
// (missing popularity, missing genres on a live run), so the same defensive
// treatment applies here rather than trusting the declared schema.
type SpotifyTrack = {
  name: string;
  duration_ms: number;
  external_urls: { spotify: string };
  album: { name: string; release_date?: string; images?: SpotifyImage[] };
  artists: { name: string }[];
};

type CurrentlyPlayingResponse = {
  is_playing: boolean;
  progress_ms: number | null;
  item: SpotifyTrack | null;
  currently_playing_type: "track" | "episode" | "ad" | "unknown";
};

type RecentlyPlayedResponse = {
  items: { track: SpotifyTrack; played_at: string }[];
};

type TrackFields = {
  title: string;
  artist_names: string | null;
  album: string;
  release_year: string | null;
  image_url: string | null;
  external_url: string;
  duration_ms: number;
};

// The row that's actually meaningful to build per state -- kept as a
// discriminated union (rather than a loosely-typed Record<string, unknown>)
// so a mismatch like fetchCurrentlyPlaying's old return type -- which
// claimed a bare `{ progress_ms }` was possible where the real value was
// always a full track plus progress_ms -- is caught at compile time instead
// of only surfacing as a runtime bug.
type NowPlayingRow =
  | ({ state: "playing"; progress_ms: number | null } & TrackFields)
  | ({ state: "recent"; played_at: string } & TrackFields)
  | { state: "idle" };

// Every column gets an explicit value on every upsert (nulled out when not
// applicable to the current state) -- upsert's ON CONFLICT DO UPDATE only
// touches columns present in the payload, so omitting e.g. `title` on an
// idle row would leave the *previous* track's title lingering instead of
// clearing it.
const EMPTY_ROW_COLUMNS = {
  title: null,
  artist_names: null,
  album: null,
  release_year: null,
  image_url: null,
  external_url: null,
  duration_ms: null,
  progress_ms: null,
  played_at: null,
};

function toRowColumns(row: NowPlayingRow) {
  return { ...EMPTY_ROW_COLUMNS, ...row };
}

// Spotify's release_date can be a bare year ("1999"), year-month, or a full
// date -- the year prefix is all any of those formats share. Falsy/missing
// input (see the SpotifyTrack comment above) returns null rather than
// throwing.
function releaseYear(releaseDate: string | undefined): string | null {
  return releaseDate ? releaseDate.slice(0, 4) : null;
}

function trackRow(track: SpotifyTrack): TrackFields {
  return {
    title: track.name,
    artist_names: track.artists.map((artist) => artist.name).join(", ") || null,
    album: track.album.name,
    release_year: releaseYear(track.album.release_date),
    image_url: pickImage(track.album.images),
    external_url: track.external_urls.spotify,
    duration_ms: track.duration_ms,
  };
}

// Return type is an intersection (always a full track plus progress_ms),
// not a union with a bare `{ progress_ms }` shape -- the previous
// annotation claimed a shape the code never actually produces, which would
// have failed strict type-checking at the trackRow() call site below.
async function fetchCurrentlyPlaying(accessToken: string): Promise<(SpotifyTrack & { progress_ms: number | null }) | null> {
  const res = await fetch("https://api.spotify.com/v1/me/player/currently-playing", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (res.status === 204) return null;
  const body = await res.text();
  if (!res.ok) throw new Error(`fetch currently-playing failed, status=${res.status}, body[0:200]=${body.slice(0, 200)}`);
  if (!body) return null;
  const data = JSON.parse(body) as CurrentlyPlayingResponse;
  if (!data.is_playing || !data.item || data.currently_playing_type !== "track") return null;
  return { ...data.item, progress_ms: data.progress_ms };
}

async function fetchLastPlayed(accessToken: string): Promise<{ track: SpotifyTrack; played_at: string } | null> {
  const res = await fetch("https://api.spotify.com/v1/me/player/recently-played?limit=1", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`fetch recently-played failed, status=${res.status}, body[0:200]=${body.slice(0, 200)}`);
  const { items } = JSON.parse(body) as RecentlyPlayedResponse;
  return items.length > 0 ? items[0] : null;
}

// Recently-played only needs to be checked on the old 1/minute cadence --
// "last played Xm ago" is minute-resolution anyway (see formatTimeAgo on the
// frontend) -- but it's invoked on every run of this function, which polls
// far more often for currently-playing's sake (15s, backed off from an
// initial 10s -- see 20260812010000). Caching it in-isolate for 60s
// restores the original call volume for this one endpoint: without it,
// Spotify started returning 429 QUOTA_EXCEEDED on recently-played once the
// cron cadence sped up, because this app isn't in Spotify's Extended Quota
// Mode and so has a much stricter real limit than the commonly-cited
// ~180-per-30s figure that assumes that tier.
const RECENTLY_PLAYED_CACHE_MS = 60_000;
let cachedLastPlayed: { result: { track: SpotifyTrack; played_at: string } | null; fetchedAt: number } | null = null;

async function fetchLastPlayedCached(accessToken: string): Promise<{ track: SpotifyTrack; played_at: string } | null> {
  if (cachedLastPlayed && Date.now() - cachedLastPlayed.fetchedAt < RECENTLY_PLAYED_CACHE_MS) {
    return cachedLastPlayed.result;
  }
  try {
    const result = await fetchLastPlayed(accessToken);
    cachedLastPlayed = { result, fetchedAt: Date.now() };
    return result;
  } catch (err) {
    // A 429 refreshes the cache's timestamp too (keeping whatever result
    // was cached before, or null if there was none) -- otherwise a
    // rate-limited call leaves the cache expired, and every run for the
    // rest of the 15s window retries the same still-rate-limited request
    // instead of backing off.
    cachedLastPlayed = { result: cachedLastPlayed?.result ?? null, fetchedAt: Date.now() };
    throw err;
  }
}

// Fixed, well-known id for the table's one-and-only row (see
// 20260811070100_make_spotify_now_playing_singleton.sql, which seeds it and
// switches the table to this upsert-in-place model instead of
// delete-then-insert).
const ROW_ID = "00000000-0000-0000-0000-000000000000";

// deno-lint-ignore no-explicit-any -- supabaseAdmin isn't generated-types
// typed here (see the rest of this file's untyped .from() calls); only the
// columns this function actually reads are pulled out below.
type SupabaseAdminClient = any;

// Last-resort fallback for the "nothing currently playing, and the
// recently-played fetch also failed" case -- reads the row this same
// function wrote last time instead of giving up to idle. Cold isolates
// (empty in-isolate cache) hit this path too, not just repeat failures on a
// warm one, so it has to go to the DB rather than only widening
// fetchLastPlayedCached's in-memory cache.
async function lastKnownRow(supabaseAdmin: SupabaseAdminClient): Promise<NowPlayingRow> {
  const { data: existing } = await supabaseAdmin.from("spotify_now_playing").select("*").eq("id", ROW_ID).maybeSingle();
  if (!existing || existing.state === "idle" || !existing.title) return { state: "idle" };

  return {
    state: "recent",
    title: existing.title,
    artist_names: existing.artist_names,
    album: existing.album,
    release_year: existing.release_year,
    image_url: existing.image_url,
    external_url: existing.external_url,
    duration_ms: existing.duration_ms,
    // The previous row was already 'recent' (has its own played_at) or was
    // 'playing' (no played_at -- it just stopped, as far as we can tell,
    // so "now" is the closest honest estimate).
    played_at: existing.state === "recent" ? existing.played_at : new Date().toISOString(),
  };
}

export default {
  fetch: withSupabase({ auth: ["secret"] }, async (_req, ctx) => {
    const clientId = Deno.env.get("SPOTIFY_CLIENT_ID");
    const clientSecret = Deno.env.get("SPOTIFY_CLIENT_SECRET");
    const refreshToken = Deno.env.get("SPOTIFY_REFRESH_TOKEN");
    if (!clientId || !clientSecret || !refreshToken) {
      const message = "SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, and SPOTIFY_REFRESH_TOKEN must all be set";
      console.error(message);
      return Response.json({ ok: false, error: message }, { status: 500 });
    }

    let row: NowPlayingRow;

    try {
      const accessToken = await getAccessToken(clientId, clientSecret, refreshToken);
      const playing = await fetchCurrentlyPlaying(accessToken);

      if (playing) {
        row = { state: "playing", ...trackRow(playing), progress_ms: playing.progress_ms };
      } else {
        // A recently-played failure (e.g. a transient Spotify rate limit)
        // no longer throws -- we already know nothing is currently playing
        // at this point, so skipping the upsert entirely on this call would
        // leave a stale 'playing' row frozen until the next successful
        // fetch, which is the bug this guards against.
        let last: { track: SpotifyTrack; played_at: string } | null = null;
        try {
          last = await fetchLastPlayedCached(accessToken);
        } catch (err) {
          console.error(`recently-played fetch failed: ${errorMessage(err)}`);
        }

        if (last) {
          row = { state: "recent", ...trackRow(last.track), played_at: last.played_at };
        } else {
          // Still no track (fetch failed and nothing cached in this
          // isolate) -- fall back to whatever's already in the DB rather
          // than idle. idle is meant to be rare (a brand-new account with
          // zero history, per the top-of-file comment), not the state a
          // transient API hiccup should produce every time it happens.
          row = await lastKnownRow(ctx.supabaseAdmin);
        }
      }
    } catch (err) {
      return Response.json({ ok: false, error: errorMessage(err) }, { status: 500 });
    }

    // Single upsert in place of the old delete()-then-insert() (two
    // non-atomic round trips that left the table briefly empty every
    // minute -- see the migration comment). A page load can no longer land
    // on a genuinely-zero-row table once this has run at least once.
    const { error: upsertError } = await ctx.supabaseAdmin
      .from("spotify_now_playing")
      .upsert({ id: ROW_ID, fetched_at: new Date().toISOString(), ...toRowColumns(row) }, { onConflict: "id" });
    if (upsertError) return Response.json({ ok: false, error: errorMessage(upsertError) }, { status: 500 });

    return Response.json({ ok: true, state: row.state });
  }),
};
