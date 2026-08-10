// Shared "sunken CRT" chrome for every Training-page widget (double-bevel
// panel + header bar), so the six Hevy widgets don't each re-implement the
// same four-level nested markup. Purely presentational — styles come from
// the .retro-crt-panel* classes in index.css.
function HevyPanel({ title, children }) {
    return (
        <div className="retro-crt-panel">
            <div className="retro-crt-panel-inner">
                <div className="retro-crt-panel-header">
                    <span>{title}</span>
                </div>
                <div className="retro-crt-panel-body">{children}</div>
            </div>
        </div>
    );
}

export default HevyPanel;
