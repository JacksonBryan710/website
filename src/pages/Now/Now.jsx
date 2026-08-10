import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import LetterboxdActivity from '../../components/LetterboxdActivity/LetterboxdActivity';
import GoodreadsActivity from '../../components/GoodreadsActivity/GoodreadsActivity';
import './Now.css';

const elsewhere = [
    { label: 'Letterboxd', href: 'https://letterboxd.com/JackJack305/' },
    { label: 'Goodreads', href: 'https://www.goodreads.com/user/show/179944323?ref=nav_profile_l' },
    { label: 'Spotify', href: 'https://open.spotify.com/user/jackson123200?si=f812cee1c4cd4558' },
    { label: 'Strava', href: 'https://www.strava.com/athletes/23026254?num_entries=10' },
    { label: 'Hevy', href: '/training' },
];

function Now() {
    useEffect(() => {
        document.title = 'Jackson Bryan: Now';
    }, []);

    return (
        <div id="now-page" className="page">
            <header>
                <h1 className="page-title">Now</h1>
                <p className="now-subtitle">What I've been into lately &mdash; updated whenever I remember to.</p>
            </header>

            <main>
                <section className="retro-box">
                    <h2>Recently watched</h2>
                    <LetterboxdActivity />
                </section>

                <section className="retro-box">
                    <h2>Favorite films</h2>
                    <p className="now-note">// top 4 coming soon</p>
                </section>

                <section className="retro-box">
                    <h2>Currently reading</h2>
                    <GoodreadsActivity shelf="currently-reading" emptyLabel="Not reading anything at the moment." />
                </section>

                <section className="retro-box">
                    <h2>Recently read</h2>
                    <GoodreadsActivity shelf="read" />
                </section>

                <section className="retro-box">
                    <h2>From the source</h2>
                    <p>Follow along with what I'm watching, reading, listening to, and my training:</p>
                    <ul className="badge-list">
                        {elsewhere.map((item) => (
                            <li key={item.label}>
                                {item.href.startsWith('/') ? (
                                    <Link className="badge-link" to={item.href}>
                                        {item.label}
                                    </Link>
                                ) : (
                                    <a className="badge-link" href={item.href} target="_blank" rel="noopener noreferrer">
                                        {item.label}
                                    </a>
                                )}
                            </li>
                        ))}
                    </ul>
                </section>
            </main>
        </div>
    );
}

export default Now;
