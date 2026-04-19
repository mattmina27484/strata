/* UI primitives: icons, formatters, pill, card, layout helpers */

const I = {
  Dashboard: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>,
  Chart:     () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="M7 14l4-4 4 4 5-6"/></svg>,
  Pie:       () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12A9 9 0 1 1 12 3"/><path d="M12 3a9 9 0 0 1 9 9h-9V3z"/></svg>,
  Layers:    () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l10 5-10 5L2 7l10-5z"/><path d="M2 12l10 5 10-5"/><path d="M2 17l10 5 10-5"/></svg>,
  Home:      () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 10.5L12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/></svg>,
  Plus:      () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>,
  Search:    () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>,
  Settings:  () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  Bell:      () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>,
  Bolt:      () => <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L3 14h7l-1 8 11-13h-7l1-7z"/></svg>,
  ArrowUp:   () => <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M6 11l6-6 6 6"/></svg>,
  ArrowDown: () => <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M6 13l6 6 6-6"/></svg>,
  ChevronR:  () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6"/></svg>,
  Circle:    () => <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="8"/></svg>,
  Bed:       () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M2 17v-6h20v6"/><path d="M2 21v-4M22 21v-4"/><path d="M7 11V8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v3"/></svg>,
  Bath:      () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12V6a2 2 0 0 1 2-2h2"/><path d="M2 12h20v4a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4v-4z"/><path d="M6 20v2M18 20v2"/></svg>,
  Refresh:   () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 3v6h-6"/></svg>,
  Google:    () => <svg width="14" height="14" viewBox="0 0 24 24"><path fill="#4285F4" d="M21.35 11.1h-9.17v2.92h5.26c-.23 1.5-1.63 4.38-5.26 4.38-3.17 0-5.75-2.62-5.75-5.85s2.58-5.85 5.75-5.85c1.8 0 3.01.77 3.7 1.43l2.52-2.43C16.82 4.13 14.73 3.25 12.18 3.25c-4.95 0-8.96 4.01-8.96 8.95s4.01 8.95 8.96 8.95c5.17 0 8.6-3.63 8.6-8.75 0-.58-.06-1.03-.14-1.3z"/></svg>,
  User:      () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/></svg>,

  Target:    () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.8" fill="currentColor" stroke="none"/></svg>,
  Check:     () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>,
  Trash:     () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>,
  Flag:      () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 21V5"/><path d="M5 5h10l-2 4 2 4H5"/></svg>,
};

// ---- Currency formatting ----------------------------------------------------
function formatMoney(aud, opts = {}) {
  const currency = (window.__APP_STATE && window.__APP_STATE.currency) || "AUD";
  const { symbol, rate } = window.CURRENCIES[currency];
  const v = aud * rate;
  const {
    decimals = 0,
    compact = false,
    showSign = false,
    hideSymbol = false,
  } = opts;

  const sign = v < 0 ? "-" : (showSign && v > 0 ? "+" : "");
  const abs = Math.abs(v);

  let str;
  if (compact) {
    if (abs >= 1_000_000) str = (abs / 1_000_000).toFixed(2) + "M";
    else if (abs >= 1_000) str = (abs / 1_000).toFixed(1) + "k";
    else str = abs.toFixed(0);
  } else {
    str = abs.toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }

  return hideSymbol ? sign + str : sign + symbol + str;
}

function formatPct(n, decimals = 2) {
  const sign = n > 0 ? "+" : (n < 0 ? "−" : "");
  return sign + Math.abs(n).toFixed(decimals) + "%";
}

// ---- Small components --------------------------------------------------------
function Pill({ kind = "neutral", children, icon }) {
  const cls = "pill" + (kind === "up" ? " up" : kind === "down" ? " down" : "");
  return (
    <span className={cls}>
      {icon && <span style={{display:"inline-flex"}}>{icon}</span>}
      {children}
    </span>
  );
}

function Delta({ value, pct = false, prefix = "" }) {
  if (value === 0 || value == null) return <span className="delta muted">—</span>;
  const up = value > 0;
  const cls = "delta " + (up ? "up" : "down");
  const formatted = pct
    ? formatPct(value)
    : (up ? "+" : "−") + formatMoney(Math.abs(value));
  return <span className={cls}>{prefix}{formatted}</span>;
}

function RangeTabs({ value, onChange, ranges = ["1D","1W","1M","3M","1Y","5Y","ALL"] }) {
  return (
    <div className="range-tabs">
      {ranges.map(r => (
        <button
          key={r}
          className={value === r ? "active" : ""}
          onClick={() => onChange(r)}
        >{r}</button>
      ))}
    </div>
  );
}

function Card({ title, eyebrow, right, children, tight = false }) {
  return (
    <div className="card">
      {(title || eyebrow || right) && (
        <div className="card-hd">
          {eyebrow && <span className="eyebrow">{eyebrow}</span>}
          {title && <h3>{title}</h3>}
          <div style={{marginLeft:"auto", display:"flex", gap:8, alignItems:"center"}}>{right}</div>
        </div>
      )}
      <div className={"card-bd" + (tight ? " tight" : "")}>
        {children}
      </div>
    </div>
  );
}

// Utility: look up a category
function getCategory(id) {
  return window.CATEGORIES.find(c => c.id === id);
}

Object.assign(window, {
  I, formatMoney, formatPct, Pill, Delta, RangeTabs, Card, getCategory,
});
