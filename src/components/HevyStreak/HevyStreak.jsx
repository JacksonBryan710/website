import { useSupabaseQuery } from '../../lib/useSupabaseQuery';
import RetroPanel from '../RetroPanel/RetroPanel';
import './HevyStreak.css';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
// A streak survives one full rest day between sessions; a longer gap breaks it.
const REST_DAY_TOLERANCE_DAYS = 2;

function toDateOnly(iso) {
    const d = new Date(iso);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function computeStreaks(rows) {
    const days = [...new Set(rows.map((r) => toDateOnly(r.started_at)))].sort((a, b) => a - b);
    if (days.length === 0) return { current: 0, best: 0 };

    let best = 1;
    let runStart = days[0];
    for (let i = 1; i < days.length; i++) {
        const gapDays = (days[i] - days[i - 1]) / MS_PER_DAY;
        if (gapDays > REST_DAY_TOLERANCE_DAYS) runStart = days[i];
        best = Math.max(best, (days[i] - runStart) / MS_PER_DAY + 1);
    }

    const lastDay = days[days.length - 1];
    const gapToToday = (toDateOnly(new Date().toISOString()) - lastDay) / MS_PER_DAY;
    const current = gapToToday > REST_DAY_TOLERANCE_DAYS ? 0 : (lastDay - runStart) / MS_PER_DAY + 1;

    return { current, best };
}

function HevyStreak() {
    const { data, error } = useSupabaseQuery(
        (supabase) => supabase.from('hevy_workouts').select('started_at').order('started_at', { ascending: true }),
        [],
    );

    let body;
    if (error) {
        body = <p className="status-note">Couldn't load streak right now.</p>;
    } else if (!data) {
        body = <p className="status-note">Loading&hellip;</p>;
    } else if (data.length === 0) {
        body = <p className="status-note">No workouts logged yet.</p>;
    } else {
        const { current, best } = computeStreaks(data);
        body = (
            <div className="hevy-streak">
                <div className="hevy-streak-current">
                    {current} <span>days</span>
                </div>
                <div className="hevy-streak-best">personal best: {best} days</div>
            </div>
        );
    }

    return <RetroPanel title="Streak">{body}</RetroPanel>;
}

export default HevyStreak;
