import { useSupabaseQuery } from '../../lib/useSupabaseQuery';
import RetroPanel from '../RetroPanel/RetroPanel';
import './HevyFrequency.css';

const WEEKS = 52;
const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;
const ALPHA_BY_COUNT = [0.08, 0.3, 0.5, 0.7, 0.85, 1];

function buildHeatmap(rows) {
    const now = Date.now();
    const timestamps = rows.map((r) => new Date(r.started_at).getTime());
    const weeks = [];
    for (let i = WEEKS - 1; i >= 0; i--) {
        const weekEnd = now - i * MS_PER_WEEK;
        const weekStart = weekEnd - MS_PER_WEEK;
        const count = timestamps.filter((t) => t >= weekStart && t < weekEnd).length;
        weeks.push({ count, bg: `rgba(57, 255, 20, ${ALPHA_BY_COUNT[Math.min(count, ALPHA_BY_COUNT.length - 1)]})` });
    }
    return weeks;
}

function HevyFrequency() {
    const { data, error } = useSupabaseQuery(
        (supabase) =>
            supabase
                .from('hevy_workouts')
                .select('started_at')
                .gte('started_at', new Date(Date.now() - WEEKS * MS_PER_WEEK).toISOString()),
        [],
    );

    let body;
    if (error) {
        body = <p className="status-note">Couldn't load workout frequency right now.</p>;
    } else if (!data) {
        body = <p className="status-note">Loading&hellip;</p>;
    } else {
        const weeks = buildHeatmap(data);
        body = (
            <>
                <p className="hevy-frequency-caption">workouts per week, past year</p>
                <div className="hevy-frequency-grid">
                    {weeks.map((week, i) => (
                        <div
                            key={i}
                            className="hevy-frequency-cell"
                            style={{ background: week.bg }}
                            title={`${week.count} workouts`}
                        />
                    ))}
                </div>
                <div className="hevy-frequency-range">
                    <span>52 weeks ago</span>
                    <span>this week</span>
                </div>
                <div className="retro-crt-legend hevy-frequency-legend">
                    <span>0 workouts</span>
                    <span className="hevy-frequency-legend-swatch" style={{ background: 'rgba(57,255,20,0.08)' }} />
                    <span className="hevy-frequency-legend-swatch" style={{ background: 'rgba(57,255,20,0.45)' }} />
                    <span className="hevy-frequency-legend-swatch" style={{ background: 'rgba(57,255,20,1)' }} />
                    <span>5+ workouts</span>
                </div>
            </>
        );
    }

    return <RetroPanel title="Frequency">{body}</RetroPanel>;
}

export default HevyFrequency;
