import { useEffect, useState } from 'react';
import './GoodreadsActivity.css';

const GOODREADS_USER_ID = '179944323';
const RSS2JSON_API_KEY = import.meta.env.VITE_RSS2JSON_API_KEY;
const MAX_ENTRIES = 5;

function rss2jsonUrlForShelf(shelf) {
    const feedUrl = `https://www.goodreads.com/review/list_rss/${GOODREADS_USER_ID}?shelf=${shelf}`;
    const params = new URLSearchParams({ rss_url: feedUrl });
    // rss2json's `count` param requires an API key, so only ask for it when we have one.
    if (RSS2JSON_API_KEY) {
        params.set('api_key', RSS2JSON_API_KEY);
        params.set('count', String(MAX_ENTRIES));
    }
    return `https://api.rss2json.com/v1/api.json?${params.toString()}`;
}

// rss2json flattens Goodreads' custom RSS fields into the description as
// "author: X<br> ... rating: Y<br> ...", so pull author/rating back out of it.
function parseShelfEntry(item) {
    const authorMatch = item.description.match(/author: ([^<]*)<br/);
    const ratingMatch = item.description.match(/rating: (\d+)<br/);
    const rating = ratingMatch ? Number(ratingMatch[1]) : 0;

    return {
        key: item.guid || item.link,
        title: item.title,
        author: authorMatch ? authorMatch[1].trim() : null,
        rating: rating > 0 ? rating : null,
        link: item.link,
    };
}

function GoodreadsActivity({ shelf = 'read', emptyLabel = 'No recent shelf entries.' }) {
    const [books, setBooks] = useState(null);
    const [error, setError] = useState(false);

    useEffect(() => {
        let cancelled = false;

        fetch(rss2jsonUrlForShelf(shelf))
            .then((res) => res.json())
            .then((data) => {
                if (cancelled) return;
                if (data.status !== 'ok') throw new Error('rss2json returned an error');
                setBooks(data.items.slice(0, MAX_ENTRIES).map(parseShelfEntry));
            })
            .catch(() => {
                if (!cancelled) setError(true);
            });

        return () => {
            cancelled = true;
        };
    }, [shelf]);

    if (error) {
        return <p className="now-note">Couldn't load recent Goodreads activity right now.</p>;
    }

    if (!books) {
        return <p className="now-note">Loading recent books&hellip;</p>;
    }

    if (books.length === 0) {
        return <p className="now-note">{emptyLabel}</p>;
    }

    return (
        <ul className="goodreads-shelf">
            {books.map((book) => (
                <li key={book.key}>
                    <a href={book.link} target="_blank" rel="noopener noreferrer">
                        {book.title}
                    </a>
                    {book.author && <span> by {book.author}</span>}
                    {book.rating !== null && <span className="goodreads-rating"> &mdash; {book.rating}/5</span>}
                </li>
            ))}
        </ul>
    );
}

export default GoodreadsActivity;
