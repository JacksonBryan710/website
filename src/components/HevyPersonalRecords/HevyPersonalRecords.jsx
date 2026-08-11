import { useSupabaseQuery } from '../../lib/useSupabaseQuery';
import RetroPanel from '../RetroPanel/RetroPanel';
import './HevyPersonalRecords.css';

const KG_TO_LB = 2.20462262;

function HevyPersonalRecords() {
    const { data, error } = useSupabaseQuery(
        (supabase) =>
            supabase.from('hevy_personal_records').select('*').order('weight_kg', { ascending: false }).limit(5),
        [],
    );

    let body;
    if (error) {
        body = <p className="status-note">Couldn't load personal records right now.</p>;
    } else if (!data) {
        body = <p className="status-note">Loading&hellip;</p>;
    } else if (data.length === 0) {
        body = <p className="status-note">No personal records yet.</p>;
    } else {
        body = (
            <ul className="hevy-prs">
                {data.map((pr) => (
                    <li key={pr.exercise_template_id}>
                        <span>{pr.exercise_title}</span>
                        <span className="hevy-prs-value">
                            {Math.round(pr.weight_kg * KG_TO_LB)} lb x {pr.reps}
                        </span>
                    </li>
                ))}
            </ul>
        );
    }

    return <RetroPanel title="Personal Records">{body}</RetroPanel>;
}

export default HevyPersonalRecords;
