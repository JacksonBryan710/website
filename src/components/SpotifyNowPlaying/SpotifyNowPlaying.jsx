import { useEffect, useState } from 'react';
import { useSupabaseQuery } from '../../lib/useSupabaseQuery';
import { useImageFallback } from '../../lib/useImageFallback';
import QueryStatus from '../QueryStatus/QueryStatus';
import RetroPanel from '../RetroPanel/RetroPanel';
import './SpotifyNowPlaying.css';

// Matches the Edge Function's cron cadence -- refetching on the same
// interval it refreshes is what makes the "LIVE" status pill honest (the
// row would otherwise be fetched once on mount and never again, freezing
// the widget at whatever was playing on page load) and also self-heals
// within one interval from any transient bad read.
const REFRESH_INTERVAL_MS = 10_000;

const STATUS_BY_STATE = {
    playing: { label: '● LIVE', className: 'spotify-now-playing-status-live' },
    recent: { label: 'LAST PLAYED', className: 'spotify-now-playing-status-recent' },
    idle: { label: 'OFFLINE', className: 'spotify-now-playing-status-idle' },
};

function formatDuration(ms) {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function formatTimeAgo(isoString) {
    const seconds = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
}

// Ticks `now` once a second so the progress bar keeps advancing between the
// row's ~1-minute cache refreshes, without polling the network for it. Only
// ever mounted (via PlayingTrack) while state === 'playing', so it doesn't
// need an enabled/disabled switch -- unlike the row's own former is_playing
// field, which was dropped for being redundant with state.
function useNow() {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(id);
    }, []);
    return now;
}

function AlbumArt({ src, alt, muted }) {
    const { showFallback, onError } = useImageFallback(src);

    if (showFallback) {
        return <div className="spotify-now-playing-art-fallback" aria-hidden="true" />;
    }

    return (
        <span className={`spotify-now-playing-art-frame${muted ? ' is-muted' : ''}`}>
            <img className="spotify-now-playing-art" src={src} alt={alt} onError={onError} />
        </span>
    );
}

function StatusPill({ state }) {
    const status = STATUS_BY_STATE[state] ?? STATUS_BY_STATE.idle;
    return <span className={`spotify-now-playing-status ${status.className}`}>{status.label}</span>;
}

function EqBars({ live }) {
    return (
        <div className={`spotify-now-playing-eq${live ? ' is-live' : ''}`} aria-hidden="true">
            <span className="spotify-now-playing-eq-bar" />
            <span className="spotify-now-playing-eq-bar" />
            <span className="spotify-now-playing-eq-bar" />
            <span className="spotify-now-playing-eq-bar" />
        </div>
    );
}

// Shared by PlayingTrack/RecentTrack -- album art, title/artist/album·year,
// and the EQ bars are identical between the two states apart from a muted
// style and whether the bars animate.
function TrackHeader({ row, muted }) {
    return (
        <div className="spotify-now-playing-row">
            <AlbumArt src={row.image_url} alt={row.album} muted={muted} />
            <div className="spotify-now-playing-info">
                <span className={`spotify-now-playing-title${muted ? ' is-muted' : ''}`}>{row.title}</span>
                <span className={`spotify-now-playing-artist${muted ? ' is-muted' : ''}`}>{row.artist_names}</span>
                <span className="spotify-now-playing-album">
                    {row.album}
                    {row.release_year && <> &middot; {row.release_year}</>}
                </span>
            </div>
            <EqBars live={!muted} />
        </div>
    );
}

function OpenInSpotifyLink({ url }) {
    return (
        <div className="spotify-now-playing-actions">
            <a className="badge-link" href={url} target="_blank" rel="noopener noreferrer">
                &#9834; Open in Spotify
            </a>
        </div>
    );
}

function PlayingTrack({ row }) {
    const now = useNow();

    const fetchedAtMs = new Date(row.fetched_at).getTime();
    const elapsedMs = Math.min(row.duration_ms, row.progress_ms + (now - fetchedAtMs));
    const progressPct = row.duration_ms ? Math.min(100, (elapsedMs / row.duration_ms) * 100) : 0;

    return (
        <>
            <TrackHeader row={row} />

            <div className="spotify-now-playing-progress">
                <div className="spotify-now-playing-progress-track">
                    <div className="spotify-now-playing-progress-fill" style={{ width: `${progressPct}%` }} />
                </div>
                <div className="spotify-now-playing-progress-labels">
                    <span>{formatDuration(elapsedMs)}</span>
                    <span>-{formatDuration(row.duration_ms - elapsedMs)}</span>
                </div>
            </div>

            <OpenInSpotifyLink url={row.external_url} />
        </>
    );
}

function RecentTrack({ row }) {
    return (
        <>
            <TrackHeader row={row} muted />

            <p className="spotify-now-playing-last-played">// last played {formatTimeAgo(row.played_at)}</p>

            <OpenInSpotifyLink url={row.external_url} />
        </>
    );
}

function IdleState() {
    return (
        <div className="spotify-now-playing-idle">
            <div className="spotify-now-playing-art-fallback" aria-hidden="true" />
            <div>
                <p className="spotify-now-playing-idle-title">Nothing playing right now</p>
                <p className="spotify-now-playing-idle-subtitle">// check back later</p>
            </div>
        </div>
    );
}

function NowPlayingBody({ row }) {
    if (row.state === 'playing') return <PlayingTrack row={row} />;
    if (row.state === 'recent') return <RecentTrack row={row} />;
    return <IdleState />;
}

function SpotifyNowPlaying() {
    const [refetchTick, setRefetchTick] = useState(0);
    useEffect(() => {
        const id = setInterval(() => setRefetchTick((tick) => tick + 1), REFRESH_INTERVAL_MS);
        return () => clearInterval(id);
    }, []);

    const { data, error } = useSupabaseQuery(
        (supabase) => supabase.from('spotify_now_playing').select('*').maybeSingle(),
        [refetchTick],
    );

    return (
        <RetroPanel title="Now playing" headerRight={data && !error ? <StatusPill state={data.state} /> : null}>
            <QueryStatus
                error={error}
                data={data}
                errorLabel="Couldn't load what's playing right now."
                loadingLabel="Loading now playing…"
            >
                {(row) => <NowPlayingBody row={row} />}
            </QueryStatus>
        </RetroPanel>
    );
}

export default SpotifyNowPlaying;
