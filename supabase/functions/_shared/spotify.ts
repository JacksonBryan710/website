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

// Deno edge isolates can be reused across consecutive invocations of the
// same function (though it's not guaranteed) -- caching the access token at
// module scope costs nothing on a cold isolate (falls straight through to a
// fresh exchange) and saves a token-exchange round trip on every invocation
// that lands on a warm one. Matters most for refresh-spotify-now-playing's
// 1/minute cron cadence against a ~1hr-lived access token, where an
// unbounded exchange-every-run would otherwise be the common case.
let cachedToken: { accessToken: string; expiresAt: number } | null = null;

export async function getAccessToken(clientId: string, clientSecret: string, refreshToken: string): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.accessToken;
  }

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
  const { access_token, expires_in } = JSON.parse(body) as { access_token: string; expires_in: number };

  // 60s safety margin so a token doesn't expire mid-use on a slow request.
  cachedToken = { accessToken: access_token, expiresAt: Date.now() + expires_in * 1000 - 60_000 };
  return access_token;
}

export function errorMessage(err: unknown): string {
  return err && typeof err === "object" && "message" in err ? String((err as { message: unknown }).message) : String(err);
}
