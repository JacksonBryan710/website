import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import './Now.css';

const elsewhere = [
    { label: 'Letterboxd', href: 'https://letterboxd.com/JackJack305/' },
    { label: 'Goodreads', href: 'https://www.goodreads.com/user/show/179944323?ref=nav_profile_l' },
    { label: 'Spotify', href: 'https://open.spotify.com/user/jackson123200?si=f812cee1c4cd4558' },
    { label: 'Strava', href: 'https://www.strava.com/athletes/23026254?num_entries=10' },
];

function Now() {
    useEffect(() => {
        document.title = 'Jackson Bryan: Now';
    }, []);

    return (
        <div id="now-page">
            <header>
                <h1>Now</h1>
                <p className="now-subtitle">What I'm up to lately &mdash; updated whenever I remember to.</p>
            </header>

            <main>
                <section className="retro-box">
                    <h2>Around here</h2>
                    <p>
                        I keep a running list of recipes I actually cook on the{' '}
                        <Link to="/cooking">Recipes page</Link>.
                    </p>
                </section>

                <section className="retro-box">
                    <h2>Elsewhere on the web</h2>
                    <p>Follow along with what I'm watching, reading, listening to, and my training:</p>
                    <ul className="badge-list">
                        {elsewhere.map((item) => (
                            <li key={item.label}>
                                <a className="badge-link" href={item.href} target="_blank" rel="noopener noreferrer">
                                    {item.label}
                                </a>
                            </li>
                        ))}
                        <li>
                            <span className="badge-link badge-link-disabled">Hevy (soon)</span>
                        </li>
                    </ul>
                    <p className="now-note">Hevy link is pending &mdash; hoping to wire it up through their API.</p>
                </section>
            </main>
        </div>
    );
}

export default Now;
