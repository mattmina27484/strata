/* News — RSS-powered business & market news feed + YouTube video row.
   Fetched via rss2json proxy (free, no key). Sources managed in localStorage. */

(function() {
  const KEY_SOURCES = "strata.news.sources.v1";
  const KEY_VIDEOS  = "strata.news.videos.v1";

  /* --- Default sources ---------------------------------------------------- */
  // Mix: global, AU, US. RSS urls verified as publicly available.
  const DEFAULT_SOURCES = [
    // Global
    { id: "bloomberg-markets", name: "Bloomberg Markets", region: "global", category: "markets",
      rss: "https://feeds.bloomberg.com/markets/news.rss" },
    { id: "reuters-business", name: "Reuters Business", region: "global", category: "business",
      rss: "https://feeds.reuters.com/reuters/businessNews" },
    { id: "ft-markets", name: "FT Markets", region: "global", category: "markets",
      rss: "https://www.ft.com/markets?format=rss" },
    { id: "cnbc-top", name: "CNBC Top News", region: "us", category: "business",
      rss: "https://www.cnbc.com/id/100003114/device/rss/rss.html" },
    { id: "cnbc-markets", name: "CNBC Markets", region: "us", category: "markets",
      rss: "https://www.cnbc.com/id/15839069/device/rss/rss.html" },
    { id: "marketwatch", name: "MarketWatch", region: "us", category: "markets",
      rss: "https://feeds.content.dowjones.io/public/rss/mw_topstories" },
    { id: "yahoo-finance", name: "Yahoo Finance", region: "us", category: "markets",
      rss: "https://finance.yahoo.com/news/rssindex" },
    // Australia
    { id: "afr", name: "Australian Financial Review", region: "au", category: "business",
      rss: "https://www.afr.com/rss/feed" },
    { id: "abc-business", name: "ABC Business", region: "au", category: "business",
      rss: "https://www.abc.net.au/news/feed/51892/rss.xml" },
    { id: "smh-business", name: "SMH Business", region: "au", category: "business",
      rss: "https://www.smh.com.au/rss/business.xml" },
    // Crypto
    { id: "coindesk", name: "CoinDesk", region: "global", category: "crypto",
      rss: "https://feeds.feedburner.com/CoinDesk" },
    { id: "cointelegraph", name: "Cointelegraph", region: "global", category: "crypto",
      rss: "https://cointelegraph.com/rss" },
  ];

  /* --- Default YouTube channels (embed via videoseries — no API key) ------ */
  const DEFAULT_VIDEOS = [
    { id: "cnbc-tv", name: "CNBC Television", channelId: "UCrp_UI8XtuYfpiqluWLD7Lw" },
    { id: "bloomberg-tv", name: "Bloomberg Television", channelId: "UCIALMKvObZNtJ6AmdCLP7Lg" },
    { id: "yahoo-finance-tv", name: "Yahoo Finance", channelId: "UCEAZeUIeJs0IjQiqTCdVSIg" },
    { id: "kitco", name: "Kitco NEWS", channelId: "UCMzAOgPSQGvjF8diAf-wrJQ" },
  ];

  function readSources() {
    try {
      const v = JSON.parse(localStorage.getItem(KEY_SOURCES));
      if (!v || !Array.isArray(v)) return [...DEFAULT_SOURCES];
      return v;
    } catch { return [...DEFAULT_SOURCES]; }
  }
  function writeSources(list) { localStorage.setItem(KEY_SOURCES, JSON.stringify(list)); }

  function readVideoChannels() {
    try {
      const v = JSON.parse(localStorage.getItem(KEY_VIDEOS));
      if (!v || !Array.isArray(v)) return [...DEFAULT_VIDEOS];
      return v;
    } catch { return [...DEFAULT_VIDEOS]; }
  }
  function writeVideoChannels(list) { localStorage.setItem(KEY_VIDEOS, JSON.stringify(list)); }

  /* --- RSS fetcher via rss2json proxy (free, CORS-enabled) --------------- */
  async function fetchFeed(source) {
    const url = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(source.rss)}`;
    const r = await fetch(url);
    if (!r.ok) throw new Error("RSS fetch failed: " + r.status);
    const j = await r.json();
    if (j.status !== "ok" || !Array.isArray(j.items)) throw new Error(j.message || "Bad RSS response");
    return j.items.slice(0, 15).map(item => ({
      id: source.id + "::" + (item.guid || item.link),
      sourceId: source.id,
      sourceName: source.name,
      region: source.region,
      category: source.category,
      title: item.title,
      link: item.link,
      pubDate: item.pubDate,
      thumbnail: item.thumbnail || item.enclosure?.link || extractImg(item.description) || "",
      description: stripHtml(item.description || "").slice(0, 220),
      author: item.author || "",
    }));
  }

  function stripHtml(s) { return s.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim(); }
  function extractImg(html) {
    if (!html) return "";
    const m = /<img[^>]+src=["']([^"']+)["']/i.exec(html);
    return m ? m[1] : "";
  }

  async function fetchAll(sources) {
    const results = await Promise.allSettled(sources.map(fetchFeed));
    const items = [];
    const errors = [];
    results.forEach((r, i) => {
      if (r.status === "fulfilled") items.push(...r.value);
      else errors.push({ source: sources[i], error: r.reason?.message || String(r.reason) });
    });
    items.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
    return { items, errors };
  }

  function timeAgo(iso) {
    if (!iso) return "";
    const then = new Date(iso).getTime();
    if (isNaN(then)) return "";
    const secs = Math.max(1, Math.round((Date.now() - then) / 1000));
    if (secs < 60) return secs + "s";
    const mins = Math.round(secs / 60);
    if (mins < 60) return mins + "m";
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return hrs + "h";
    const days = Math.round(hrs / 24);
    if (days < 7) return days + "d";
    const wks = Math.round(days / 7);
    if (wks < 5) return wks + "w";
    const mo = Math.round(days / 30);
    return mo + "mo";
  }

  window.strataNews = {
    DEFAULT_SOURCES, DEFAULT_VIDEOS,
    readSources, writeSources, readVideoChannels, writeVideoChannels,
    fetchAll, fetchFeed, timeAgo,
  };
})();

/* ---- UI ---- */

function NewsScreen({ onAskAI }) {
  const [sources, setSources] = React.useState(() => window.strataNews.readSources());
  const [videoChannels, setVideoChannels] = React.useState(() => window.strataNews.readVideoChannels());
  const [items, setItems] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [errors, setErrors] = React.useState([]);
  const [filter, setFilter] = React.useState("all"); // all | markets | business | crypto | au | us | global
  const [showManage, setShowManage] = React.useState(false);
  const [refreshedAt, setRefreshedAt] = React.useState(null);

  async function load() {
    setLoading(true);
    setErrors([]);
    try {
      const { items: newItems, errors: errs } = await window.strataNews.fetchAll(sources.filter(s => !s.disabled));
      setItems(newItems);
      setErrors(errs);
      setRefreshedAt(new Date().toISOString());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => { load(); /* eslint-disable-next-line */ }, [sources]);

  const filtered = items.filter(it => {
    if (filter === "all") return true;
    if (filter === "markets" || filter === "business" || filter === "crypto") return it.category === filter;
    if (filter === "au" || filter === "us" || filter === "global") return it.region === filter;
    return true;
  });

  const filterTabs = [
    { id: "all", label: "All" },
    { id: "markets", label: "Markets" },
    { id: "business", label: "Business" },
    { id: "crypto", label: "Crypto" },
    { id: "au", label: "🇦🇺 Australia" },
    { id: "us", label: "🇺🇸 US" },
    { id: "global", label: "🌍 Global" },
  ];

  return (
    <div className="page">
      {/* Header */}
      <div style={{display:"flex", alignItems:"flex-end", justifyContent:"space-between", marginBottom: 18, gap: 16, flexWrap:"wrap"}}>
        <div>
          <div className="eyebrow" style={{marginBottom: 6}}>Intelligence</div>
          <h1 style={{margin: 0, fontFamily:"var(--serif)", fontStyle:"italic", fontSize: 38, fontWeight: 400, letterSpacing:"-0.01em"}}>Market news</h1>
          <div className="muted" style={{fontSize: 13, marginTop: 6}}>
            Latest business, markets, and crypto headlines from {sources.filter(s=>!s.disabled).length} sources.
            {refreshedAt && <span style={{marginLeft: 10, fontFamily:"var(--mono)", fontSize: 11, color:"var(--ink-4)"}}>Updated {window.strataNews.timeAgo(refreshedAt)} ago</span>}
          </div>
        </div>
        <div style={{display:"flex", gap: 8}}>
          <button className="btn" onClick={load} disabled={loading}>
            <span style={{display:"inline-flex", animation: loading ? "spin 0.9s linear infinite" : "none"}}><I.Refresh/></span>
            Refresh
          </button>
          <button className="btn" onClick={() => setShowManage(true)}>
            <I.Settings/> Manage sources
          </button>
        </div>
      </div>

      {/* Video row */}
      <div className="card" style={{marginBottom: 20, overflow: "hidden"}}>
        <div className="card-hd">
          <span className="eyebrow">Live & recent video</span>
          <h3 style={{margin:0}}>Finance TV</h3>
        </div>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: 1,
          background: "var(--line)",
        }}>
          {videoChannels.map(vc => (
            <div key={vc.id} style={{background:"var(--bg-1)", padding: 14}}>
              <div style={{fontSize: 12, color:"var(--ink-3)", fontFamily:"var(--mono)", letterSpacing:"0.1em", textTransform:"uppercase", marginBottom: 10}}>
                {vc.name}
              </div>
              <div style={{position:"relative", paddingBottom:"56.25%", height: 0, overflow: "hidden", borderRadius: 10, background:"var(--bg-3)"}}>
                <iframe
                  src={`https://www.youtube.com/embed/videoseries?list=UU${vc.channelId.slice(2)}&rel=0`}
                  title={vc.name}
                  style={{position:"absolute", top: 0, left: 0, width: "100%", height: "100%", border: 0, borderRadius: 10}}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  loading="lazy"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Filter tabs */}
      <div style={{display:"flex", gap: 8, marginBottom: 16, flexWrap: "wrap"}}>
        {filterTabs.map(t => (
          <button key={t.id}
            onClick={() => setFilter(t.id)}
            className="pill"
            style={{
              padding: "6px 12px",
              cursor: "pointer",
              background: filter === t.id ? "var(--accent)" : "var(--bg-2)",
              color: filter === t.id ? "var(--accent-ink)" : "var(--ink-2)",
              borderColor: filter === t.id ? "var(--accent)" : "var(--line)",
            }}
          >{t.label}</button>
        ))}
      </div>

      {/* Errors (non-blocking) */}
      {errors.length > 0 && !loading && (
        <div style={{
          padding: "10px 14px", marginBottom: 14,
          background:"var(--bg-2)", border:"1px dashed var(--line)",
          borderRadius: 10, fontSize: 12, color:"var(--ink-3)",
        }}>
          Couldn't load {errors.length} source{errors.length === 1 ? "" : "s"}: {errors.map(e => e.source.name).join(", ")}. They may be rate-limited or temporarily down.
        </div>
      )}

      {/* Feed */}
      {loading && items.length === 0 ? (
        <NewsSkeleton/>
      ) : filtered.length === 0 ? (
        <div style={{padding: "40px 0", textAlign:"center", color:"var(--ink-3)"}}>
          No articles in this filter. Try "All" or refresh.
        </div>
      ) : (
        <div style={{display:"grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14}}>
          {filtered.slice(0, 60).map(it => (
            <NewsCard key={it.id} item={it} onAskAI={onAskAI}/>
          ))}
        </div>
      )}

      {showManage && (
        <ManageSourcesModal
          sources={sources}
          videoChannels={videoChannels}
          onSourcesChange={(next) => { window.strataNews.writeSources(next); setSources(next); }}
          onVideoChannelsChange={(next) => { window.strataNews.writeVideoChannels(next); setVideoChannels(next); }}
          onClose={() => setShowManage(false)}
        />
      )}
    </div>
  );
}

function NewsCard({ item, onAskAI }) {
  const thumb = item.thumbnail;
  return (
    <div className="card" style={{display:"flex", flexDirection:"column", overflow:"hidden", transition: "border-color 120ms, transform 120ms"}}
      onMouseEnter={e => e.currentTarget.style.borderColor = "var(--line-2)"}
      onMouseLeave={e => e.currentTarget.style.borderColor = "var(--line)"}
    >
      {thumb ? (
        <a href={item.link} target="_blank" rel="noopener noreferrer" style={{display:"block"}}>
          <div style={{
            width: "100%", aspectRatio: "16/9",
            background: `var(--bg-3) center/cover no-repeat url(${JSON.stringify(thumb)})`,
            borderBottom: "1px solid var(--line)",
          }}/>
        </a>
      ) : (
        <div style={{
          height: 8,
          background: `linear-gradient(90deg, var(--cat-${item.category === "crypto" ? "crypto" : item.category === "markets" ? "stocks" : "bonds"}), transparent)`,
        }}/>
      )}
      <div style={{padding: "14px 16px", display:"flex", flexDirection:"column", gap: 10, flex: 1}}>
        <div style={{display:"flex", alignItems:"center", gap: 8, fontSize: 11, color:"var(--ink-3)", fontFamily:"var(--mono)", letterSpacing:"0.06em", textTransform:"uppercase"}}>
          <span style={{color:"var(--ink-2)"}}>{item.sourceName}</span>
          <span style={{width: 3, height: 3, borderRadius:"50%", background:"var(--ink-4)"}}/>
          <span>{window.strataNews.timeAgo(item.pubDate)} ago</span>
          {item.region === "au" && <span style={{marginLeft:"auto"}}>🇦🇺</span>}
          {item.region === "us" && <span style={{marginLeft:"auto"}}>🇺🇸</span>}
          {item.region === "global" && <span style={{marginLeft:"auto"}}>🌍</span>}
        </div>
        <a href={item.link} target="_blank" rel="noopener noreferrer"
          style={{color:"var(--ink)", textDecoration:"none", fontSize: 15, fontWeight: 500, lineHeight: 1.35}}
        >{item.title}</a>
        {item.description && (
          <div style={{fontSize: 13, color: "var(--ink-3)", lineHeight: 1.5, flex: 1}}>
            {item.description}
          </div>
        )}
        <div style={{display:"flex", gap: 8, alignItems:"center", marginTop: "auto", paddingTop: 4}}>
          <a href={item.link} target="_blank" rel="noopener noreferrer" className="btn" style={{padding:"6px 10px", fontSize: 12}}>
            Read
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M7 17L17 7"/><path d="M8 7h9v9"/>
            </svg>
          </a>
          <button className="btn" style={{padding:"6px 10px", fontSize: 12, marginLeft:"auto"}} onClick={() => onAskAI(item)}>
            <I.Bolt/> Ask Strata AI
          </button>
        </div>
      </div>
    </div>
  );
}

function NewsSkeleton() {
  return (
    <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(300px, 1fr))", gap: 14}}>
      {Array.from({length: 6}).map((_, i) => (
        <div key={i} className="card" style={{overflow:"hidden"}}>
          <div style={{aspectRatio:"16/9", background:"var(--bg-2)"}}/>
          <div style={{padding: 16}}>
            <div style={{height: 10, background:"var(--bg-3)", borderRadius: 4, marginBottom: 10, width: "40%"}}/>
            <div style={{height: 14, background:"var(--bg-3)", borderRadius: 4, marginBottom: 6}}/>
            <div style={{height: 14, background:"var(--bg-3)", borderRadius: 4, width: "80%"}}/>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---- Manage sources modal ---- */

function ManageSourcesModal({ sources, videoChannels, onSourcesChange, onVideoChannelsChange, onClose }) {
  const [tab, setTab] = React.useState("news");
  const [newSrc, setNewSrc] = React.useState({ name: "", rss: "", region: "global", category: "business" });
  const [newVid, setNewVid] = React.useState({ name: "", channelId: "" });
  const [err, setErr] = React.useState("");

  function toggleSource(id) {
    onSourcesChange(sources.map(s => s.id === id ? { ...s, disabled: !s.disabled } : s));
  }
  function removeSource(id) {
    if (!confirm("Remove this source?")) return;
    onSourcesChange(sources.filter(s => s.id !== id));
  }
  function addSource() {
    if (!newSrc.name.trim() || !newSrc.rss.trim()) { setErr("Name and RSS URL are required."); return; }
    try { new URL(newSrc.rss); } catch { setErr("Invalid URL."); return; }
    const id = "custom-" + Date.now();
    onSourcesChange([...sources, { id, ...newSrc }]);
    setNewSrc({ name: "", rss: "", region: "global", category: "business" });
    setErr("");
  }
  function resetSources() {
    if (!confirm("Reset to default sources? This removes any custom sources you've added.")) return;
    onSourcesChange([...window.strataNews.DEFAULT_SOURCES]);
  }

  function removeVideo(id) {
    if (!confirm("Remove this video channel?")) return;
    onVideoChannelsChange(videoChannels.filter(v => v.id !== id));
  }
  function addVideo() {
    if (!newVid.name.trim() || !newVid.channelId.trim()) { setErr("Name and channel ID are required."); return; }
    if (!newVid.channelId.startsWith("UC")) { setErr("Channel ID should start with 'UC' (from the channel's YouTube URL)."); return; }
    onVideoChannelsChange([...videoChannels, { id: "custom-" + Date.now(), name: newVid.name, channelId: newVid.channelId }]);
    setNewVid({ name: "", channelId: "" });
    setErr("");
  }
  function resetVideos() {
    if (!confirm("Reset video channels to defaults?")) return;
    onVideoChannelsChange([...window.strataNews.DEFAULT_VIDEOS]);
  }

  return (
    <div onClick={onClose} style={{
      position:"fixed", inset: 0, background:"color-mix(in oklab, var(--bg) 80%, transparent)",
      backdropFilter:"blur(6px)", zIndex: 100, display:"grid", placeItems:"start center", padding:"40px 16px", overflowY:"auto",
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width:"min(820px, 100%)", background:"var(--bg-1)", border:"1px solid var(--line)",
        borderRadius: 16, boxShadow:"0 30px 80px -20px rgba(0,0,0,0.5)",
      }}>
        <div style={{padding:"18px 22px", borderBottom:"1px solid var(--line)", display:"flex", alignItems:"center", gap: 10}}>
          <h3 style={{margin:0, fontSize: 14, fontWeight: 500}}>Manage sources</h3>
          <button className="btn" onClick={onClose} style={{marginLeft:"auto", padding:"6px 10px"}}>Close</button>
        </div>

        <div style={{display:"flex", gap: 4, padding: "12px 22px 0"}}>
          {[
            { id: "news", label: `News feeds (${sources.length})` },
            { id: "videos", label: `Video channels (${videoChannels.length})` },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{
                padding:"8px 14px", borderRadius: 8,
                background: tab === t.id ? "var(--bg-3)" : "transparent",
                color: tab === t.id ? "var(--ink)" : "var(--ink-3)",
                fontSize: 13,
              }}
            >{t.label}</button>
          ))}
        </div>

        <div style={{padding: "16px 22px 22px"}}>
          {err && <div style={{marginBottom: 12, padding:"8px 12px", background:"var(--down-soft)", color:"var(--down)", borderRadius: 8, fontSize: 12}}>{err}</div>}

          {tab === "news" && (
            <div>
              <div style={{marginBottom: 16, maxHeight: 360, overflowY:"auto", border:"1px solid var(--line)", borderRadius: 10}}>
                {sources.map(s => (
                  <div key={s.id} style={{
                    padding:"10px 14px", borderBottom:"1px solid var(--line)",
                    display:"flex", alignItems:"center", gap: 12,
                    opacity: s.disabled ? 0.5 : 1,
                  }}>
                    <div style={{flex: 1, minWidth: 0}}>
                      <div style={{fontSize: 13, color:"var(--ink)"}}>{s.name}</div>
                      <div style={{fontSize: 11, color:"var(--ink-3)", fontFamily:"var(--mono)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis"}}>
                        {s.region} · {s.category} · {s.rss}
                      </div>
                    </div>
                    <label style={{display:"flex", alignItems:"center", gap: 6, fontSize: 11, color:"var(--ink-3)", cursor:"pointer"}}>
                      <input type="checkbox" checked={!s.disabled} onChange={() => toggleSource(s.id)}/>
                      On
                    </label>
                    <button onClick={() => removeSource(s.id)}
                      style={{width: 28, height: 28, borderRadius: 6, color:"var(--ink-3)", display:"grid", placeItems:"center"}}
                      title="Remove"
                    >×</button>
                  </div>
                ))}
              </div>

              <h4 style={{margin:"0 0 10px", fontSize: 12, color:"var(--ink-3)", fontWeight: 500, textTransform:"uppercase", letterSpacing:"0.08em"}}>Add a source</h4>
              <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap: 10}}>
                <div className="field"><label>Name</label>
                  <input value={newSrc.name} onChange={e => setNewSrc({...newSrc, name: e.target.value})} placeholder="e.g. The Economist" />
                </div>
                <div className="field"><label>RSS URL</label>
                  <input value={newSrc.rss} onChange={e => setNewSrc({...newSrc, rss: e.target.value})} placeholder="https://..." />
                </div>
                <div className="field"><label>Region</label>
                  <select value={newSrc.region} onChange={e => setNewSrc({...newSrc, region: e.target.value})}>
                    <option value="global">Global</option>
                    <option value="au">Australia</option>
                    <option value="us">US</option>
                  </select>
                </div>
                <div className="field"><label>Category</label>
                  <select value={newSrc.category} onChange={e => setNewSrc({...newSrc, category: e.target.value})}>
                    <option value="business">Business</option>
                    <option value="markets">Markets</option>
                    <option value="crypto">Crypto</option>
                  </select>
                </div>
              </div>
              <div style={{display:"flex", gap: 8, marginTop: 12}}>
                <button className="btn primary" onClick={addSource}><I.Plus/> Add source</button>
                <button className="btn" onClick={resetSources} style={{marginLeft:"auto"}}>Reset to defaults</button>
              </div>
            </div>
          )}

          {tab === "videos" && (
            <div>
              <div style={{marginBottom: 16, border:"1px solid var(--line)", borderRadius: 10, maxHeight: 360, overflowY:"auto"}}>
                {videoChannels.map(v => (
                  <div key={v.id} style={{
                    padding:"10px 14px", borderBottom:"1px solid var(--line)",
                    display:"flex", alignItems:"center", gap: 12,
                  }}>
                    <div style={{flex: 1, minWidth: 0}}>
                      <div style={{fontSize: 13, color:"var(--ink)"}}>{v.name}</div>
                      <div style={{fontSize: 11, color:"var(--ink-3)", fontFamily:"var(--mono)"}}>{v.channelId}</div>
                    </div>
                    <button onClick={() => removeVideo(v.id)}
                      style={{width: 28, height: 28, borderRadius: 6, color:"var(--ink-3)"}}
                      title="Remove"
                    >×</button>
                  </div>
                ))}
              </div>

              <h4 style={{margin:"0 0 10px", fontSize: 12, color:"var(--ink-3)", fontWeight: 500, textTransform:"uppercase", letterSpacing:"0.08em"}}>Add a video channel</h4>
              <div style={{fontSize: 12, color:"var(--ink-3)", marginBottom: 10}}>
                Find the channel on YouTube, click the channel → "Share channel" → copy the ID (starts with <code style={{fontFamily:"var(--mono)"}}>UC...</code>).
              </div>
              <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap: 10}}>
                <div className="field"><label>Name</label>
                  <input value={newVid.name} onChange={e => setNewVid({...newVid, name: e.target.value})} placeholder="e.g. Reuters TV" />
                </div>
                <div className="field"><label>Channel ID</label>
                  <input value={newVid.channelId} onChange={e => setNewVid({...newVid, channelId: e.target.value})} placeholder="UC..." />
                </div>
              </div>
              <div style={{display:"flex", gap: 8, marginTop: 12}}>
                <button className="btn primary" onClick={addVideo}><I.Plus/> Add channel</button>
                <button className="btn" onClick={resetVideos} style={{marginLeft:"auto"}}>Reset to defaults</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

window.NewsScreen = NewsScreen;
console.log("[news.jsx] loaded, NewsScreen:", typeof window.NewsScreen);
