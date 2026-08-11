import { useSupabaseQuery } from '../../lib/useSupabaseQuery';
import './GoodreadsActivity.css';

function GoodreadsActivity({ shelf = 'read', emptyLabel = 'No recent shelf entries.' }) {
    const { data, error } = useSupabaseQuery(
        (supabase) =>
            supabase
                .from('feed_cache')
                .select('*')
                .eq('source', 'goodreads')
                .eq('feed_key', shelf)
                .order('sort_order', { ascending: true }),
        [shelf],
    );
    const books = data?.map((row) => ({
        key: row.id,
        title: row.title,
        author: row.subtitle,
        rating: row.rating,
        link: row.link,
    }));

    if (error) {
        return <p className="status-note">Couldn't load recent Goodreads activity right now.</p>;
    }

    if (!books) {
        return <p className="status-note">Loading recent books&hellip;</p>;
    }

    if (books.length === 0) {
        return <p className="status-note">{emptyLabel}</p>;
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
