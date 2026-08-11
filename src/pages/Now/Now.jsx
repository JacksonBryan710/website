import { Link } from 'react-router-dom';
import { useDocumentTitle } from '../../lib/useDocumentTitle';
import RetroPanel from '../../components/RetroPanel/RetroPanel';
import LetterboxdActivity from '../../components/LetterboxdActivity/LetterboxdActivity';
import GoodreadsActivity from '../../components/GoodreadsActivity/GoodreadsActivity';
import SpotifyTopTracks from '../../components/SpotifyTopTracks/SpotifyTopTracks';
import SpotifyTopArtists from '../../components/SpotifyTopArtists/SpotifyTopArtists';
import './Now.css';

const elsewhere = [
    { label: 'Letterboxd', href: 'https://letterboxd.com/JackJack305/' },
    { label: 'Goodreads', href: 'https://www.goodreads.com/user/show/179944323?ref=nav_profile_l' },
    { label: 'Spotify', href: 'https://open.spotify.com/user/jackson123200?si=f812cee1c4cd4558' },
    { label: 'Strava', href: 'https://www.strava.com/athletes/23026254?num_entries=10' },
    { label: 'Hevy', href: '/training' },
];

function Now() {
    useDocumentTitle('Jackson Bryan: Now');

    return (
        <div id="now-page" className="page page-stack">
            <header>
                <h1 className="page-title">Now</h1>
                <p className="page-subtitle">What I've been into lately &mdash; updated whenever I remember to.</p>
            </header>

            <main className="page-stack">
                <div className="now-row now-row-2col">
                    <RetroPanel title="Top songs last month">
                        <SpotifyTopTracks />
                    </RetroPanel>

                    <RetroPanel title="Top artists last month">
                        <SpotifyTopArtists />
                    </RetroPanel>
                </div>

                <RetroPanel title="Recently watched">
                    <LetterboxdActivity />
                </RetroPanel>

                <RetroPanel title="Favorite films">
                    <p className="status-note">// top 4 coming soon</p>
                </RetroPanel>

                <RetroPanel title="Currently reading">
                    <GoodreadsActivity shelf="currently-reading" emptyLabel="Not reading anything at the moment." />
                </RetroPanel>

                <RetroPanel title="Recently read">
                    <GoodreadsActivity shelf="read" />
                </RetroPanel>

                <RetroPanel title="From the source">
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
                </RetroPanel>
            </main>
        </div>
    );
}

export default Now;
