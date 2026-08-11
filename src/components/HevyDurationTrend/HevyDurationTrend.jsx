import { useSupabaseQuery } from '../../lib/useSupabaseQuery';
import RetroPanel from '../RetroPanel/RetroPanel';
import './HevyDurationTrend.css';

const SESSIONS_PER_ROUTINE = 6;
const CHART_W = 600;
const CHART_H = 220;
const PAD = 20;
const GRID_STEPS = 3;
const COLORS = [
    'var(--retro-accent)',
    'var(--retro-accent-2)',
    'var(--retro-accent-3)',
    'var(--retro-accent-4)',
    'var(--retro-accent-5)',
    'var(--retro-neutral)',
];

// Splits a routine name like "Push A" into its base ("Push") and A/B
// suffix, so A/B pairs (a common two-day rotation per muscle group) can be
// sorted onto the same legend row -- A on the left, B on the right, per the
// legend's 2-column grid. Names without a recognizable " A"/" B" suffix
// just sort by their full name with no pairing.
function splitName(name) {
    const match = name.match(/^(.*)\s([AB])$/i);
    return match ? { base: match[1], suffix: match[2].toUpperCase() } : { base: name, suffix: '' };
}

// Top-to-bottom row order for recognized push/pull/legs-style base names.
// Anything else falls back to alphabetical, after these.
const BASE_ORDER = ['Push', 'Pull', 'Legs'];

function byLegendOrder(a, b) {
    const ka = splitName(a.name);
    const kb = splitName(b.name);
    if (ka.base !== kb.base) {
        const ia = BASE_ORDER.indexOf(ka.base);
        const ib = BASE_ORDER.indexOf(kb.base);
        if (ia !== ib) return (ia === -1 ? BASE_ORDER.length : ia) - (ib === -1 ? BASE_ORDER.length : ib);
        return ka.base.localeCompare(kb.base);
    }
    return ka.suffix.localeCompare(kb.suffix);
}

// Deterministic color per group key, so a routine keeps the same color
// across reloads regardless of which position it lands in within the
// (time-windowed, shifting) query results.
function colorForKey(key) {
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
        hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
    }
    return COLORS[hash % COLORS.length];
}

// hevy_workouts arrives newest-first (started_at desc). Group by routine_id
// (stable even if the routine is later renamed), falling back to title only
// for ad-hoc workouts with no routine_id -- keep each group's most recent
// SESSIONS_PER_ROUTINE, then reverse so they plot oldest -> most recent,
// left to right. The displayed name is the most recent workout's title for
// that key, so a rename shows up without splitting the history.
function groupRoutines(workouts) {
    const byKey = new Map();
    for (const workout of workouts) {
        if (workout.duration_seconds == null) continue;
        const key = workout.routine_id ?? workout.title;
        const group = byKey.get(key) || { name: workout.title, sessions: [] };
        if (group.sessions.length < SESSIONS_PER_ROUTINE) group.sessions.push(workout);
        byKey.set(key, group);
    }
    return [...byKey.entries()].map(([key, group]) => ({
        key,
        name: group.name,
        color: colorForKey(key),
        minutes: group.sessions
            .slice()
            .reverse()
            .map((w) => Math.round(w.duration_seconds / 60)),
    }));
}

function HevyDurationTrend() {
    const { data, error } = useSupabaseQuery(
        (supabase) =>
            supabase
                .from('hevy_workouts')
                .select('title, routine_id, started_at, duration_seconds')
                .order('started_at', { ascending: false })
                .limit(100),
        [],
    );

    let body;
    if (error) {
        body = <p className="status-note">Couldn't load duration trend right now.</p>;
    } else if (!data) {
        body = <p className="status-note">Loading&hellip;</p>;
    } else {
        const routines = groupRoutines(data).filter((r) => r.minutes.length > 0);
        if (routines.length === 0) {
            body = <p className="status-note">No completed sessions with a recorded duration yet.</p>;
        } else {
            const maxN = Math.max(...routines.map((r) => r.minutes.length));
            const xStep = maxN > 1 ? (CHART_W - PAD * 2) / (maxN - 1) : 0;
            const allMinutes = routines.flatMap((r) => r.minutes);
            const dataMin = Math.min(...allMinutes);
            const dataMax = Math.max(...allMinutes);
            const margin = (dataMax - dataMin) * 0.2 || 5;
            const yMin = dataMin - margin;
            const yMax = dataMax + margin;
            const yScale = (CHART_H - PAD * 2) / (yMax - yMin);
            const toXY = (i, v) => ({ x: PAD + i * xStep, y: CHART_H - PAD - (v - yMin) * yScale });

            const lines = routines.map((r) => {
                // Right-align: a routine with fewer than maxN sessions still
                // ends at the rightmost "most recent" tick, it just starts
                // later, rather than being left-aligned and falling short of
                // "most recent".
                const offset = maxN - r.minutes.length;
                const points = r.minutes.map((v, i) => ({ ...toXY(i + offset, v), v }));
                const avgMin = Math.round(r.minutes.reduce((a, b) => a + b, 0) / r.minutes.length);
                return { ...r, points, avgMin };
            });
            const gridLines = Array.from({ length: GRID_STEPS + 1 }, (_, k) => ({
                y: PAD + (k * (CHART_H - PAD * 2)) / GRID_STEPS,
            }));
            const xTicks = Array.from({ length: maxN }, (_, i) => ({ x: PAD + i * xStep }));
            const totalSessions = routines.reduce((sum, r) => sum + r.minutes.length, 0);

            body = (
                <div className="hevy-duration-trend">
                    <p className="hevy-duration-trend-caption">
                        session duration trend per routine, last {SESSIONS_PER_ROUTINE} sessions
                    </p>
                    <svg
                        viewBox={`0 0 ${CHART_W} ${CHART_H}`}
                        width="100%"
                        height={CHART_H}
                        className="hevy-duration-trend-svg"
                    >
                        {gridLines.map((g, i) => (
                            <line key={i} x1={PAD} y1={g.y} x2={CHART_W - PAD} y2={g.y} stroke="rgba(80,220,220,.25)" strokeWidth="1" />
                        ))}
                        {xTicks.map((t, i) => (
                            <line key={i} x1={t.x} y1={PAD} x2={t.x} y2={CHART_H - PAD} stroke="rgba(80,220,220,.15)" strokeWidth="1" />
                        ))}
                        {lines.map((r) => (
                            <polyline
                                key={r.key}
                                points={r.points.map((p) => `${p.x},${p.y}`).join(' ')}
                                fill="none"
                                style={{ stroke: r.color }}
                                strokeWidth="2.5"
                            />
                        ))}
                        {lines.flatMap((r) =>
                            r.points.map((p, i) => (
                                <circle key={`${r.key}-${i}`} cx={p.x} cy={p.y} r="3.5" style={{ fill: r.color }} />
                            )),
                        )}
                    </svg>
                    <div className="hevy-duration-trend-range">
                        <span>{SESSIONS_PER_ROUTINE} sessions ago</span>
                        <span>most recent</span>
                    </div>
                    <div className="retro-crt-legend hevy-duration-trend-legend">
                        {[...lines].sort(byLegendOrder).map((r) => (
                            <div key={r.key} className="hevy-duration-trend-legend-row">
                                <span className="hevy-duration-trend-swatch" style={{ background: r.color }} />
                                {r.name} &mdash; {r.avgMin} min avg
                            </div>
                        ))}
                    </div>
                    <div className="hevy-duration-trend-total">based on {totalSessions} logged sessions</div>
                </div>
            );
        }
    }

    return <RetroPanel title="Duration">{body}</RetroPanel>;
}

export default HevyDurationTrend;
