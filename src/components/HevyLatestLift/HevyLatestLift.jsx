import { useSupabaseQuery } from '../../lib/useSupabaseQuery';
import RetroPanel from '../RetroPanel/RetroPanel';
import './HevyLatestLift.css';

const dateFormatter = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
});

function HevyLatestLift() {
    const { data, error } = useSupabaseQuery(
        (supabase) => supabase.from('hevy_workouts').select('*').order('started_at', { ascending: false }).limit(1),
        [],
    );
    const workout = data?.[0];

    let body;
    if (error) {
        body = <p className="status-note">Couldn't load the latest lift right now.</p>;
    } else if (!data) {
        body = <p className="status-note">Loading&hellip;</p>;
    } else if (!workout) {
        body = <p className="status-note">No workouts logged yet.</p>;
    } else {
        const durationMin = workout.duration_seconds != null ? Math.round(workout.duration_seconds / 60) : null;
        body = (
            <div className="hevy-latest-lift">
                <div className="hevy-latest-lift-head">
                    <span className="hevy-latest-lift-title">{workout.title}</span>
                    <span className="hevy-latest-lift-date">{dateFormatter.format(new Date(workout.started_at))}</span>
                </div>
                <div className="hevy-latest-lift-stats">
                    <div className="hevy-latest-lift-stat">
                        <span className="hevy-latest-lift-label">Duration</span>
                        <span className="hevy-latest-lift-value hevy-latest-lift-value-blue">
                            {durationMin ?? '—'} min
                        </span>
                    </div>
                    <div className="hevy-latest-lift-stat">
                        <span className="hevy-latest-lift-label">Exercises</span>
                        <span className="hevy-latest-lift-value hevy-latest-lift-value-pink">{workout.exercise_count}</span>
                    </div>
                </div>
            </div>
        );
    }

    return <RetroPanel title="Latest Lift">{body}</RetroPanel>;
}

export default HevyLatestLift;
