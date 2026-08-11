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
// Meant to be invoked every minute by Supabase Cron, so it only accepts the
// project's secret key, not the public key.

import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import { getAccessToken, pickImage, type SpotifyImage } from "../_shared/spotify.ts";

type SpotifyTrack = {
  name: string;
  duration_ms: number;
  external_urls: { spotify: string };
  album: { name: string; release_date: string; images?: SpotifyImage[] };
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

// Spotify's release_date can be a bare year ("1999"), year-month, or a full
// date -- the year prefix is all any of those formats share.
function releaseYear(releaseDate: string): string | null {
  return releaseDate.slice(0, 4) || null;
}

function trackRow(track: SpotifyTrack) {
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

async function fetchCurrentlyPlaying(accessToken: string): Promise<SpotifyTrack | { progress_ms: number | null } | null> {
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

    let row: Record<string, unknown>;

    try {
      const accessToken = await getAccessToken(clientId, clientSecret, refreshToken);
      const playing = await fetchCurrentlyPlaying(accessToken);

      if (playing) {
        row = {
          state: "playing",
          ...trackRow(playing),
          progress_ms: playing.progress_ms,
          is_playing: true,
        };
      } else {
        const last = await fetchLastPlayed(accessToken);
        row = last
          ? { state: "recent", ...trackRow(last.track), is_playing: false, played_at: last.played_at }
          : { state: "idle", is_playing: false };
      }
    } catch (err) {
      return Response.json({ ok: false, error: errorMessage(err) }, { status: 500 });
    }

    // There's no scope key to delete-by like time_range/source elsewhere in
    // this repo -- this table only ever holds one row, period. PostgREST
    // rejects an unfiltered delete(), so `id is not null` stands in as an
    // always-true filter that means "every row".
    const { error: deleteError } = await ctx.supabaseAdmin.from("spotify_now_playing").delete().not("id", "is", null);
    if (deleteError) return Response.json({ ok: false, error: errorMessage(deleteError) }, { status: 500 });

    const { error: insertError } = await ctx.supabaseAdmin.from("spotify_now_playing").insert(row);
    if (insertError) return Response.json({ ok: false, error: errorMessage(insertError) }, { status: 500 });

    return Response.json({ ok: true, state: row.state });
  }),
};

function errorMessage(err: unknown): string {
  return err && typeof err === "object" && "message" in err ? String((err as { message: unknown }).message) : String(err);
}
