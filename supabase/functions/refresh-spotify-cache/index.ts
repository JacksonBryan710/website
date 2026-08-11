// Refreshes public.spotify_top_tracks / public.spotify_top_artists from
// Spotify's GET /me/top/{type} endpoint (time_range=short_term, Spotify's
// own "~last 4 weeks" window -- there's no calendar-month equivalent).
//
// Unlike refresh-feed-cache (public RSS, no auth) or Hevy's static API key,
// /me/top/{type} requires per-user OAuth (scope: user-top-read). A refresh
// token is obtained once via manual browser consent (see CLAUDE.md) and
// stored as SPOTIFY_REFRESH_TOKEN; this function exchanges it for a fresh
// access token on every run rather than caching one, since access tokens
// are short-lived (~1hr) and this only runs once a day.
//
// Meant to be invoked on a schedule (Supabase Cron) rather than by end
// users, so it only accepts the project's secret key, not the public key.

import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import { getAccessToken, pickImage, errorMessage, type SpotifyImage } from "../_shared/spotify.ts";

const LIMIT = 10;
const TIME_RANGE = "short_term";

// popularity/genres/images marked optional -- Spotify's docs imply they're
// always present, but a live run showed a track missing popularity and an
// artist missing genres entirely, not just empty.
type SpotifyTrack = {
  id: string;
  name: string;
  popularity?: number;
  external_urls: { spotify: string };
  album: { images?: SpotifyImage[] };
  artists: { name: string }[];
};

type SpotifyArtist = {
  id: string;
  name: string;
  popularity?: number;
  external_urls: { spotify: string };
  images?: SpotifyImage[];
  genres?: string[];
};

async function fetchTopItems<T>(accessToken: string, type: "tracks" | "artists"): Promise<T[]> {
  const url = `https://api.spotify.com/v1/me/top/${type}?time_range=${TIME_RANGE}&limit=${LIMIT}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  const body = await res.text();
  if (!res.ok) throw new Error(`fetch ${type} failed, status=${res.status}, body[0:200]=${body.slice(0, 200)}`);
  const { items } = JSON.parse(body) as { items: T[] };
  return items;
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

    const refreshed: string[] = [];
    const errors: Record<string, string> = {};

    try {
      const accessToken = await getAccessToken(clientId, clientSecret, refreshToken);

      try {
        const tracks = await fetchTopItems<SpotifyTrack>(accessToken, "tracks");

        const { error: deleteError } = await ctx.supabaseAdmin
          .from("spotify_top_tracks")
          .delete()
          .eq("time_range", TIME_RANGE);
        if (deleteError) throw deleteError;

        if (tracks.length > 0) {
          const { error: insertError } = await ctx.supabaseAdmin.from("spotify_top_tracks").insert(
            tracks.map((track, index) => ({
              time_range: TIME_RANGE,
              sort_order: index,
              title: track.name,
              artist_names: track.artists.map((artist) => artist.name).join(", ") || null,
              image_url: pickImage(track.album.images),
              external_url: track.external_urls.spotify,
              popularity: track.popularity ?? null,
              entry_key: track.id,
            })),
          );
          if (insertError) throw insertError;
        }

        refreshed.push("tracks");
      } catch (err) {
        errors.tracks = errorMessage(err);
      }

      try {
        const artists = await fetchTopItems<SpotifyArtist>(accessToken, "artists");

        const { error: deleteError } = await ctx.supabaseAdmin
          .from("spotify_top_artists")
          .delete()
          .eq("time_range", TIME_RANGE);
        if (deleteError) throw deleteError;

        if (artists.length > 0) {
          const { error: insertError } = await ctx.supabaseAdmin.from("spotify_top_artists").insert(
            artists.map((artist, index) => ({
              time_range: TIME_RANGE,
              sort_order: index,
              title: artist.name,
              genres: artist.genres && artist.genres.length > 0 ? artist.genres.slice(0, 2).join(", ") : null,
              image_url: pickImage(artist.images),
              external_url: artist.external_urls.spotify,
              popularity: artist.popularity ?? null,
              entry_key: artist.id,
            })),
          );
          if (insertError) throw insertError;
        }

        refreshed.push("artists");
      } catch (err) {
        errors.artists = errorMessage(err);
      }
    } catch (err) {
      // Token exchange itself failed -- neither table could be refreshed.
      errors.token = errorMessage(err);
    }

    return Response.json({ ok: Object.keys(errors).length === 0, refreshed, errors });
  }),
};
