import { useEffect, useState } from 'react';
import './LetterboxdActivity.css';

const LETTERBOXD_USERNAME = 'JackJack305';
const FEED_URL = `https://letterboxd.com/${LETTERBOXD_USERNAME}/rss/`;
const RSS2JSON_API_KEY = import.meta.env.VITE_RSS2JSON_API_KEY;
const MAX_ENTRIES = 5;

function buildRss2JsonUrl() {
    const params = new URLSearchParams({ rss_url: FEED_URL });
    // rss2json's `count` param requires an API key, so only ask for it when we have one.
    if (RSS2JSON_API_KEY) {
        params.set('api_key', RSS2JSON_API_KEY);
        params.set('count', String(MAX_ENTRIES));
    }
    return `https://api.rss2json.com/v1/api.json?${params.toString()}`;
}

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

        fetch(buildRss2JsonUrl())
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
