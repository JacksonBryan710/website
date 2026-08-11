// Collapses the error/loading branches every useSupabaseQuery-backed widget
// hand-rolled identically. What counts as "empty" varies per caller (raw row
// count, a derived/grouped count, combined multi-query state), so that stays
// the caller's job inside `children`.
function QueryStatus({ error, data, errorLabel, loadingLabel = 'Loading…', children }) {
    if (error) {
        return <p className="status-note">{errorLabel}</p>;
    }

    if (!data) {
        return <p className="status-note">{loadingLabel}</p>;
    }

    return children(data);
}

export default QueryStatus;
