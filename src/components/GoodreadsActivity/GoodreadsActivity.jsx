import FeedActivity from '../FeedActivity/FeedActivity';

function GoodreadsActivity({ shelf = 'read', emptyLabel = 'No recent shelf entries.' }) {
    return (
        <FeedActivity
            source="goodreads"
            feedKey={shelf}
            errorLabel="Couldn't load recent Goodreads activity right now."
            loadingLabel="Loading recent books…"
            emptyLabel={emptyLabel}
            renderItem={(row) => (
                <>
                    <a href={row.link} target="_blank" rel="noopener noreferrer">
                        {row.title}
                    </a>
                    {row.subtitle && <span> by {row.subtitle}</span>}
                    {row.rating !== null && <span className="feed-activity-rating"> &mdash; {row.rating}/5</span>}
                </>
            )}
        />
    );
}

export default GoodreadsActivity;
