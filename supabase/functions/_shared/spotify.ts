// Shared Spotify OAuth helper used by both refresh-spotify-cache (top
// tracks/artists, monthly) and refresh-spotify-now-playing (playback state,
// every minute). Every Spotify Edge Function here authenticates as the same
// specific user rather than an app-level key -- see CLAUDE.md for how
// SPOTIFY_REFRESH_TOKEN was obtained -- so the refresh-token-for-access-
// token exchange is identical across all of them and worth sharing rather
// than duplicating, mirroring the _shared/hevy.ts precedent.

export type SpotifyImage = {
  url: string;
  height: number | null;
  width: number | null;
};

// Spotify returns images largest-first; the smallest is plenty for a
// thumbnail, so take the last one rather than the first.
export function pickImage(images: SpotifyImage[] | undefined): string | null {
  return images && images.length > 0 ? images[images.length - 1].url : null;
}

export async function getAccessToken(clientId: string, clientSecret: string, refreshToken: string): Promise<string> {
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`token exchange failed, status=${res.status}, body[0:200]=${body.slice(0, 200)}`);
  const { access_token } = JSON.parse(body) as { access_token: string };
  return access_token;
}
