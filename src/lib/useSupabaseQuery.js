import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

// Runs a Supabase query and tracks its data/error state, guarding against
// setting state after the effect has been cleaned up (e.g. deps changed
// mid-flight). `queryFn` receives the client and should return a thenable
// query builder, e.g. (supabase) => supabase.from('projects').select('*').
export function useSupabaseQuery(queryFn, deps) {
    const [data, setData] = useState(null);
    const [error, setError] = useState(false);

    useEffect(() => {
        let cancelled = false;
        // Clears a stale error from a previous run of this effect -- a no-op
        // for callers whose deps never change (error already starts false),
        // but load-bearing for a caller that polls (changing deps on an
        // interval, e.g. SpotifyNowPlaying): without this, one transient
        // failure left `error` stuck true forever, even once later polls
        // succeed, since nothing ever set it back to false.
        setError(false);

        queryFn(supabase)
            .then(({ data, error: fetchError }) => {
                if (cancelled) return;
                if (fetchError) throw fetchError;
                setData(data);
            })
            .catch(() => {
                if (!cancelled) setError(true);
            });

        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, deps);

    return { data, error };
}
