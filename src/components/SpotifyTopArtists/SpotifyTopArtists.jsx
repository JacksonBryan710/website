import SpotifyTopList from '../SpotifyTopList/SpotifyTopList';

function SpotifyTopArtists() {
    return (
        <SpotifyTopList
            table="spotify_top_artists"
            subtitleField="genres"
            thumbPixelSize={8}
            errorLabel="Couldn't load top artists right now."
            loadingLabel="Loading top artists…"
            emptyLabel="No top artists yet."
        />
    );
}

export default SpotifyTopArtists;
