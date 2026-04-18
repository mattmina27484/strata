/* Simple passcode lock. The passcode is YOUR CHOICE, set in index.html.
   It's just a cosmetic barrier — real security comes from the URL being unguessable.
   If no passcode is set (empty string), the lock is disabled. */

function PasscodeLock({ onUnlock }) {
  const required = (window.STRATA_PASSCODE || "").trim();
  const [val, setVal] = React.useState("");
  const [shake, setShake] = React.useState(false);
  const inputRef = React.useRef(null);

  React.useEffect(() => {
    // If already unlocked this session, skip
    if (sessionStorage.getItem("strata.unlocked") === "1" || !required) {
      onUnlock();
      return;
    }
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  function submit(e) {
    e.preventDefault();
    if (val === required) {
      sessionStorage.setItem("strata.unlocked", "1");
      onUnlock();
    } else {
      setShake(true); setVal("");
      setTimeout(() => setShake(false), 500);
    }
  }

  if (!required || sessionStorage.getItem("strata.unlocked") === "1") return null;

  return (
    <div className="lock-scrim">
      <div className="lock-aurora lock-aurora-1"/>
      <div className="lock-aurora lock-aurora-2"/>
      <form className={"lock-card " + (shake ? "shake" : "")} onSubmit={submit}>
        <div className="lock-mark">
          <svg width="44" height="44" viewBox="0 0 44 44">
            <rect x="8" y="28" width="28" height="6" rx="1.5" fill="var(--accent)"/>
            <rect x="12" y="19" width="20" height="6" rx="1.5" fill="var(--accent)" opacity="0.7"/>
            <rect x="16" y="10" width="12" height="6" rx="1.5" fill="var(--accent)" opacity="0.5"/>
          </svg>
        </div>
        <div className="lock-title">Strata</div>
        <div className="lock-sub">Enter passcode</div>
        <input ref={inputRef} type="password" value={val} onChange={e => setVal(e.target.value)} autoComplete="off"/>
        <button type="submit" className="btn primary">Unlock</button>
      </form>
      <style>{`
        .lock-scrim {
          position: fixed; inset: 0; z-index: 99999;
          background: var(--bg);
          display: grid; place-items: center;
          overflow: hidden;
        }
        .lock-aurora {
          position: absolute; width: 600px; height: 600px; border-radius: 50%;
          filter: blur(120px); opacity: 0.3; pointer-events: none;
        }
        .lock-aurora-1 { background: radial-gradient(circle, var(--accent), transparent 60%); top: -200px; left: -150px; }
        .lock-aurora-2 { background: radial-gradient(circle, color-mix(in oklab, var(--up) 70%, var(--accent)), transparent 60%); bottom: -200px; right: -150px; }

        .lock-card {
          position: relative; z-index: 2;
          background: var(--bg-1); border: 1px solid var(--line);
          border-radius: 16px; padding: 36px 40px;
          display: flex; flex-direction: column; align-items: center;
          gap: 14px; min-width: 320px;
        }
        .lock-card.shake { animation: lock-shake .4s; }
        @keyframes lock-shake {
          0%,100%{transform:translateX(0)}
          20%{transform:translateX(-8px)} 40%{transform:translateX(8px)}
          60%{transform:translateX(-6px)} 80%{transform:translateX(6px)}
        }
        .lock-mark { margin-bottom: 4px; filter: drop-shadow(0 4px 16px color-mix(in oklab, var(--accent) 40%, transparent)); }
        .lock-title { font-family: var(--serif, Georgia, serif); font-size: 28px; letter-spacing: -0.01em; }
        .lock-sub { font-size: 11px; font-family: var(--mono); text-transform: uppercase; letter-spacing: 0.2em; color: var(--ink-3); }
        .lock-card input {
          width: 100%; padding: 12px 14px; font-size: 16px;
          background: var(--bg-2); border: 1px solid var(--line); border-radius: 8px;
          color: var(--ink); text-align: center; letter-spacing: 0.3em;
          font-family: var(--mono);
          margin-top: 8px;
        }
        .lock-card input:focus { outline: none; border-color: var(--accent); }
        .lock-card .btn { width: 100%; justify-content: center; padding: 12px; font-size: 14px; }
      `}</style>
    </div>
  );
}

Object.assign(window, { PasscodeLock });
