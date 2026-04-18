/* Three dashboard variants, switched via Tweaks */

function HeroStat({ kicker, value, delta }) {
  return (
    <div style={{padding: "16px 0", borderBottom: "1px dashed var(--line)"}}>
      <div className="eyebrow">{kicker}</div>
      <div className="num" style={{fontSize: 18, marginTop: 6}}>{value}</div>
      {delta !== undefined && <div style={{marginTop: 4}}>{delta}</div>}
    </div>
  );
}

// ===== Empty state ==========================================================
function EmptyState({ title, body, cta, onCta }) {
  return (
    <div style={{
      padding: "72px 32px",
      textAlign: "center",
      border: "1px dashed var(--line)",
      borderRadius: 14,
      background: "var(--bg-1)",
    }}>
      <div className="eyebrow">No data yet</div>
      <div className="big-num" style={{fontSize: 32, marginTop: 10}}>{title}</div>
      <div className="muted" style={{fontSize: 14, marginTop: 10, maxWidth: 520, margin: "10px auto 0"}}>{body}</div>
      {cta && (
        <button className="btn primary" style={{marginTop: 22}} onClick={onCta}>
          <I.Plus/> {cta}
        </button>
      )}
    </div>
  );
}

// ===== VARIANT A: Hero-first (huge number + chart) ==========================
function DashboardHero({ range, setRange, onOpenAsset, onAdd }) {
  if (!window.ASSETS.length) {
    return <EmptyState
      title="Welcome to Strata"
      body="Start by adding your first asset — a bank account, some shares, your home, or anything else you own. Your net worth and charts will build from there."
      cta="Add your first asset"
      onCta={onAdd}
    />;
  }
  const series = window.RANGES[range];
  const netWorth = window.NET_WORTH;
  const first = series[0].v;
  const last = series[series.length - 1].v;
  const change = last - first;
  const changePct = (change / first) * 100;

  const cats = window.CATEGORY_TOTALS.filter(c => Math.abs(c.total) > 0);
  const totalAbs = cats.reduce((s, c) => s + Math.abs(c.total), 0);

  // Best & worst performing assets today
  const movers = [...window.ASSETS].sort((a,b) => (b.change24h||0) - (a.change24h||0));
  const gainers = movers.slice(0, 3);
  const losers = movers.slice(-3).reverse();

  return (
    <div className="row-gap">
      <div className="hero">
        <div className="cell">
          <div className="label-row">
            <span className="eyebrow">Total Net Worth</span>
            <Pill>As of 18 Apr 2026, 14:32 AEST</Pill>
          </div>
          <div className="total">
            <span className="currency">{window.CURRENCIES[window.__APP_STATE.currency].symbol}</span>
            {formatMoney(Math.floor(netWorth), {hideSymbol: true})}
            <span className="cents">.{String(Math.round((netWorth % 1) * 100)).padStart(2, '0')}</span>
          </div>
          <div style={{display: "flex", alignItems: "center", gap: 12, marginTop: 14}}>
            <Pill kind={change >= 0 ? "up" : "down"} icon={change >= 0 ? <I.ArrowUp/> : <I.ArrowDown/>}>
              {formatPct(changePct)} · {change >= 0 ? "+" : "−"}{formatMoney(Math.abs(change))}
            </Pill>
            <span className="muted" style={{fontSize:12}}>since {range === "ALL" ? "inception" : range.toLowerCase()}</span>
          </div>

          <div style={{marginTop: 22, display: "flex", justifyContent: "space-between", alignItems: "center"}}>
            <div className="chart-legend">
              <span><span className="sw" style={{background: "var(--up)"}}></span>Net worth</span>
              <span className="muted">· updated every 60s</span>
            </div>
            <RangeTabs value={range} onChange={setRange} />
          </div>
          <div style={{marginTop: 8}}>
            <LineChart data={series} height={280} positive={change >= 0} />
          </div>
        </div>

        <div className="cell side">
          <div className="eyebrow" style={{marginBottom: 6}}>Snapshot</div>
          <HeroStat kicker="Assets" value={formatMoney(window.TOTAL_ASSETS)} delta={<span className="muted tt" style={{fontSize:12}}>{window.ASSETS.filter(a=>a.value>0).length} holdings</span>} />
          <HeroStat kicker="Liabilities" value={formatMoney(window.TOTAL_LIABILITIES)} delta={<span className="muted tt" style={{fontSize:12}}>{window.ASSETS.filter(a=>a.value<0).length} accounts</span>} />
          <HeroStat kicker="Liquid (cash + stocks)" value={formatMoney(window.ASSETS.filter(a => ["cash","stocks","crypto"].includes(a.cat)).reduce((s,a)=>s+a.value,0))} />
          <HeroStat kicker="YTD Performance" value={formatPct(8.42)} delta={<span className="delta up">+{formatMoney(373_540, {compact: true})}</span>} />
          <HeroStat kicker="Diversification score" value="7.2 / 10" delta={<span className="muted tt" style={{fontSize:12}}>Balanced, growth-tilted</span>} />
        </div>
      </div>

      {/* Categories strip */}
      <Card eyebrow="By Category" title="Allocation" right={<button className="btn"><I.ChevronR/>View all</button>}>
        <div className="alloc-bar">
          {cats.sort((a,b) => Math.abs(b.total) - Math.abs(a.total)).map(c => (
            <div key={c.id}
              className="seg"
              style={{
                background: c.color,
                width: `${(Math.abs(c.total) / totalAbs) * 100}%`,
                opacity: c.negative ? 0.5 : 1,
              }}
              title={c.name}
            />
          ))}
        </div>
        <div className="alloc-legend">
          {cats.sort((a,b) => Math.abs(b.total) - Math.abs(a.total)).map(c => (
            <div className="item" key={c.id}>
              <span className="sw" style={{background: c.color}}></span>
              <span>{c.name}{c.negative ? " (debt)" : ""}</span>
              <span className="pct">{((Math.abs(c.total)/totalAbs)*100).toFixed(1)}%</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Movers */}
      <div className="grid-2">
        <Card eyebrow="Live" title="Today's Gainers">
          {gainers.map(a => (
            <MoverRow key={a.id} a={a} onClick={() => onOpenAsset(a.id)} />
          ))}
        </Card>
        <Card eyebrow="Live" title="Today's Decliners">
          {losers.map(a => (
            <MoverRow key={a.id} a={a} onClick={() => onOpenAsset(a.id)} />
          ))}
        </Card>
      </div>
    </div>
  );
}

function MoverRow({ a, onClick }) {
  const cat = getCategory(a.cat);
  return (
    <div style={{display: "grid", gridTemplateColumns: "32px 1fr auto", gap: 12, alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--line)", cursor: "pointer"}} onClick={onClick}>
      <div className="sym-sq">{a.sym}</div>
      <div>
        <div style={{fontSize: 14}}>{a.name}</div>
        <div style={{fontSize: 11, color: "var(--ink-3)"}}>
          <span style={{color: cat.color}}>●</span> {cat.name}
        </div>
      </div>
      <div style={{textAlign:"right"}}>
        <div className="num" style={{fontSize: 14}}>{formatMoney(a.value)}</div>
        <Delta value={a.change24h} pct />
      </div>
    </div>
  );
}

// ===== VARIANT B: Category-first grid =======================================
function DashboardCategories({ range, setRange, onOpenAsset, onOpenCategory, onAdd }) {
  if (!window.ASSETS.length) {
    return <EmptyState
      title="Your portfolio is empty"
      body="Add your first holding to get started. You can add stocks, crypto, cash, property, vehicles, or anything else."
      cta="Add your first asset"
      onCta={onAdd}
    />;
  }
  const cats = window.CATEGORY_TOTALS.filter(c => c.count > 0);
  const posCats = cats.filter(c => !c.negative).sort((a,b) => b.total - a.total);
  const negCats = cats.filter(c => c.negative);
  const netWorth = window.NET_WORTH;
  const series = window.RANGES[range];
  const first = series[0].v;
  const last = series[series.length-1].v;
  const changePct = ((last-first)/first)*100;

  return (
    <div className="row-gap">
      {/* compact hero */}
      <div className="grid-2" style={{gap:16, gridTemplateColumns:"1.1fr 1fr"}}>
        <Card tight>
          <div className="eyebrow" style={{marginBottom:8}}>Net Worth</div>
          <div className="big-num" style={{fontSize: 56}}>{formatMoney(netWorth)}</div>
          <div style={{display:"flex", gap:12, alignItems:"center", marginTop:10}}>
            <Pill kind={changePct >= 0 ? "up" : "down"} icon={changePct >= 0 ? <I.ArrowUp/> : <I.ArrowDown/>}>
              {formatPct(changePct)} {range}
            </Pill>
            <RangeTabs value={range} onChange={setRange} ranges={["1W","1M","3M","1Y","5Y"]}/>
          </div>
          <div style={{marginTop: 16}}>
            <LineChart data={series} height={180} showAxis={false} positive={changePct>=0}/>
          </div>
        </Card>
        <Card tight>
          <div className="eyebrow" style={{marginBottom:8}}>Allocation</div>
          <AllocationDonutBlock cats={posCats}/>
        </Card>
      </div>

      {/* Categories — big cards */}
      <div style={{display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16}}>
        {posCats.map(c => (
          <CategoryCard key={c.id} c={c} onClick={() => onOpenCategory(c.id)} />
        ))}
      </div>

      {/* Liabilities */}
      {negCats.length > 0 && (
        <Card eyebrow="Debts & Loans" title="Liabilities">
          {window.ASSETS.filter(a => a.value < 0).map(a => (
            <AssetRow key={a.id} a={a} onClick={() => onOpenAsset(a.id)} />
          ))}
        </Card>
      )}
    </div>
  );
}

function CategoryCard({ c, onClick }) {
  const assets = window.ASSETS.filter(a => a.cat === c.id);
  const topAssets = assets.sort((a,b) => Math.abs(b.value) - Math.abs(a.value)).slice(0, 3);
  const liveDot = c.live === true ? "Live" : c.live === "market" ? "Market-linked" : "Manual";

  return (
    <div className="card" onClick={onClick} style={{cursor:"pointer"}}>
      <div style={{padding: 18, borderBottom: "1px solid var(--line)"}}>
        <div style={{display:"flex", alignItems:"center", gap:10}}>
          <span style={{width:10, height:10, background:c.color, borderRadius:3}}></span>
          <span style={{fontSize:13, color:"var(--ink-2)"}}>{c.name}</span>
          <span className="eyebrow" style={{marginLeft:"auto"}}>{liveDot}</span>
        </div>
        <div className="num" style={{fontSize:26, marginTop:10, letterSpacing:"-0.02em"}}>{formatMoney(c.total)}</div>
        <div style={{display:"flex", alignItems:"center", gap:12, marginTop:6}}>
          <Delta value={c.change24h} pct />
          <span className="muted" style={{fontSize:11, fontFamily:"var(--mono)"}}>{c.count} holdings</span>
        </div>
      </div>
      <div style={{padding: "10px 18px"}}>
        {topAssets.map(a => (
          <div key={a.id} style={{display: "grid", gridTemplateColumns: "1fr auto", padding: "6px 0", fontSize: 12}}>
            <span style={{color:"var(--ink-2)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{a.name}</span>
            <span className="num muted">{formatMoney(a.value, {compact:true})}</span>
          </div>
        ))}
        {assets.length > 3 && (
          <div style={{fontSize: 11, color: "var(--ink-4)", fontFamily:"var(--mono)", marginTop:4}}>+ {assets.length - 3} more</div>
        )}
      </div>
    </div>
  );
}

function AllocationDonutBlock({ cats }) {
  const [hover, setHover] = React.useState(null);
  const total = cats.reduce((s, c) => s + Math.abs(c.total), 0);
  const segs = cats.map(c => ({ id: c.id, value: c.total, color: getComputedStyle(document.documentElement).getPropertyValue(c.color.replace("var(","").replace(")","")).trim() || c.color, name: c.name }));

  const hoverSeg = hover !== null ? cats[hover] : null;

  return (
    <div style={{display: "flex", gap: 20, alignItems: "center"}}>
      <div style={{position: "relative", width: 180, height: 180}}>
        <Donut segments={segs} size={180} thickness={18} hoverIdx={hover} onHover={setHover}/>
        <div style={{position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign:"center", pointerEvents:"none"}}>
          <div>
            <div className="eyebrow">{hoverSeg ? hoverSeg.name : "Total"}</div>
            <div className="num" style={{fontSize: 18, marginTop: 4}}>{formatMoney(hoverSeg ? hoverSeg.total : total, {compact:true})}</div>
            {hoverSeg && <div className="muted tt" style={{fontSize:11, marginTop:2}}>{((hoverSeg.total/total)*100).toFixed(1)}%</div>}
          </div>
        </div>
      </div>
      <div style={{flex: 1, fontSize: 12}}>
        {cats.slice(0,6).map((c, i) => (
          <div key={c.id}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            style={{display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 10, padding: "5px 0", cursor:"default"}}>
            <span style={{width:8, height:8, background:c.color, borderRadius:2, alignSelf:"center"}}></span>
            <span style={{color:"var(--ink-2)"}}>{c.name}</span>
            <span className="num muted">{((c.total/cats.reduce((s,x)=>s+x.total,0))*100).toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ===== VARIANT C: Story / narrative =========================================
function DashboardStory({ range, setRange, onAdd }) {
  if (!window.ASSETS.length) {
    return <EmptyState
      title="No story to tell yet"
      body="Add some assets and Strata will generate a personalised narrative about how your wealth is growing."
      cta="Add your first asset"
      onCta={onAdd}
    />;
  }
  const series = window.RANGES[range];
  const netWorth = window.NET_WORTH;
  const ytdGain = 373_540;
  const bestPerformer = window.ASSETS.reduce((b, a) => (a.change24h || 0) > (b.change24h || 0) ? a : b, window.ASSETS[0]);
  const btc = window.ASSETS.find(a => a.id === "btc");
  const propGain = 160_000; // contrived property appreciation 1y

  const first = series[0].v;
  const last = series[series.length - 1].v;
  const changePct = ((last - first) / first) * 100;

  return (
    <div className="story-grid">
      <div className="story-card span-8">
        <div>
          <div className="eyebrow">Chapter one — Today</div>
          <h2>You're worth {formatMoney(netWorth, {compact: true})} — and the market likes you.</h2>
          <div className="kicker">Up {formatPct(changePct)} in the last {range.toLowerCase()}. That's {formatMoney(last - first)} richer than when this period began.</div>
        </div>
        <LineChart data={series} height={140} showAxis={false} positive={changePct >= 0} />
        <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8}}>
          <RangeTabs value={range} onChange={setRange} ranges={["1M","3M","1Y","5Y"]}/>
          <span className="eyebrow">chapter: portfolio overview</span>
        </div>
      </div>

      <div className="story-card span-4" style={{background: "linear-gradient(160deg, color-mix(in oklab, var(--up) 8%, var(--bg-1)), var(--bg-1))"}}>
        <div>
          <div className="eyebrow">Year to date</div>
          <h2>+{formatMoney(ytdGain, {compact: true})}</h2>
          <div className="kicker">{formatPct(8.42)} — the strongest Q1 in three years. Stocks led the charge.</div>
        </div>
        <div className="big">{formatPct(8.42)}</div>
      </div>

      <div className="story-card span-4">
        <div>
          <div className="eyebrow">Star of the day</div>
          <h2>{bestPerformer.name}</h2>
          <div className="kicker">Up {formatPct(bestPerformer.change24h)} since open — adding {formatMoney(bestPerformer.value * bestPerformer.change24h/100)} to the tally.</div>
        </div>
        <div style={{display:"flex", alignItems:"center", gap:10}}>
          <div className="sym-sq">{bestPerformer.sym}</div>
          <div className="num" style={{fontSize:18}}>{formatMoney(bestPerformer.value)}</div>
        </div>
      </div>

      <div className="story-card span-4">
        <div>
          <div className="eyebrow">Crypto beat</div>
          <h2>Bitcoin climbed {formatPct(btc.change24h)} overnight</h2>
          <div className="kicker">Your {btc.qty} BTC is now worth {formatMoney(btc.value)}. The last all-time high was in March.</div>
        </div>
        <Spark data={btc.spark} positive={true} width={280} height={40} strokeWidth={1.8}/>
      </div>

      <div className="story-card span-4" style={{background: "linear-gradient(160deg, color-mix(in oklab, var(--cat-property) 8%, var(--bg-1)), var(--bg-1))"}}>
        <div>
          <div className="eyebrow">Bricks & mortar</div>
          <h2>Paddington prices rose 6.8% this year</h2>
          <div className="kicker">That puts your primary residence at an estimated {formatMoney(2_240_000, {compact: true})} — up {formatMoney(propGain)} on 12 months ago.</div>
        </div>
      </div>

      <div className="story-card span-6">
        <div>
          <div className="eyebrow">Balance check</div>
          <h2 style={{fontSize:24}}>Your liquid ratio is healthier than average</h2>
          <div className="kicker">Cash + equities make up {Math.round(100*window.ASSETS.filter(a=>["cash","stocks","crypto"].includes(a.cat)).reduce((s,a)=>s+a.value,0)/window.NET_WORTH)}% of net worth — comfortably above the 15% benchmark for someone in your bracket.</div>
        </div>
      </div>

      <div className="story-card span-6">
        <div>
          <div className="eyebrow">Watch list</div>
          <h2 style={{fontSize:24}}>One loan is costing you {formatMoney(67_800)} a year</h2>
          <div className="kicker">At 5.89% variable, your CBA home loan is running slightly above the current market average. Refinancing could reclaim ~{formatMoney(8_400)} annually.</div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, {
  DashboardHero, DashboardCategories, DashboardStory,
  MoverRow, CategoryCard, AllocationDonutBlock, EmptyState,
});
