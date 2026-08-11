import { useSupabaseQuery } from '../../lib/useSupabaseQuery';
import QueryStatus from '../QueryStatus/QueryStatus';
import './FeedActivity.css';

// Generic list widget over the feed_cache table -- Letterboxd and Goodreads
// today, and a future source (e.g. Spotify) just needs a thin wrapper like
// LetterboxdActivity/GoodreadsActivity supplying its own row formatting.
function FeedActivity({ source, feedKey, errorLabel, loadingLabel, emptyLabel, renderItem }) {
    const { data, error } = useSupabaseQuery(
        (supabase) =>
            supabase
                .from('feed_cache')
                .select('*')
                .eq('source', source)
                .eq('feed_key', feedKey)
                .order('sort_order', { ascending: true }),
        [source, feedKey],
    );

    return (
        <QueryStatus error={error} data={data} errorLabel={errorLabel} loadingLabel={loadingLabel}>
            {(rows) =>
                rows.length === 0 ? (
                    <p className="status-note">{emptyLabel}</p>
                ) : (
                    <ul className="feed-activity-list">
                        {rows.map((row) => (
                            <li key={row.id}>{renderItem(row)}</li>
                        ))}
                    </ul>
                )
            }
        </QueryStatus>
    );
}

export default FeedActivity;
