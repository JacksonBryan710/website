// Shared "sunken CRT" chrome (double-bevel panel + header bar) used for every
// content block site-wide, not just Training's Hevy widgets. Purely
// presentational — styles come from the .retro-crt-panel* classes in index.css.
function RetroPanel({ title, headerRight, children }) {
    return (
        <div className="retro-crt-panel">
            <div className="retro-crt-panel-inner">
                <div className="retro-crt-panel-header">
                    <span>{title}</span>
                    {headerRight}
                </div>
                <div className="retro-crt-panel-body">{children}</div>
            </div>
        </div>
    );
}

export default RetroPanel;
