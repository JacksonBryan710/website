import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import './LetterboxdActivity.css';

function LetterboxdActivity() {
    const [films, setFilms] = useState(null);
    const [error, setError] = useState(false);

    useEffect(() => {
        let cancelled = false;

        supabase
            .from('feed_cache')
            .select('*')
            .eq('source', 'letterboxd')
            .eq('feed_key', 'diary')
            .order('sort_order', { ascending: true })
            .then(({ data, error: fetchError }) => {
                if (cancelled) return;
                if (fetchError) throw fetchError;
                setFilms(
                    data.map((row) => ({
                        key: row.id,
                        name: row.title,
                        year: row.subtitle,
                        rating: row.rating,
                        link: row.link,
                    })),
                );
            })
            .catch(() => {
                if (!cancelled) setError(true);
            });

        return () => {
            cancelled = true;
        };
    }, []);

    if (error) {
        return <p className="now-note">Couldn't load recent Letterboxd activity right now.</p>;
    }

    if (!films) {
        return <p className="now-note">Loading recent films&hellip;</p>;
    }

    if (films.length === 0) {
        return <p className="now-note">No recent diary entries.</p>;
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
