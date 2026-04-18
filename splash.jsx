/* Splash: animated intro that plays once per session. */

function Splash({ onDone }) {
  const [phase, setPhase] = React.useState(0);
  // phase 0: mark draws in
  // phase 1: wordmark slides in, tagline fades up
  // phase 2: net worth counts up
  // phase 3: fade out

  const net = window.NET_WORTH || 0;
  const hasData = (window.ASSETS || []).length > 0;
  const [displayNet, setDisplayNet] = React.useState(0);

  React.useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 700);
    const t2 = setTimeout(() => setPhase(2), 1400);
    const t3 = setTimeout(() => setPhase(3), hasData ? 2900 : 2300);
    const t4 = setTimeout(() => onDone(), hasData ? 3400 : 2800);
    return () => { [t1,t2,t3,t4].forEach(clearTimeout); };
  }, [onDone, hasData]);

  // Count-up for net worth
  React.useEffect(() => {
    if (phase < 2 || !hasData) return;
    const duration = 1200;
    const start = performance.now();
    let raf;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      setDisplayNet(net * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase, net, hasData]);

  const ccy = window.CURRENCIES[(window.__APP_STATE||{}).currency] || window.CURRENCIES.AUD || { symbol: "$" };

  return (
    <div className={"splash " + (phase >= 3 ? "splash-exit" : "")}>
      {/* Ambient aurora */}
      <div className="splash-aurora splash-aurora-1"/>
      <div className="splash-aurora splash-aurora-2"/>
      <div className="splash-grain"/>

      <div className="splash-inner">
        {/* Mark */}
        <div className={"splash-mark " + (phase >= 0 ? "in" : "")}>
          <svg width="84" height="84" viewBox="0 0 84 84" fill="none">
            <defs>
              <linearGradient id="splashGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="var(--accent)"/>
                <stop offset="100%" stopColor="color-mix(in oklab, var(--accent) 40%, var(--up))"/>
              </linearGradient>
            </defs>
            {/* Three stacked bars — strata */}
            <rect className="splash-bar b1" x="14" y="54" width="56" height="12" rx="3" fill="url(#splashGrad)"/>
            <rect className="splash-bar b2" x="22" y="36" width="40" height="12" rx="3" fill="url(#splashGrad)" opacity="0.75"/>
            <rect className="splash-bar b3" x="30" y="18" width="24" height="12" rx="3" fill="url(#splashGrad)" opacity="0.5"/>
          </svg>
        </div>

        {/* Wordmark */}
        <div className={"splash-word " + (phase >= 1 ? "in" : "")}>
          <span>Strata</span>
        </div>

        <div className={"splash-tag " + (phase >= 1 ? "in" : "")}>
          <span className="splash-dot"/>
          <span>Personal wealth intelligence</span>
        </div>

        {/* Net worth readout — only if we have data */}
        {hasData && (
          <div className={"splash-net " + (phase >= 2 ? "in" : "")}>
            <div className="splash-net-label">Net worth</div>
            <div className="splash-net-val">
              {ccy.symbol}{Math.round(displayNet).toLocaleString()}
            </div>
          </div>
        )}

        {!hasData && (
          <div className={"splash-net " + (phase >= 2 ? "in" : "")}>
            <div className="splash-net-label">Welcome</div>
            <div className="splash-net-val" style={{fontSize: 22, letterSpacing: 0, fontFamily: "inherit", fontWeight: 400, color: "var(--ink-2)"}}>
              Let's build your picture.
            </div>
          </div>
        )}
      </div>

      <style>{`
        .splash {
          position: fixed; inset: 0; z-index: 9999;
          background: var(--bg);
          display: grid; place-items: center;
          overflow: hidden;
          transition: opacity .5s ease;
        }
        .splash-exit { opacity: 0; pointer-events: none; }

        .splash-aurora {
          position: absolute; width: 700px; height: 700px; border-radius: 50%;
          filter: blur(120px); opacity: 0.35;
          animation: splash-drift 8s ease-in-out infinite alternate;
        }
        .splash-aurora-1 {
          background: radial-gradient(circle, var(--accent), transparent 60%);
          top: -200px; left: -150px;
        }
        .splash-aurora-2 {
          background: radial-gradient(circle, color-mix(in oklab, var(--up) 70%, var(--accent)), transparent 60%);
          bottom: -200px; right: -150px;
          animation-duration: 10s;
          animation-delay: -3s;
        }
        @keyframes splash-drift {
          0%   { transform: translate(0, 0) scale(1); }
          100% { transform: translate(40px, -30px) scale(1.15); }
        }

        .splash-grain {
          position: absolute; inset: 0;
          background-image: radial-gradient(circle at 20% 30%, rgba(255,255,255,0.03) 1px, transparent 1px),
                            radial-gradient(circle at 70% 80%, rgba(255,255,255,0.02) 1px, transparent 1px);
          background-size: 4px 4px, 6px 6px;
          opacity: 0.5;
          pointer-events: none;
        }

        .splash-inner {
          position: relative; z-index: 2;
          display: flex; flex-direction: column; align-items: center;
          gap: 18px;
        }

        .splash-mark {
          opacity: 0; transform: scale(0.85);
          transition: opacity .5s ease, transform .7s cubic-bezier(.2,.7,.2,1);
          filter: drop-shadow(0 6px 24px color-mix(in oklab, var(--accent) 40%, transparent));
        }
        .splash-mark.in { opacity: 1; transform: scale(1); }

        .splash-bar {
          transform-origin: left center;
          transform: scaleX(0);
          animation: splash-bar-in .55s cubic-bezier(.2,.7,.2,1) forwards;
        }
        .splash-bar.b1 { animation-delay: .05s; }
        .splash-bar.b2 { animation-delay: .2s; }
        .splash-bar.b3 { animation-delay: .35s; }
        @keyframes splash-bar-in {
          to { transform: scaleX(1); }
        }

        .splash-word {
          font-family: var(--serif, Georgia, serif);
          font-size: 52px;
          letter-spacing: -0.02em;
          color: var(--ink);
          opacity: 0; transform: translateY(8px);
          transition: opacity .6s ease .05s, transform .6s cubic-bezier(.2,.7,.2,1) .05s;
          margin-top: 8px;
          line-height: 1;
        }
        .splash-word.in { opacity: 1; transform: translateY(0); }

        .splash-tag {
          display: inline-flex; align-items: center; gap: 8px;
          font-size: 12px; font-family: var(--mono);
          text-transform: uppercase; letter-spacing: 0.18em;
          color: var(--ink-3);
          opacity: 0; transform: translateY(6px);
          transition: opacity .6s ease .25s, transform .6s cubic-bezier(.2,.7,.2,1) .25s;
        }
        .splash-tag.in { opacity: 1; transform: translateY(0); }
        .splash-dot {
          width: 5px; height: 5px; border-radius: 50%;
          background: var(--accent);
          box-shadow: 0 0 10px var(--accent);
          animation: splash-dot-pulse 1.6s ease-in-out infinite;
        }
        @keyframes splash-dot-pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }

        .splash-net {
          margin-top: 26px;
          text-align: center;
          opacity: 0; transform: translateY(10px);
          transition: opacity .7s ease, transform .7s cubic-bezier(.2,.7,.2,1);
        }
        .splash-net.in { opacity: 1; transform: translateY(0); }
        .splash-net-label {
          font-size: 10px; font-family: var(--mono);
          text-transform: uppercase; letter-spacing: 0.2em;
          color: var(--ink-4);
          margin-bottom: 8px;
        }
        .splash-net-val {
          font-family: var(--mono);
          font-size: 38px;
          letter-spacing: -0.01em;
          color: var(--ink);
          font-variant-numeric: tabular-nums;
        }
      `}</style>
    </div>
  );
}

Object.assign(window, { Splash });
