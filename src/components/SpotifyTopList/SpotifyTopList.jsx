import { useSupabaseQuery } from '../../lib/useSupabaseQuery';
import { useImageFallback } from '../../lib/useImageFallback';
import QueryStatus from '../QueryStatus/QueryStatus';
import './SpotifyTopList.css';

const TIME_RANGE = 'short_term';
const FRAME_SIZE = 48;

// thumbPixelSize controls the pixelation strength: the image is rendered at
// this size, then scaled back up to fill the 48px frame, forcing a blocky
// upscale. Spotify serves artist photos at a much higher native resolution
// (160x160) than album art (64x64), so the same render size looks
// noticeably less pixelated for artists -- callers pick a smaller value to
// compensate.
function Thumbnail({ src, alt, thumbPixelSize }) {
    const { showFallback, onError } = useImageFallback(src);

    if (showFallback) {
        return <div className="spotify-top-list-thumb-fallback" aria-hidden="true" />;
    }

    return (
        <span className="spotify-top-list-thumb-frame">
            <img
                className="spotify-top-list-thumb"
                src={src}
                alt={alt}
                onError={onError}
                style={{
                    width: thumbPixelSize,
                    height: thumbPixelSize,
                    transform: `scale(${FRAME_SIZE / thumbPixelSize})`,
                }}
            />
        </span>
    );
}

// Generic ranked list over spotify_top_tracks/spotify_top_artists -- the two
// tables share every column except one type-specific field (artist_names vs
// genres), so a `table`/`subtitleField` pair covers both rather than
// duplicating this component per source, mirroring how FeedActivity is
// generic over `source`/`feedKey`.
function SpotifyTopList({ table, subtitleField, thumbPixelSize = 12, errorLabel, loadingLabel, emptyLabel }) {
    const { data, error } = useSupabaseQuery(
        (supabase) => supabase.from(table).select('*').eq('time_range', TIME_RANGE).order('sort_order', { ascending: true }),
        [table],
    );

    return (
        <QueryStatus error={error} data={data} errorLabel={errorLabel} loadingLabel={loadingLabel}>
            {(rows) =>
                rows.length === 0 ? (
                    <p className="status-note">{emptyLabel}</p>
                ) : (
                    <ol className="spotify-top-list">
                        {rows.map((row) => (
                            <li key={row.id} className="spotify-top-list-row">
                                <span className="spotify-top-list-rank">{row.sort_order + 1}</span>
                                <Thumbnail src={row.image_url} alt={row.title} thumbPixelSize={thumbPixelSize} />
                                <span className="spotify-top-list-info">
                                    <a
                                        className="spotify-top-list-title"
                                        href={row.external_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        {row.title}
                                    </a>
                                    {row[subtitleField] && <span className="spotify-top-list-subtitle">{row[subtitleField]}</span>}
                                </span>
                            </li>
                        ))}
                    </ol>
                )
            }
        </QueryStatus>
    );
}

export default SpotifyTopList;
