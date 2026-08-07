import { useEffect, useState } from 'react';
import './GoodreadsActivity.css';

const GOODREADS_USER_ID = '179944323';
const MAX_ENTRIES = 5;

function rss2jsonUrlForShelf(shelf) {
    const feedUrl = `https://www.goodreads.com/review/list_rss/${GOODREADS_USER_ID}?shelf=${shelf}`;
    // rss2json's `count` param requires a paid API key, so fetch its default page and slice client-side.
    return `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feedUrl)}`;
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
