import { useSupabaseQuery } from '../../lib/useSupabaseQuery';
import './LetterboxdActivity.css';

function LetterboxdActivity() {
    const { data, error } = useSupabaseQuery(
        (supabase) =>
            supabase
                .from('feed_cache')
                .select('*')
                .eq('source', 'letterboxd')
                .eq('feed_key', 'diary')
                .order('sort_order', { ascending: true }),
        [],
    );
    const films = data?.map((row) => ({
        key: row.id,
        name: row.title,
        year: row.subtitle,
        rating: row.rating,
        link: row.link,
    }));

    if (error) {
        return <p className="status-note">Couldn't load recent Letterboxd activity right now.</p>;
    }

    if (!films) {
        return <p className="status-note">Loading recent films&hellip;</p>;
    }

    if (films.length === 0) {
        return <p className="status-note">No recent diary entries.</p>;
    }

    return (
        <ul className="letterboxd-diary">
            {films.map((film) => (
                <li key={film.key}>
                    <a href={film.link} target="_blank" rel="noopener noreferrer">
                        {film.name} ({film.year})
                    </a>
                    {film.rating !== null && <span className="letterboxd-rating"> &mdash; {film.rating}/5</span>}
                </li>
            ))}
        </ul>
    );
}

export default LetterboxdActivity;
