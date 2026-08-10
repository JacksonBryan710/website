import { useSupabaseQuery } from '../../lib/useSupabaseQuery';
import HevyPanel from '../HevyPanel/HevyPanel';
import './HevyMuscleSplit.css';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const RADIUS = 40;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

// Hevy's MuscleGroup enum has 20 values; bucketed here into the 5 display
// groups from the design plus a catch-all "Other" for anything unmapped
// (abs/cardio/neck/full_body/other, or an exercise whose template hasn't
// synced into hevy_exercise_templates yet).
const GROUPS = [
    { key: 'legs', label: 'Legs', color: 'var(--retro-accent)', raw: ['quadriceps', 'hamstrings', 'calves', 'glutes', 'abductors', 'adductors'] },
    { key: 'back', label: 'Back', color: 'var(--retro-accent-2)', raw: ['lats', 'upper_back', 'traps', 'lower_back'] },
    { key: 'chest', label: 'Chest', color: 'var(--retro-accent-3)', raw: ['chest'] },
    { key: 'shoulders', label: 'Shoulders', color: 'var(--retro-accent-4)', raw: ['shoulders'] },
    { key: 'arms', label: 'Arms', color: 'var(--retro-neutral)', raw: ['biceps', 'triceps', 'forearms'] },
    { key: 'other', label: 'Other', color: 'var(--retro-accent-5)', raw: [] },
];

const RAW_TO_GROUP = new Map();
for (const group of GROUPS) {
    for (const raw of group.raw) RAW_TO_GROUP.set(raw, group.key);
}

function HevyMuscleSplit() {
    const { data: sets, error: setsError } = useSupabaseQuery(
        (supabase) =>
            supabase
                .from('hevy_sets')
                .select('exercise_template_id')
                .eq('set_type', 'normal')
                .gte('performed_at', new Date(Date.now() - THIRTY_DAYS_MS).toISOString()),
        [],
    );
    const { data: templates, error: templatesError } = useSupabaseQuery(
        (supabase) => supabase.from('hevy_exercise_templates').select('id, primary_muscle_group'),
        [],
    );

    const error = setsError || templatesError;
    const loaded = sets && templates;

    let body;
    if (error) {
        body = <p className="status-note">Couldn't load muscle split right now.</p>;
    } else if (!loaded) {
        body = <p className="status-note">Loading&hellip;</p>;
    } else if (sets.length === 0) {
        body = <p className="status-note">No sets logged in the last 30 days.</p>;
    } else {
        const muscleGroupById = new Map(templates.map((t) => [t.id, t.primary_muscle_group]));
        const counts = new Map();
        for (const set of sets) {
            const raw = muscleGroupById.get(set.exercise_template_id);
            const groupKey = RAW_TO_GROUP.get(raw) || 'other';
            counts.set(groupKey, (counts.get(groupKey) || 0) + 1);
        }
        const total = sets.length;
        const slices = GROUPS.map((group) => ({
            ...group,
            pct: Math.round(((counts.get(group.key) || 0) / total) * 1000) / 10,
        })).filter((group) => group.pct > 0);

        const arcs = slices.reduce((built, slice) => {
            const acc = built.length > 0 ? built[built.length - 1].acc : 0;
            const len = (slice.pct / 100) * CIRCUMFERENCE;
            built.push({ ...slice, dasharray: `${len} ${CIRCUMFERENCE - len}`, dashoffset: -acc, acc: acc + len });
            return built;
        }, []);

        body = (
            <div className="hevy-muscle-split">
                <svg viewBox="0 0 100 100" width="130" height="130">
                    {arcs.map((arc) => (
                        <circle
                            key={arc.key}
                            cx="50"
                            cy="50"
                            r={RADIUS}
                            fill="none"
                            style={{ stroke: arc.color }}
                            strokeWidth="14"
                            strokeDasharray={arc.dasharray}
                            strokeDashoffset={arc.dashoffset}
                            transform="rotate(-90 50 50)"
                        />
                    ))}
                </svg>
                <div className="retro-crt-legend hevy-muscle-split-legend">
                    {arcs.map((arc) => (
                        <div key={arc.key} className="hevy-muscle-split-legend-row">
                            <span className="hevy-muscle-split-swatch" style={{ background: arc.color }} />
                            {arc.label} &mdash; {arc.pct}%
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return <HevyPanel title="Muscle Split">{body}</HevyPanel>;
}

export default HevyMuscleSplit;
