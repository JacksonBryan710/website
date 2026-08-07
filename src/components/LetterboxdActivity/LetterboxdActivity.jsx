import { useEffect, useState } from 'react';
import './LetterboxdActivity.css';

const LETTERBOXD_USERNAME = 'JackJack305';
const FEED_URL = `https://letterboxd.com/${LETTERBOXD_USERNAME}/rss/`;
// rss2json's `count` param requires a paid API key, so fetch its default page and slice client-side.
const RSS2JSON_URL = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(FEED_URL)}`;
const MAX_ENTRIES = 5;

// Letterboxd diary RSS titles look like "Film Name, 2024 - ★★★½"
function parseDiaryEntry(item) {
    const match = item.title.match(/^(.+), (\d{4})(?: - (.+))?$/);
    if (!match) return null;

    const [, name, year, stars] = match;
    const rating = stars
        ? (stars.match(/★/g) || []).length + (stars.match(/½/g) || []).length * 0.5
        : null;

    return {
        key: item.guid || item.link,
        name,
        year,
        rating,
        link: item.link,
    };
}

function LetterboxdActivity() {
    const [films, setFilms] = useState(null);
    const [error, setError] = useState(false);

    useEffect(() => {
        let cancelled = false;

        fetch(RSS2JSON_URL)
            .then((res) => res.json())
            .then((data) => {
                if (cancelled) return;
                if (data.status !== 'ok') throw new Error('rss2json returned an error');
                setFilms(data.items.slice(0, MAX_ENTRIES).map(parseDiaryEntry).filter(Boolean));
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
