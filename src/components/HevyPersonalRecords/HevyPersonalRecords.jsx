import { useSupabaseQuery } from '../../lib/useSupabaseQuery';
import RetroPanel from '../RetroPanel/RetroPanel';
import QueryStatus from '../QueryStatus/QueryStatus';
import './HevyPersonalRecords.css';

const KG_TO_LB = 2.20462262;

function HevyPersonalRecords() {
    const { data, error } = useSupabaseQuery(
        (supabase) =>
            supabase.from('hevy_personal_records').select('*').order('weight_kg', { ascending: false }).limit(5),
        [],
    );

    return (
        <RetroPanel title="Personal Records">
            <QueryStatus error={error} data={data} errorLabel="Couldn't load personal records right now.">
                {(rows) =>
                    rows.length === 0 ? (
                        <p className="status-note">No personal records yet.</p>
                    ) : (
                        <ul className="hevy-prs">
                            {rows.map((pr) => (
                                <li key={pr.exercise_template_id}>
                                    <span>{pr.exercise_title}</span>
                                    <span className="hevy-prs-value">
                                        {Math.round(pr.weight_kg * KG_TO_LB)} lb x {pr.reps}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )
                }
            </QueryStatus>
        </RetroPanel>
    );
}

export default HevyPersonalRecords;
