import { useSupabaseQuery } from '../../lib/useSupabaseQuery';
import './HevyActivity.css';

const dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
const volumeFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

function HevyActivity() {
    const { data, error } = useSupabaseQuery(
        (supabase) => supabase.from('hevy_cache').select('*').limit(1),
        [],
    );
    const workout = data?.[0];

    if (error) {
        return <p className="now-note">Couldn't load recent Hevy activity right now.</p>;
    }

    if (!data) {
        return <p className="now-note">Loading latest lift&hellip;</p>;
    }

    if (!workout) {
        return <p className="now-note">No workouts logged yet.</p>;
    }

    return (
        <p className="hevy-stat">
            <span className="hevy-stat-title">{workout.title}</span>
            <span className="hevy-stat-date">{dateFormatter.format(new Date(workout.performed_at))}</span>
            <span className="hevy-stat-volume">{volumeFormatter.format(workout.total_volume_kg)} kg total volume</span>
        </p>
    );
}

export default HevyActivity;
