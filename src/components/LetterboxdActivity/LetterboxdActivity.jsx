import FeedActivity from '../FeedActivity/FeedActivity';

function LetterboxdActivity() {
    return (
        <FeedActivity
            source="letterboxd"
            feedKey="diary"
            errorLabel="Couldn't load recent Letterboxd activity right now."
            loadingLabel="Loading recent films…"
            emptyLabel="No recent diary entries."
            renderItem={(row) => (
                <>
                    <a href={row.link} target="_blank" rel="noopener noreferrer">
                        {row.title} ({row.subtitle})
                    </a>
                    {row.rating !== null && <span className="feed-activity-rating"> &mdash; {row.rating}/5</span>}
                </>
            )}
        />
    );
}

export default LetterboxdActivity;
