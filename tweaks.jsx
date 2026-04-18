/* Floating Tweaks panel — hidden until host enables */

function TweaksPanel({ state, setState }) {
  return (
    <div className="tweaks-panel">
      <div className="tweaks-hd"><span className="dot"/>Tweaks</div>
      <div className="tweaks-bd">
        <div className="tweak-row">
          <div className="lbl">Dashboard variant</div>
          <div className="seg">
            <button className={state.dashboardVariant === "hero" ? "active" : ""} onClick={() => setState({dashboardVariant: "hero"})}>Hero</button>
            <button className={state.dashboardVariant === "categories" ? "active" : ""} onClick={() => setState({dashboardVariant: "categories"})}>Grid</button>
            <button className={state.dashboardVariant === "story" ? "active" : ""} onClick={() => setState({dashboardVariant: "story"})}>Story</button>
          </div>
        </div>
        <div className="tweak-row">
          <div className="lbl">Theme</div>
          <div className="seg">
            <button className={state.theme === "dark" ? "active" : ""} onClick={() => setState({theme: "dark"})}>Dark</button>
            <button className={state.theme === "light" ? "active" : ""} onClick={() => setState({theme: "light"})}>Light</button>
          </div>
        </div>
        <div className="tweak-row">
          <div className="lbl">Currency</div>
          <div className="seg">
            {Object.entries(window.CURRENCIES).map(([code, info]) => (
              <button key={code} className={state.currency === code ? "active" : ""} onClick={() => setState({currency: code})}>
                {code}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

window.TweaksPanel = TweaksPanel;
