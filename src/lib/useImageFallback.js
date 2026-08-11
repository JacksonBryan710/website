import { useState } from 'react';

// Shared onError/failed-image tracking behind SpotifyTopList's Thumbnail and
// SpotifyNowPlaying's AlbumArt -- both need to fall back to a plain
// placeholder for a null image_url or a stale/404ing CDN URL, since neither
// has any other way to know an <img> failed to load. Each caller keeps its
// own frame markup, pixelation size, and CSS (48px vs 84px frames, 12/8/21px
// render sizes genuinely differ) -- only the fallback-tracking state is
// shared.
//
// Tracks *which* src failed rather than a plain boolean, so a new src is
// derived as not-failed during render itself -- no effect/setState-on-prop-
// change needed. Matters for SpotifyNowPlaying, whose AlbumArt instance
// stays mounted across polls: without this, one track's 404 kept the
// fallback showing forever, even once a later poll brought in a different
// track with a working image.
export function useImageFallback(src) {
    const [failedSrc, setFailedSrc] = useState(null);
    return {
        showFallback: !src || failedSrc === src,
        onError: () => setFailedSrc(src),
    };
}
