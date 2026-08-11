import { useState } from 'react';

// Shared onError/failed-image tracking behind SpotifyTopList's Thumbnail and
// SpotifyNowPlaying's AlbumArt -- both need to fall back to a plain
// placeholder for a null image_url or a stale/404ing CDN URL, since neither
// has any other way to know an <img> failed to load. Each caller keeps its
// own frame markup, pixelation size, and CSS (48px vs 84px frames, 12/8/21px
// render sizes genuinely differ) -- only the fallback-tracking state is
// shared.
export function useImageFallback(src) {
    const [failed, setFailed] = useState(false);
    return {
        showFallback: !src || failed,
        onError: () => setFailed(true),
    };
}
