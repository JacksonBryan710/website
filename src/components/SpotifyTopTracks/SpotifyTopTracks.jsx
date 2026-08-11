import SpotifyTopList from '../SpotifyTopList/SpotifyTopList';

function SpotifyTopTracks() {
    return (
        <SpotifyTopList
            table="spotify_top_tracks"
            subtitleField="artist_names"
            errorLabel="Couldn't load top songs right now."
            loadingLabel="Loading top songs…"
            emptyLabel="No top songs yet."
        />
    );
}

export default SpotifyTopTracks;
