/* Other screens: asset list, asset detail, property detail, categories, allocation, add, settings */

function AssetRow({ a, onClick }) {
  const cat = getCategory(a.cat);
  const positive = (a.change24h || 0) >= 0;
  return (
    <div className="asset-row" onClick={onClick}>
      <div className="sym-sq">{a.sym}</div>
      <div>
        <div className="name">{a.name}</div>
        <div className="sub">
          <span style={{color: cat.color}}>●</span> {cat.name} · {a.sub}
        </div>
      </div>
      <div className="col-hide">
        {a.price && <div className="val"><span className="muted" style={{fontSize:11, marginRight:4}}>@</span>{formatMoney(a.price, {decimals: a.price < 10 ? 2 : 0})}</div>}
        {!a.price && <div className="muted tt" style={{textAlign:"right", fontSize:12}}>—</div>}
      </div>
      <div className="col-hide" style={{textAlign:"right"}}>
        <Delta value={a.change24h} pct />
      </div>
      <div className="val">{formatMoney(a.value)}</div>
      <Spark data={a.spark} positive={positive} width={100} height={28}/>
    </div>
  );
}

// ===== All Assets list =======================================================
function AssetsScreen({ onOpenAsset, onAdd }) {
  const [filter, setFilter] = React.useState("all");
  const [query, setQuery] = React.useState("");

  if (!window.ASSETS.length) {
    return <EmptyState
      title="No holdings yet"
      body="Once you add assets they'll appear here, sortable by category and value."
      cta="Add an asset"
      onCta={onAdd}
    />;
  }

  const filtered = window.ASSETS.filter(a => {
    if (filter !== "all" && a.cat !== filter) return false;
    if (query && !(a.name + a.sym).toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  }).sort((a,b) => Math.abs(b.value) - Math.abs(a.value));

  return (
    <div className="row-gap">
      <div style={{display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, marginBottom: 4}}>
        <div>
          <div className="eyebrow">Holdings</div>
          <div className="big-num" style={{fontSize: 36}}>{window.ASSETS.length} <span style={{color:"var(--ink-3)", fontSize:18}}>assets tracked</span></div>
        </div>
        <button className="btn primary" onClick={onAdd}><I.Plus/> Add asset</button>
      </div>

      <Card tight>
        <div style={{display:"flex", gap: 12, alignItems:"center", flexWrap:"wrap"}}>
          <div style={{display:"flex", alignItems:"center", gap:8, background:"var(--bg-2)", border:"1px solid var(--line)", borderRadius:10, padding:"8px 12px", flex: 1, minWidth: 240}}>
            <I.Search/>
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search holdings…"
              style={{background:"transparent", border:0, outline:"none", flex:1, color:"var(--ink)"}}
            />
          </div>
          <div className="range-tabs" style={{flexWrap:"wrap"}}>
            <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>ALL</button>
            {window.CATEGORIES.filter(c => !c.negative).slice(0,8).map(c => (
              <button key={c.id} className={filter === c.id ? "active" : ""} onClick={() => setFilter(c.id)}>
                {c.name.split(/[\s&]/)[0].toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </Card>

      <Card tight>
        <div style={{display: "grid", gridTemplateColumns: "32px 1.6fr 1fr 1fr 1fr 100px", gap: 16, padding: "10px 20px", borderBottom: "1px solid var(--line)", fontSize: 11, fontFamily: "var(--mono)", letterSpacing: "0.1em", color: "var(--ink-4)", textTransform: "uppercase"}}>
          <span></span>
          <span>Holding</span>
          <span className="col-hide" style={{textAlign: "right"}}>Price</span>
          <span className="col-hide" style={{textAlign: "right"}}>24h</span>
          <span style={{textAlign: "right"}}>Value</span>
          <span style={{textAlign: "right"}}>30d</span>
        </div>
        {filtered.map(a => (
          <AssetRow key={a.id} a={a} onClick={() => onOpenAsset(a.id)} />
        ))}
      </Card>
    </div>
  );
}

// ===== Asset Detail ==========================================================
function AssetDetail({ assetId, onBack }) {
  const [range, setRange] = React.useState("1Y");
  const [editVal, setEditVal] = React.useState(false);
  const [newVal, setNewVal] = React.useState("");
  const a = window.ASSETS.find(x => x.id === assetId);
  if (!a) return <div>Not found</div>;
  if (a.cat === "property") return <PropertyDetail assetId={assetId} onBack={onBack}/>;

  const cat = getCategory(a.cat);
  const snaps = a.spark;
  const points = Math.max(12, snaps.length);
  const series = window.makeSeries(points, a.value * 0.85, a.value, 0.02, (a.id || "x").charCodeAt(0) + (a.id || "x").length);
  const first = series[0].v, last = series[series.length-1].v;
  const changePct = first ? ((last - first) / first) * 100 : 0;
  const changeAbs = last - first;

  async function doDelete() {
    if (!confirm(`Delete ${a.name}? This can't be undone.`)) return;
    await window.db.deleteAsset(a.id);
    onBack();
  }
  async function doUpdate() {
    const v = Number(newVal);
    if (!Number.isFinite(v)) { alert("Enter a number."); return; }
    await window.db.updateAssetValue(a.id, a.cat === "liability" ? -Math.abs(v) : v);
    setEditVal(false); setNewVal("");
  }

  return (
    <div className="row-gap">
      <div style={{display:"flex", alignItems:"center", gap:10, color:"var(--ink-3)", fontSize:13}}>
        <button className="btn" onClick={onBack} style={{padding:"6px 10px"}}>← Back</button>
        <span className="eyebrow">Holding detail</span>
        <div style={{marginLeft:"auto", display:"flex", gap:8}}>
          {!a.price && <button className="btn" onClick={() => { setEditVal(true); setNewVal(String(Math.abs(a.value))); }}>Update value</button>}
          <button className="btn" onClick={doDelete} style={{color:"var(--down)"}}>Delete</button>
        </div>
      </div>

      {editVal && (
        <Card tight>
          <div style={{padding: 14, display:"flex", gap:10, alignItems:"center"}}>
            <div className="field" style={{flex:1, margin:0}}>
              <label>New {a.cat === "liability" ? "balance owed" : "value"}</label>
              <input type="number" step="any" value={newVal} onChange={e => setNewVal(e.target.value)} autoFocus/>
            </div>
            <button className="btn" onClick={() => setEditVal(false)}>Cancel</button>
            <button className="btn primary" onClick={doUpdate}>Save snapshot</button>
          </div>
        </Card>
      )}

      <Card tight>
        <div style={{padding: 12, display:"flex", alignItems:"center", gap:16, flexWrap:"wrap"}}>
          <div className="sym-sq" style={{width:48, height:48, fontSize:14}}>{a.sym}</div>
          <div style={{flex:1, minWidth:200}}>
            <div style={{display:"flex", alignItems:"center", gap:10}}>
              <h2 style={{margin:0, fontSize:22, fontWeight:500}}>{a.name}</h2>
              <Pill icon={<span style={{width:6, height:6, background:cat.color, borderRadius:50}}/>}>{cat.name}</Pill>
              {a.cat === "stocks" && <Pill kind="up" icon={<I.Bolt/>}>Live</Pill>}
              {a.cat === "crypto" && <Pill kind="up" icon={<I.Bolt/>}>Live</Pill>}
              {a.cat === "metals" && <Pill icon={<I.Bolt/>}>Spot</Pill>}
            </div>
            <div style={{fontSize: 13, color: "var(--ink-3)", marginTop:4}}>{a.sub}</div>
          </div>
          <div style={{textAlign:"right"}}>
            <div className="big-num" style={{fontSize: 36}}>{formatMoney(a.value)}</div>
            <div style={{display:"flex", gap:10, justifyContent:"flex-end", alignItems:"center", marginTop:4}}>
              <Delta value={a.change24h} pct />
              <span className="muted" style={{fontSize:12}}>today</span>
            </div>
          </div>
        </div>
      </Card>

      <Card eyebrow="Price history" right={<RangeTabs value={range} onChange={setRange} />}>
        <div style={{display:"flex", gap: 32, marginBottom: 12, flexWrap:"wrap"}}>
          <div>
            <div className="eyebrow">{range} change</div>
            <div className="num" style={{fontSize: 20, marginTop: 4}}>{changeAbs >= 0 ? "+" : "−"}{formatMoney(Math.abs(changeAbs))}</div>
            <Delta value={changePct} pct />
          </div>
          {a.price && (
            <div>
              <div className="eyebrow">Last price</div>
              <div className="num" style={{fontSize: 20, marginTop: 4}}>{formatMoney(a.price, {decimals: a.price < 10 ? 2 : 0})}</div>
              <div className="muted" style={{fontSize:11, fontFamily:"var(--mono)"}}>
                {a.qty} {a.cat === "stocks" ? "shares" : "units"}
              </div>
            </div>
          )}
          <div>
            <div className="eyebrow">Cost basis</div>
            <div className="num" style={{fontSize: 20, marginTop: 4}}>{formatMoney(a.value * 0.72)}</div>
            <div className="muted" style={{fontSize:11, fontFamily:"var(--mono)"}}>Acquired 2022-08</div>
          </div>
          <div>
            <div className="eyebrow">Unrealised gain</div>
            <div className="num" style={{fontSize: 20, marginTop: 4, color: "var(--up)"}}>+{formatMoney(a.value * 0.28)}</div>
            <Delta value={38.89} pct />
          </div>
        </div>
        <LineChart data={series} height={300} positive={changePct >= 0}/>
      </Card>

      <div className="grid-2">
        <Card eyebrow="Allocation" title="Weighting">
          <div style={{display:"flex", alignItems:"baseline", gap:8}}>
            <div className="big-num" style={{fontSize: 42}}>{((Math.abs(a.value)/window.NET_WORTH)*100).toFixed(2)}%</div>
            <span className="muted">of total net worth</span>
          </div>
          <div style={{marginTop: 16, display:"flex", flexDirection:"column", gap: 10}}>
            <div>
              <div style={{display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:4}}>
                <span className="muted">vs. category total</span>
                <span className="num">{((Math.abs(a.value)/Math.abs(window.CATEGORY_TOTALS.find(c => c.id === a.cat).total))*100).toFixed(1)}%</span>
              </div>
              <div className="alloc-bar"><div className="seg" style={{background: cat.color, width: `${(Math.abs(a.value)/Math.abs(window.CATEGORY_TOTALS.find(c => c.id === a.cat).total))*100}%`}}/></div>
            </div>
            <div>
              <div style={{display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:4}}>
                <span className="muted">vs. total portfolio</span>
                <span className="num">{((Math.abs(a.value)/window.NET_WORTH)*100).toFixed(2)}%</span>
              </div>
              <div className="alloc-bar"><div className="seg" style={{background: "var(--accent)", width: `${(Math.abs(a.value)/window.NET_WORTH)*100}%`}}/></div>
            </div>
          </div>
        </Card>

        <Card eyebrow="Activity" title="Recent transactions">
          {[
            {d:"12 Apr 2026", t:"BUY", q:"+50 units", v: a.value * 0.08},
            {d:"03 Mar 2026", t:"DIV", q:"Dividend", v: a.value * 0.012},
            {d:"14 Jan 2026", t:"BUY", q:"+120 units", v: a.value * 0.19},
            {d:"22 Aug 2022", t:"BUY", q:"Initial", v: a.value * 0.72},
          ].map((tx, i) => (
            <div key={i} style={{display:"grid", gridTemplateColumns:"auto auto 1fr auto", gap:12, padding: "10px 0", borderBottom: "1px solid var(--line)", fontSize: 13, alignItems:"center"}}>
              <span className="tt muted" style={{fontSize:11, minWidth: 80}}>{tx.d}</span>
              <span style={{fontFamily:"var(--mono)", fontSize:10, padding:"2px 6px", background:"var(--bg-3)", borderRadius:4, color:"var(--ink-2)"}}>{tx.t}</span>
              <span className="muted">{tx.q}</span>
              <span className="num">{formatMoney(tx.v)}</span>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

// ===== Property Detail =======================================================
function PropertyDetail({ assetId, onBack }) {
  const a = window.ASSETS.find(x => x.id === assetId);
  if (!a) return <div>Not found</div>;
  const market = window.PROPERTY_MARKETS[assetId] || null;
  const meta = a.meta || {};
  const [editVal, setEditVal] = React.useState(false);
  const [newVal, setNewVal] = React.useState("");

  async function doDelete() {
    if (!confirm(`Delete ${a.name}? This can't be undone.`)) return;
    await window.db.deleteAsset(a.id); onBack();
  }
  async function doUpdate() {
    const v = Number(newVal);
    if (!Number.isFinite(v)) { alert("Enter a number."); return; }
    await window.db.updateAssetValue(a.id, v);
    setEditVal(false); setNewVal("");
  }

  return (
    <div className="row-gap">
      <div style={{display:"flex", alignItems:"center", gap:10, color:"var(--ink-3)", fontSize:13}}>
        <button className="btn" onClick={onBack} style={{padding:"6px 10px"}}>← Back</button>
        <span className="eyebrow">Property detail</span>
        <div style={{marginLeft:"auto", display:"flex", gap:8}}>
          <button className="btn" onClick={() => { setEditVal(true); setNewVal(String(a.value)); }}>Update value</button>
          <button className="btn" onClick={doDelete} style={{color:"var(--down)"}}>Delete</button>
        </div>
      </div>

      {editVal && (
        <Card tight>
          <div style={{padding: 14, display:"flex", gap:10, alignItems:"center"}}>
            <div className="field" style={{flex:1, margin:0}}>
              <label>New estimated value</label>
              <input type="number" step="any" value={newVal} onChange={e => setNewVal(e.target.value)} autoFocus/>
            </div>
            <button className="btn" onClick={() => setEditVal(false)}>Cancel</button>
            <button className="btn primary" onClick={doUpdate}>Save snapshot</button>
          </div>
        </Card>
      )}

      <Card tight>
        <div style={{padding: 18}}>
          <div style={{display:"flex", alignItems:"center", gap:8, marginBottom:12}}>
            <Pill icon={<span style={{width:6, height:6, background:"var(--cat-property)", borderRadius:50}}/>}>Real Estate</Pill>
            <Pill>Manual</Pill>
          </div>
          <h2 style={{margin: "4px 0", fontSize: 22, fontWeight: 500}}>{a.name}</h2>
          {meta.address && <div className="muted" style={{fontSize: 13}}>{meta.address}</div>}
          {(meta.beds || meta.baths || meta.type) && (
            <div style={{display:"flex", gap:16, marginTop: 16, fontSize: 13, color:"var(--ink-2)"}}>
              {meta.beds && <span style={{display:"flex", alignItems:"center", gap:6}}><I.Bed/>{meta.beds} beds</span>}
              {meta.baths && <span style={{display:"flex", alignItems:"center", gap:6}}><I.Bath/>{meta.baths} baths</span>}
              {meta.type && <span>{meta.type}</span>}
            </div>
          )}
          <div style={{marginTop: 22, paddingTop: 16, borderTop: "1px solid var(--line)"}}>
            <div className="eyebrow">Estimated value</div>
            <div className="big-num" style={{fontSize: 44, marginTop: 6}}>{formatMoney(a.value)}</div>
          </div>
        </div>
      </Card>

      {market && (
        <Card eyebrow={`${market.suburb} market`} title="Value trajectory" right={<Pill>5 year view</Pill>}>
          <LineChart data={market.history5y} height={280} positive={true}/>
        </Card>
      )}
    </div>
  );
}

// ===== Categories screen =====================================================
function CategoriesScreen({ onOpenAsset, onAdd }) {
  const [expanded, setExpanded] = React.useState(null);
  const cats = window.CATEGORY_TOTALS.filter(c => c.count > 0);
  if (!cats.length) {
    return <EmptyState title="No categories yet" body="Add assets and they'll be grouped into categories here." cta="Add an asset" onCta={onAdd}/>;
  }
  const total = cats.filter(c => !c.negative).reduce((s,c) => s + c.total, 0);

  return (
    <div className="row-gap">
      <div>
        <div className="eyebrow">Categories</div>
        <div className="big-num" style={{fontSize: 36}}>{cats.length} <span style={{color:"var(--ink-3)", fontSize:18}}>asset classes</span></div>
      </div>

      {cats.map(c => {
        const assets = window.ASSETS.filter(a => a.cat === c.id);
        const isOpen = expanded === c.id;
        return (
          <div key={c.id} className="card">
            <div style={{padding: 20, display:"grid", gridTemplateColumns: "auto 1fr auto auto auto", gap: 20, alignItems:"center", cursor:"pointer"}}
              onClick={() => setExpanded(isOpen ? null : c.id)}>
              <span style={{width: 36, height: 36, background: c.color, opacity: 0.2, borderRadius: 10, display:"grid", placeItems:"center"}}>
                <span style={{width:10, height:10, background:c.color, borderRadius:3}}></span>
              </span>
              <div>
                <div style={{fontSize:15}}>{c.name}</div>
                <div className="muted" style={{fontSize:12, marginTop:2}}>{c.count} holdings · {c.live === true ? "Live pricing" : c.live === "market" ? "Market-linked" : "Manual entry"}</div>
              </div>
              <div style={{textAlign:"right"}}>
                <div className="muted tt" style={{fontSize:10, letterSpacing:"0.12em", textTransform:"uppercase"}}>Allocation</div>
                <div className="num" style={{fontSize:14}}>{((Math.abs(c.total)/total)*100).toFixed(1)}%</div>
              </div>
              <div style={{textAlign:"right"}}>
                <div className="muted tt" style={{fontSize:10, letterSpacing:"0.12em", textTransform:"uppercase"}}>24h</div>
                <Delta value={c.change24h} pct />
              </div>
              <div style={{textAlign:"right"}}>
                <div className="num" style={{fontSize: 20}}>{formatMoney(c.total)}</div>
              </div>
            </div>
            {isOpen && (
              <div style={{borderTop: "1px solid var(--line)"}}>
                {assets.map(a => <AssetRow key={a.id} a={a} onClick={() => onOpenAsset(a.id)}/>)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ===== Allocation screen =====================================================
function AllocationScreen() {
  const [hover, setHover] = React.useState(null);
  const [analyseOpen, setAnalyseOpen] = React.useState(false);
  const cats = window.CATEGORY_TOTALS.filter(c => c.count > 0 && !c.negative).sort((a,b) => b.total - a.total);
  if (!cats.length) return <EmptyState title="Nothing to allocate yet" body="Add some assets to see how your wealth splits across categories."/>;
  const total = cats.reduce((s,c) => s + c.total, 0);
  const segs = cats.map(c => {
    const color = getComputedStyle(document.documentElement).getPropertyValue(c.color.replace("var(","").replace(")","")).trim() || c.color;
    return { id: c.id, value: c.total, color, name: c.name };
  });

  const hoverSeg = hover !== null ? cats[hover] : null;

  return (
    <div className="row-gap">
      <div style={{display:"flex", alignItems:"flex-end", justifyContent:"space-between", gap: 16, flexWrap:"wrap"}}>
        <div>
          <div className="eyebrow">Allocation</div>
          <div className="big-num" style={{fontSize: 36}}>How your wealth splits</div>
        </div>
        <button
          onClick={() => setAnalyseOpen(true)}
          style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "10px 16px", borderRadius: 10, cursor: "pointer",
            border: "1px solid transparent",
            background: "linear-gradient(135deg, var(--accent), color-mix(in oklab, var(--accent) 60%, var(--up)))",
            color: "var(--bg)",
            fontSize: 14, fontWeight: 500,
            fontFamily: "inherit",
            boxShadow: "0 4px 14px -4px color-mix(in oklab, var(--accent) 60%, transparent)",
            transition: "transform .1s ease, box-shadow .1s ease",
          }}
          onMouseDown={e => e.currentTarget.style.transform = "translateY(1px)"}
          onMouseUp={e => e.currentTarget.style.transform = ""}
          onMouseLeave={e => e.currentTarget.style.transform = ""}
        >
          <I.Bolt/>
          <span>Analyse allocation</span>
        </button>
      </div>

      {analyseOpen && <AnalysePanel onClose={() => setAnalyseOpen(false)}/>}

      <Card tight>
        <div style={{padding: 20, display:"grid", gridTemplateColumns: "360px 1fr", gap: 40, alignItems:"center"}}>
          <div style={{position: "relative", width: 320, height: 320, justifySelf:"center"}}>
            <Donut segments={segs} size={320} thickness={40} hoverIdx={hover} onHover={setHover}/>
            <div style={{position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign:"center", pointerEvents:"none"}}>
              <div>
                <div className="eyebrow">{hoverSeg ? hoverSeg.name : "Assets"}</div>
                <div className="big-num" style={{fontSize: 34, marginTop: 6}}>{formatMoney(hoverSeg ? hoverSeg.total : total, {compact: true})}</div>
                <div className="muted tt" style={{fontSize:11, marginTop:4}}>{hoverSeg ? `${((hoverSeg.total/total)*100).toFixed(1)}% of portfolio` : `${cats.length} categories`}</div>
              </div>
            </div>
          </div>
          <div>
            {cats.map((c, i) => (
              <div key={c.id}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                style={{
                  display: "grid",
                  gridTemplateColumns: "auto 1fr auto auto",
                  gap: 16,
                  padding: "12px 8px",
                  borderBottom: "1px solid var(--line)",
                  alignItems:"center",
                  background: hover === i ? "var(--bg-2)" : "transparent",
                  borderRadius: 6,
                  transition: "background .12s",
                  cursor:"default",
                }}>
                <span style={{width:10, height:10, background:c.color, borderRadius:3}}></span>
                <span style={{fontSize:14}}>{c.name}</span>
                <span className="num muted" style={{fontSize: 13}}>{((c.total/total)*100).toFixed(1)}%</span>
                <span className="num" style={{fontSize:14, minWidth:120, textAlign:"right"}}>{formatMoney(c.total)}</span>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <div className="grid-3">
        <Card eyebrow="Most concentrated" title="Largest category">
          <div className="big-num" style={{fontSize:28}}>{cats[0].name}</div>
          <div className="muted tt" style={{fontSize:12, marginTop:4}}>{((cats[0].total/total)*100).toFixed(1)}% · {formatMoney(cats[0].total)}</div>
          <div style={{marginTop: 12, fontSize: 12, color:"var(--ink-3)"}}>Consider rebalancing if this exceeds your target allocation.</div>
        </Card>
        <Card eyebrow="Smallest" title="Least represented">
          <div className="big-num" style={{fontSize:28}}>{cats[cats.length-1].name}</div>
          <div className="muted tt" style={{fontSize:12, marginTop:4}}>{((cats[cats.length-1].total/total)*100).toFixed(1)}% · {formatMoney(cats[cats.length-1].total)}</div>
          <div style={{marginTop: 12, fontSize: 12, color:"var(--ink-3)"}}>You may want to allocate more here for balance.</div>
        </Card>
        <Card eyebrow="Diversity" title="Portfolio score">
          <div className="big-num" style={{fontSize:48}}>7.2<span className="muted" style={{fontSize:18}}>/10</span></div>
          <div className="muted tt" style={{fontSize:12, marginTop:4}}>Growth-tilted, balanced</div>
          <div style={{marginTop: 12, fontSize: 12, color:"var(--ink-3)"}}>Based on category distribution and asset correlation.</div>
        </Card>
      </div>
    </div>
  );
}

// ===== History screen ========================================================
function HistoryScreen() {
  const [range, setRange] = React.useState("5Y");
  if (!window.ASSETS.length) return <EmptyState title="No history yet" body="Once you add assets, Strata records snapshots whenever values change — the chart builds up from there."/>;
  const series = window.RANGES[range];
  const first = series[0].v, last = series[series.length - 1].v;
  const change = last - first;
  const changePct = (change / first) * 100;

  return (
    <div className="row-gap">
      <div>
        <div className="eyebrow">History</div>
        <div className="big-num" style={{fontSize: 36}}>Growth over time</div>
      </div>

      <Card eyebrow={`${range} performance`} right={<RangeTabs value={range} onChange={setRange}/>}>
        <div style={{display:"flex", gap:32, marginBottom:16, flexWrap:"wrap"}}>
          <div>
            <div className="eyebrow">Net change</div>
            <div className="big-num" style={{fontSize: 34, marginTop: 6, color: change >= 0 ? "var(--up)" : "var(--down)"}}>{change >= 0 ? "+" : "−"}{formatMoney(Math.abs(change), {compact:true})}</div>
          </div>
          <div>
            <div className="eyebrow">Percent</div>
            <div className="big-num" style={{fontSize: 34, marginTop: 6, color: changePct >= 0 ? "var(--up)" : "var(--down)"}}>{formatPct(changePct)}</div>
          </div>
          <div>
            <div className="eyebrow">Started at</div>
            <div className="num" style={{fontSize: 20, marginTop: 10}}>{formatMoney(first)}</div>
          </div>
          <div>
            <div className="eyebrow">Now</div>
            <div className="num" style={{fontSize: 20, marginTop: 10}}>{formatMoney(last)}</div>
          </div>
        </div>
        <LineChart data={series} height={380} positive={changePct >= 0}/>
      </Card>

      <div className="grid-3">
        {[
          {l:"Best month", v:"+14.2%", s:"Oct 2024"},
          {l:"Worst month", v:"-6.8%", s:"Mar 2023"},
          {l:"Avg monthly", v:"+1.38%", s:"Over 5 years"},
        ].map((x, i) => (
          <Card key={i}>
            <div className="eyebrow">{x.l}</div>
            <div className="big-num" style={{fontSize: 28, marginTop: 8}}>{x.v}</div>
            <div className="muted tt" style={{fontSize:11, marginTop: 4}}>{x.s}</div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ===== Settings ==============================================================
function SettingsScreen() {
  const [state, setState] = window.__useAppState();
  const fileRef = React.useRef(null);

  function doExport() {
    const blob = window.db.exportAll();
    const stamp = new Date().toISOString().slice(0, 10);
    const file = new Blob([JSON.stringify(blob, null, 2)], {type: "application/json"});
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url; a.download = `strata-backup-${stamp}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }
  function triggerImport() { fileRef.current.click(); }
  function onFile(e) {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const blob = JSON.parse(r.result);
        window.db.importAll(blob);
        alert("Backup restored.");
      } catch (err) { alert("Couldn't read that file: " + err.message); }
    };
    r.readAsText(f);
    e.target.value = "";
  }
  function doReset() {
    if (!confirm("Delete ALL your data? This can't be undone.")) return;
    window.db.resetAll();
  }

  return (
    <div className="row-gap" style={{maxWidth: 700}}>
      <div>
        <div className="eyebrow">Settings</div>
        <div className="big-num" style={{fontSize: 36}}>Preferences</div>
      </div>

      <Card eyebrow="Display" title="Currency">
        <div className="muted" style={{fontSize: 13, marginBottom: 14}}>All amounts are shown in your chosen currency. Base currency is AUD; rates are cached.</div>
        <div className="seg" style={{maxWidth: 400}}>
          {Object.entries(window.CURRENCIES).map(([code, info]) => (
            <button key={code} className={state.currency === code ? "active" : ""} onClick={() => setState({currency: code})}>
              {info.symbol} {code}
            </button>
          ))}
        </div>
      </Card>

      <Card eyebrow="Display" title="Theme">
        <div className="seg" style={{maxWidth: 300}}>
          <button className={state.theme === "dark" ? "active" : ""} onClick={() => setState({theme: "dark"})}>Dark</button>
          <button className={state.theme === "light" ? "active" : ""} onClick={() => setState({theme: "light"})}>Light</button>
        </div>
      </Card>

      <DriveBackupCard/>

      <Card eyebrow="Your data" title="Backup & restore">
        <div className="muted" style={{fontSize: 13, marginBottom: 14}}>
          All data lives in this browser's storage. Export a JSON backup regularly so you don't lose it if you clear storage or change devices.
        </div>
        <div style={{display:"flex", gap: 10, flexWrap:"wrap"}}>
          <button className="btn primary" onClick={doExport}>Export backup</button>
          <button className="btn" onClick={triggerImport}>Import backup</button>
          <input ref={fileRef} type="file" accept="application/json" style={{display:"none"}} onChange={onFile}/>
          <button className="btn" onClick={doReset} style={{color:"var(--down)", marginLeft:"auto"}}>Reset all data</button>
        </div>
        <div style={{marginTop: 16, fontSize: 12, color: "var(--ink-4)", fontFamily: "var(--mono)"}}>
          Currently tracking {window.ASSETS.length} asset{window.ASSETS.length === 1 ? "" : "s"}.
        </div>
      </Card>

      <Card eyebrow="Live pricing" title="Market data">
        <div className="muted" style={{fontSize: 13, marginBottom: 14}}>Strata updates prices every 5 minutes while open, and any time you hit the refresh button.</div>
        <ul style={{margin:0, paddingLeft: 18, color:"var(--ink-2)", fontSize: 13, lineHeight: 1.8}}>
          <li><strong>Stocks & ETFs</strong> — Yahoo Finance (free, no key required)</li>
          <li><strong>Crypto</strong> — CoinGecko (free, no key required)</li>
          <li><strong>Cash, bonds, property, business, vehicles</strong> — Manual entry; each update saves a snapshot to your history chart</li>
        </ul>
        <div style={{marginTop: 14, fontSize: 12, color: "var(--ink-4)", fontFamily: "var(--mono)"}}>
          Last refresh: {localStorage.getItem("strata.prices.lastRefresh") ? new Date(localStorage.getItem("strata.prices.lastRefresh")).toLocaleString() : "never"}
        </div>
      </Card>
    </div>
  );
}

function DriveBackupCard() {
  const [st, setSt] = React.useState(window.drive ? window.drive.state() : {});
  const [busy, setBusy] = React.useState("");
  const [msg, setMsg] = React.useState("");
  React.useEffect(() => {
    if (!window.drive) return;
    return window.drive.onChange(setSt);
  }, []);

  async function wrap(label, fn) {
    setBusy(label); setMsg("");
    try { await fn(); setMsg(label + " ✓"); }
    catch (e) { setMsg("Failed: " + (e.message || e)); }
    finally { setBusy(""); setTimeout(() => setMsg(""), 3500); }
  }

  if (!st.hasClientId) {
    return (
      <Card eyebrow="Cloud backup" title="Google Drive sync">
        <div className="muted" style={{fontSize: 13}}>
          Drive backup isn't configured yet. Add a <code style={{fontFamily:"var(--mono)", background:"var(--bg-2)", padding:"2px 6px", borderRadius: 4}}>GOOGLE_CLIENT_ID</code> in <code style={{fontFamily:"var(--mono)", background:"var(--bg-2)", padding:"2px 6px", borderRadius:4}}>index.html</code> to enable it — see DEPLOY.md.
        </div>
      </Card>
    );
  }

  return (
    <Card eyebrow="Cloud backup" title="Google Drive sync" right={st.signedIn ? <Pill kind="up">Connected</Pill> : null}>
      <div className="muted" style={{fontSize: 13, marginBottom: 14}}>
        Your data is encrypted inside Google's private app storage — only this app can read it. Use Backup up / Restore to sync between devices.
      </div>

      {!st.signedIn ? (
        <button className="btn primary" onClick={() => wrap("Signed in", () => window.drive.signIn())}>
          <I.Google/> Sign in with Google
        </button>
      ) : (
        <div>
          <div style={{display:"flex", gap:10, flexWrap:"wrap", marginBottom: 14}}>
            <button className="btn primary" disabled={!!busy} onClick={() => wrap("Backed up", () => window.drive.upload())}>
              {busy === "Backed up" ? "Backing up…" : "Backup now"}
            </button>
            <button className="btn" disabled={!!busy} onClick={() => {
              if (!confirm("Restore will overwrite this device's data with your Drive backup. Continue?")) return;
              wrap("Restored", () => window.drive.download());
            }}>
              {busy === "Restored" ? "Restoring…" : "Restore from Drive"}
            </button>
            <button className="btn" onClick={() => window.drive.signOut()} style={{marginLeft:"auto"}}>Sign out</button>
          </div>

          <label style={{display:"flex", alignItems:"center", gap:10, fontSize:13, color:"var(--ink-2)", padding: "10px 12px", background:"var(--bg-2)", borderRadius: 8}}>
            <input type="checkbox" checked={!!st.autoSync} onChange={e => window.drive.setAutoSync(e.target.checked)}/>
            <span>Auto-backup on every change</span>
            <span className="muted tt" style={{fontSize:11, marginLeft:"auto"}}>Recommended</span>
          </label>

          <div style={{marginTop: 10, fontSize: 12, color: "var(--ink-4)", fontFamily: "var(--mono)"}}>
            Last sync: {st.lastSyncAt ? new Date(st.lastSyncAt).toLocaleString() : "never"}
          </div>
        </div>
      )}
      {msg && <div style={{marginTop: 10, fontSize: 12, color: msg.startsWith("Failed") ? "var(--down)" : "var(--up)"}}>{msg}</div>}
    </Card>
  );
}

// ===== Add asset screen ======================================================
function AddAssetScreen({ onDone }) {
  const [cat, setCat] = React.useState("cash");
  const [form, setForm] = React.useState({});
  const [tickerSel, setTickerSel] = React.useState(null);
  const catDef = window.CATEGORIES.find(c => c.id === cat);
  const set = (k, v) => setForm(f => ({...f, [k]: v}));

  async function save() {
    const base = { category: cat };
    let record;

    if (cat === "stocks" || cat === "crypto") {
      if (!tickerSel || !form.qty) { alert("Pick a ticker and enter a quantity."); return; }
      record = {
        ...base,
        sym: tickerSel.sym,
        name: tickerSel.name,
        sub: `${tickerSel.exchange || ""}${form.qty ? " • " + form.qty + (cat === "crypto" ? " " + tickerSel.sym : " sh") : ""}`,
        qty: Number(form.qty),
        cost_basis: form.avgPrice ? Number(form.avgPrice) * Number(form.qty) : null,
        live: true,
        live_price: tickerSel.price,
        change24h: tickerSel.change24h || 0,
      };
    } else if (cat === "property") {
      if (!form.name || !form.value) { alert("Enter an address and current value."); return; }
      record = {
        ...base,
        name: form.name,
        sub: form.suburb || "",
        manual_value: Number(form.value),
        meta: { address: form.name, beds: form.beds, baths: form.baths, type: form.type || "House" },
      };
    } else if (cat === "liability") {
      if (!form.name || !form.value) { alert("Enter a name and current balance."); return; }
      record = {
        ...base,
        name: form.name,
        sub: form.issuer || "",
        manual_value: -Math.abs(Number(form.value)),
      };
    } else {
      if (!form.name || !form.value) { alert("Enter a name and current value."); return; }

      const assetType = cat === "cash" ? (form.assetType || "cash") : "";

      record = {
        ...base,
        name: form.name,
        sub: form.issuer || (assetType === "term_deposit" ? "Term Deposit" : ""),
        manual_value: Number(form.value),
        ...(assetType ? { type: assetType } : {}),
        ...(form.maturityDate ? { meta: { maturityDate: form.maturityDate } } : {}),
      };
    }

    await window.db.addAsset(record);
    onDone && onDone();
  }

  const textFields = (
    <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap: 16}}>
      {cat === "cash" && (
        <>
          <div className="field">
            <label>Cash asset type</label>
            <select value={form.assetType || "cash"} onChange={e => set("assetType", e.target.value)}>
              <option value="cash">Cash / Savings</option>
              <option value="term_deposit">Term Deposit</option>
            </select>
          </div>
          <div className="field">
            <label>{(form.assetType || "cash") === "term_deposit" ? "Bank / Institution" : "Institution / Issuer"}</label>
            <input
              placeholder="Optional"
              value={form.issuer || ""}
              onChange={e => set("issuer", e.target.value)}
            />
          </div>
        </>
      )}

      <div className="field">
        <label>Name / Description</label>
        <input
          placeholder={cat === "cash" && (form.assetType || "cash") === "term_deposit" ? "e.g. NAB Bank Guarantee TD" : "e.g. ING Savings Account"}
          value={form.name||""}
          onChange={e => set("name", e.target.value)}
        />
      </div>

      <div className="field">
        <label>Current value</label>
        <input placeholder="0.00" type="number" value={form.value||""} onChange={e => set("value", e.target.value)}/>
      </div>

      {cat !== "cash" && (
        <div className="field">
          <label>Institution / Issuer</label>
          <input placeholder="Optional" value={form.issuer||""} onChange={e => set("issuer", e.target.value)}/>
        </div>
      )}

      {cat === "cash" && (form.assetType || "cash") === "term_deposit" && (
        <div className="field">
          <label>Maturity date</label>
          <input type="date" value={form.maturityDate || ""} onChange={e => set("maturityDate", e.target.value)}/>
        </div>
      )}
    </div>
  );

  return (
    <div className="row-gap" style={{maxWidth: 800}}>
      <div>
        <div className="eyebrow">New holding</div>
        <div className="big-num" style={{fontSize: 36}}>Add an asset</div>
      </div>

      <Card eyebrow="Step 1" title="Choose category">
        <div style={{display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10}}>
          {window.CATEGORIES.map(c => (
            <button key={c.id} onClick={() => { setCat(c.id); setForm({}); setTickerSel(null); }}
              style={{
                background: cat === c.id ? "var(--bg-3)" : "var(--bg-2)",
                border: `1px solid ${cat === c.id ? "var(--line-2)" : "var(--line)"}`,
                borderRadius: 10, padding: "12px 14px", textAlign:"left", cursor:"pointer",
                display:"flex", alignItems:"center", gap:10,
              }}>
              <span style={{width:10, height:10, background:c.color, borderRadius:3}}></span>
              <span style={{fontSize:13}}>{c.name}</span>
            </button>
          ))}
        </div>
      </Card>

      <Card eyebrow="Step 2" title={`Enter ${catDef.name} details`}>
        {(cat === "stocks" || cat === "crypto") && (
          <AddTickerForm kind={cat} onSelectedChange={setTickerSel} form={form} setForm={setForm}/>
        )}

        {cat === "property" && (
          <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap: 16}}>
            <div className="field" style={{gridColumn:"1/-1"}}><label>Address</label><input placeholder="Street address, Suburb, State" value={form.name||""} onChange={e => set("name", e.target.value)}/></div>
            <div className="field"><label>Property type</label>
              <select value={form.type||"House"} onChange={e => set("type", e.target.value)}>
                <option>House</option><option>Apartment</option><option>Townhouse</option><option>Land</option>
              </select>
            </div>
            <div className="field"><label>Current estimated value</label><input placeholder="0.00" type="number" value={form.value||""} onChange={e => set("value", e.target.value)}/></div>
            <div className="field"><label>Bedrooms</label><input type="number" placeholder="3" value={form.beds||""} onChange={e => set("beds", e.target.value)}/></div>
            <div className="field"><label>Bathrooms</label><input type="number" placeholder="2" value={form.baths||""} onChange={e => set("baths", e.target.value)}/></div>
          </div>
        )}

        {cat === "liability" && (
          <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap: 16}}>
            <div className="field"><label>Name</label><input placeholder="e.g. Home Mortgage" value={form.name||""} onChange={e => set("name", e.target.value)}/></div>
            <div className="field"><label>Current balance owed</label><input placeholder="0.00" type="number" value={form.value||""} onChange={e => set("value", e.target.value)}/></div>
            <div className="field"><label>Lender</label><input placeholder="Optional" value={form.issuer||""} onChange={e => set("issuer", e.target.value)}/></div>
          </div>
        )}

        {!["stocks","crypto","property","liability"].includes(cat) && textFields}

        <div style={{display:"flex", gap:10, marginTop:20, justifyContent:"flex-end"}}>
          <button className="btn" onClick={onDone}>Cancel</button>
          <button className="btn primary" onClick={save}><I.Plus/> Add to portfolio</button>
        </div>
      </Card>
    </div>
  );
}

Object.assign(window, { AssetRow, AssetsScreen, AssetDetail, PropertyDetail, CategoriesScreen, AllocationScreen, HistoryScreen, SettingsScreen, AddAssetScreen, AddTickerForm });

function AddTickerForm({ kind, onSelectedChange, form, setForm }) {
  const [selected, setSelected] = React.useState(null);
  const set = (k, v) => setForm && setForm(f => ({...f, [k]: v}));
  const qty = form?.qty || "";
  const avgPrice = form?.avgPrice || "";

  React.useEffect(() => {
    if (selected && setForm) setForm(f => ({...f, avgPrice: f.avgPrice || String(selected.price)}));
    onSelectedChange && onSelectedChange(selected);
  }, [selected]);

  const value = selected && qty ? selected.price * Number(qty) : 0;
  const costBasis = avgPrice && qty ? Number(avgPrice) * Number(qty) : 0;
  const gain = value - costBasis;

  return (
    <div style={{display:"flex", flexDirection:"column", gap: 16}}>
      <div className="field">
        <label>{kind === "crypto" ? "Search coins" : "Search ticker or company"}</label>
        <TickerSearch kind={kind} onSelect={(item) => setSelected(item)}/>
      </div>

      {selected && (
        <div style={{
          background: "var(--bg-2)",
          border: "1px solid var(--line)",
          borderRadius: 12,
          padding: 16,
          display: "grid",
          gridTemplateColumns: "auto 1fr auto",
          gap: 14,
          alignItems: "center",
        }}>
          <div className="sym-sq" style={{width: 44, height: 44, fontSize: 12}}>{selected.sym.split(".")[0].slice(0, 4)}</div>
          <div>
            <div style={{fontSize: 15}}>{selected.name}</div>
            <div className="muted tt" style={{fontSize: 11, marginTop: 2}}>
              {selected.sym} {kind !== "crypto" && `· ${selected.exchange}`} · Live price
            </div>
          </div>
          <div style={{textAlign:"right"}}>
            <div className="num" style={{fontSize: 18}}>{selected.ccy === "USD" ? "$" : "A$"}{selected.price < 10 ? selected.price.toFixed(2) : selected.price.toLocaleString()}</div>
            <div className={"delta " + (selected.change24h >= 0 ? "up" : "down")}>
              {selected.change24h >= 0 ? "+" : ""}{selected.change24h.toFixed(2)}%
            </div>
          </div>
        </div>
      )}

      {selected && (
        <div style={{display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap: 16}}>
          <div className="field">
            <label>Quantity ({kind === "crypto" ? "units" : "shares"})</label>
            <input type="number" step="any" value={qty} onChange={e => set("qty", e.target.value)} placeholder={kind === "crypto" ? "0.00000000" : "0"}/>
          </div>
          <div className="field">
            <label>Average buy price</label>
            <input type="number" step="any" value={avgPrice} onChange={e => set("avgPrice", e.target.value)} placeholder="0.00"/>
          </div>
          <div className="field">
            <label>Purchase date</label>
            <input type="date" value={form?.date||""} onChange={e => set("date", e.target.value)}/>
          </div>
        </div>
      )}

      {selected && qty && (
        <div style={{display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap: 12}}>
          <div style={{background:"var(--bg-2)", border:"1px solid var(--line)", borderRadius: 10, padding: 14}}>
            <div className="eyebrow">Current value</div>
            <div className="num" style={{fontSize: 20, marginTop: 6}}>{selected.ccy === "USD" ? "$" : "A$"}{value.toLocaleString(undefined, {maximumFractionDigits: 2})}</div>
          </div>
          <div style={{background:"var(--bg-2)", border:"1px solid var(--line)", borderRadius: 10, padding: 14}}>
            <div className="eyebrow">Cost basis</div>
            <div className="num" style={{fontSize: 20, marginTop: 6}}>{selected.ccy === "USD" ? "$" : "A$"}{costBasis.toLocaleString(undefined, {maximumFractionDigits: 2})}</div>
          </div>
          <div style={{background:"var(--bg-2)", border:"1px solid var(--line)", borderRadius: 10, padding: 14}}>
            <div className="eyebrow">Unrealised {gain >= 0 ? "gain" : "loss"}</div>
            <div className="num" style={{fontSize: 20, marginTop: 6, color: gain >= 0 ? "var(--up)" : "var(--down)"}}>
              {gain >= 0 ? "+" : "−"}{selected.ccy === "USD" ? "$" : "A$"}{Math.abs(gain).toLocaleString(undefined, {maximumFractionDigits: 2})}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
Object.assign(window, { AddTickerForm });
