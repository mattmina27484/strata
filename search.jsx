/* Smart search for stocks & crypto — used in Add Asset flow */

function TickerSearch({ kind, onSelect }) {
  const [query, setQuery] = React.useState("");
  const [focused, setFocused] = React.useState(false);
  const [cursor, setCursor] = React.useState(0);
  const inputRef = React.useRef(null);

  const catalog = kind === "crypto" ? window.CRYPTO_CATALOG : window.STOCK_CATALOG;

  const results = React.useMemo(() => {
    if (!query) return catalog.slice(0, 8);
    const q = query.toLowerCase();
    return catalog
      .map(item => {
        const sym = item.sym.toLowerCase();
        const name = item.name.toLowerCase();
        let score = 0;
        if (sym === q) score = 100;
        else if (sym.startsWith(q)) score = 80;
        else if (sym.includes(q)) score = 60;
        else if (name.startsWith(q)) score = 50;
        else if (name.includes(q)) score = 30;
        return { ...item, score };
      })
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);
  }, [query, catalog]);

  React.useEffect(() => { setCursor(0); }, [query]);

  const handleKey = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setCursor(c => Math.min(results.length - 1, c + 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setCursor(c => Math.max(0, c - 1)); }
    if (e.key === "Enter" && results[cursor]) { e.preventDefault(); onSelect(results[cursor]); setQuery(""); inputRef.current?.blur(); }
    if (e.key === "Escape") { inputRef.current?.blur(); }
  };

  return (
    <div style={{position: "relative"}}>
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        background: "var(--bg-2)",
        border: `1px solid ${focused ? "var(--accent)" : "var(--line)"}`,
        borderRadius: 12,
        padding: "12px 14px",
        transition: "border-color .15s",
      }}>
        <I.Search/>
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 180)}
          onKeyDown={handleKey}
          placeholder={kind === "crypto" ? "Search Bitcoin, ETH, Solana..." : "Search by ticker or company name — e.g. AAPL, Commonwealth Bank"}
          style={{background: "transparent", border: 0, outline: "none", flex: 1, color: "var(--ink)", fontSize: 14}}
        />
        {query && <button onClick={() => setQuery("")} style={{color:"var(--ink-4)", fontSize:12, fontFamily:"var(--mono)"}}>clear</button>}
        <span className="eyebrow">{kind === "crypto" ? "coingecko" : "ASX · NASDAQ · NYSE"}</span>
      </div>

      {focused && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0,
          background: "var(--bg-1)",
          border: "1px solid var(--line-2)",
          borderRadius: 12,
          overflow: "hidden",
          zIndex: 20,
          boxShadow: "var(--shadow-2)",
          maxHeight: 400, overflowY: "auto",
        }}>
          <div style={{padding: "8px 14px", borderBottom: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center"}}>
            <span className="eyebrow">{query ? `${results.length} matches` : "Popular"}</span>
            <span className="muted tt" style={{fontSize: 10}}>↑↓ navigate · ↵ select</span>
          </div>
          {results.length === 0 && (
            <div style={{padding: "20px", textAlign: "center", color: "var(--ink-3)", fontSize: 13}}>
              No results for "{query}"
            </div>
          )}
          {results.map((r, i) => (
            <button
              key={r.sym}
              onMouseEnter={() => setCursor(i)}
              onMouseDown={(e) => { e.preventDefault(); onSelect(r); setQuery(""); }}
              style={{
                width: "100%", textAlign: "left",
                padding: "10px 14px",
                display: "grid",
                gridTemplateColumns: "32px 1fr auto auto",
                gap: 12,
                alignItems: "center",
                background: cursor === i ? "var(--bg-2)" : "transparent",
                borderBottom: i === results.length - 1 ? "0" : "1px solid var(--line)",
              }}>
              <div className="sym-sq">{r.sym.split(".")[0].slice(0, 4)}</div>
              <div>
                <div style={{fontSize: 14, color: "var(--ink)"}}>{r.name}</div>
                <div className="muted" style={{fontSize: 11, fontFamily: "var(--mono)", marginTop: 2}}>
                  {r.sym} {kind !== "crypto" && `· ${r.exchange}`} {kind === "crypto" && r.mcap && `· Mcap ${r.mcap}`}
                </div>
              </div>
              <div style={{textAlign: "right"}}>
                <div className="num" style={{fontSize: 13}}>{r.ccy === "USD" ? "$" : r.ccy === "AUD" ? "A$" : ""}{r.price < 10 ? r.price.toFixed(2) : r.price.toLocaleString()}</div>
                <div className={"delta " + (r.change24h >= 0 ? "up" : "down")} style={{fontSize: 11}}>
                  {r.change24h >= 0 ? "+" : ""}{r.change24h.toFixed(2)}%
                </div>
              </div>
              <span className="muted" style={{fontSize: 11, fontFamily: "var(--mono)"}}>↵</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

window.TickerSearch = TickerSearch;
