/* Goals store — localStorage-backed, with auto-progress from portfolio. */

(function() {
  const KEY = "strata.goals.v1";
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(36).slice(2));

  function read() {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; }
    catch { return []; }
  }
  function write(list) {
    localStorage.setItem(KEY, JSON.stringify(list));
    window.dispatchEvent(new Event("strata:goals-changed"));
  }

  /* Goal shape:
     {
       id, kind, title, notes,
       target, target_date, priority,        // "high"|"med"|"low"
       category,                             // for kind=category   e.g. "stocks"
       holdings: [assetId | { sym, name }],  // for kind=holdings
       liability_id,                         // for kind=liability  (assetId of a liability asset)
       archived, completed_at,
       created_at, updated_at,
       contributions: [{ id, amount, date, note, ts }]
     }
  */

  const KINDS = {
    networth: { label: "Net worth target", blurb: "Reach an overall net worth number" },
    category: { label: "Invest in a category", blurb: "Grow a specific asset class" },
    holdings: { label: "Specific holdings", blurb: "Accumulate specific tickers / assets" },
    liability:{ label: "Pay down a liability", blurb: "Reduce or eliminate a debt" },
    emergency:{ label: "Emergency fund", blurb: "Build up a cash buffer" },
    freeform: { label: "Free-form goal", blurb: "Title + target, manual tracking" },
  };

  function list(includeArchived = false) {
    const all = read();
    return includeArchived ? all : all.filter(g => !g.archived);
  }
  function get(id) { return read().find(g => g.id === id); }

  function create(patch) {
    const now = new Date().toISOString();
    const g = {
      id: uid(),
      kind: patch.kind || "freeform",
      title: patch.title || "Untitled goal",
      notes: patch.notes || "",
      target: Number(patch.target) || 0,
      target_date: patch.target_date || "",
      priority: patch.priority || "med",
      category: patch.category || null,
      holdings: patch.holdings || [],
      liability_id: patch.liability_id || null,
      archived: false,
      completed_at: null,
      created_at: now,
      updated_at: now,
      contributions: [],
    };
    const all = read();
    all.unshift(g);
    write(all);
    return g;
  }

  function update(id, patch) {
    const all = read();
    const i = all.findIndex(g => g.id === id);
    if (i < 0) return null;
    all[i] = { ...all[i], ...patch, updated_at: new Date().toISOString() };
    write(all);
    return all[i];
  }

  function remove(id) {
    write(read().filter(g => g.id !== id));
  }

  function archive(id) { return update(id, { archived: true }); }
  function unarchive(id) { return update(id, { archived: false }); }

  function addContribution(id, { amount, note, date }) {
    const all = read();
    const i = all.findIndex(g => g.id === id);
    if (i < 0) return null;
    const c = {
      id: uid(),
      amount: Number(amount) || 0,
      note: note || "",
      date: date || new Date().toISOString().slice(0,10),
      ts: new Date().toISOString(),
    };
    all[i].contributions = [...(all[i].contributions || []), c];
    all[i].updated_at = new Date().toISOString();
    write(all);
    return c;
  }

  function removeContribution(goalId, contribId) {
    const all = read();
    const i = all.findIndex(g => g.id === goalId);
    if (i < 0) return;
    all[i].contributions = (all[i].contributions || []).filter(c => c.id !== contribId);
    all[i].updated_at = new Date().toISOString();
    write(all);
  }

  function markComplete(id) {
    return update(id, { completed_at: new Date().toISOString() });
  }

  function uncomplete(id) {
    return update(id, { completed_at: null });
  }

  /* ---- Progress calculation ---- */

  /** Returns { current, pctToTarget, autoTracked } for a goal */
  function computeProgress(g) {
    const assets = window.ASSETS || [];
    const manual = (g.contributions || []).reduce((s, c) => s + Number(c.amount || 0), 0);
    let autoTracked = false;
    let autoCurrent = 0;

    if (g.kind === "networth") {
      autoCurrent = window.NET_WORTH || 0;
      autoTracked = true;
    } else if (g.kind === "category" && g.category) {
      autoCurrent = assets.filter(a => a.cat === g.category && a.value > 0)
        .reduce((s, a) => s + a.value, 0);
      autoTracked = true;
    } else if (g.kind === "holdings" && Array.isArray(g.holdings) && g.holdings.length) {
      const ids = new Set(g.holdings.map(h => typeof h === "string" ? h : h.id).filter(Boolean));
      const syms = new Set(g.holdings.map(h => typeof h === "object" ? (h.sym || "").toUpperCase() : "").filter(Boolean));
      autoCurrent = assets
        .filter(a => ids.has(a.id) || (a.sym && syms.has(a.sym.toUpperCase())))
        .reduce((s, a) => s + a.value, 0);
      autoTracked = true;
    } else if (g.kind === "liability" && g.liability_id) {
      // Progress = how much the liability has been reduced from its starting value
      const a = assets.find(x => x.id === g.liability_id);
      const start = Number(g.start_balance || 0);
      const currentDebt = Math.abs(a?.value || 0);
      // If target is 0 (full payoff), progress = (start - currentDebt) / start
      // Otherwise target is the amount paid down
      if (start > 0) {
        autoCurrent = Math.max(0, start - currentDebt);
        autoTracked = true;
      }
    } else if (g.kind === "emergency") {
      // Auto-track cash + any asset tagged emergency=true, plus manual contribs
      autoCurrent = assets.filter(a => a.cat === "cash" && a.value > 0)
        .reduce((s, a) => s + a.value, 0);
      autoTracked = true;
    }

    const current = autoTracked ? autoCurrent + manual : manual;
    const target = Number(g.target) || 0;
    const pct = target > 0 ? Math.min(1, Math.max(0, current / target)) : 0;
    return { current, target, pct, autoTracked, manual, autoCurrent };
  }

  /** Suggest reasonable default category/holdings given what the user types */
  function parsePriorityOrMed(p) {
    if (!p) return "med";
    const s = String(p).toLowerCase();
    if (s.startsWith("h")) return "high";
    if (s.startsWith("l")) return "low";
    return "med";
  }

  window.goalsStore = {
    KINDS,
    list, get, create, update, remove,
    archive, unarchive,
    addContribution, removeContribution,
    markComplete, uncomplete,
    computeProgress,
    parsePriorityOrMed,
  };
})();

/* ================== UI ================== */

function GoalsScreen({ onOpenGoal, onAdd }) {
  const [, tick] = React.useReducer(x => x + 1, 0);
  const [showArchived, setShowArchived] = React.useState(false);
  const [celebrateGoalId, setCelebrateGoalId] = React.useState(null);
  const seenCompletions = React.useRef(new Set());

  React.useEffect(() => {
    const h = () => tick();
    window.addEventListener("strata:goals-changed", h);
    window.addEventListener("strata:data-changed", h);
    return () => {
      window.removeEventListener("strata:goals-changed", h);
      window.removeEventListener("strata:data-changed", h);
    };
  }, []);

  const goals = window.goalsStore.list(showArchived);
  const active = goals.filter(g => !g.completed_at && !g.archived);
  const completed = goals.filter(g => g.completed_at && !g.archived);
  const archived = window.goalsStore.list(true).filter(g => g.archived);

  // Detect newly-hit 100% for celebration
  React.useEffect(() => {
    for (const g of active) {
      const { pct } = window.goalsStore.computeProgress(g);
      if (pct >= 1 && !seenCompletions.current.has(g.id)) {
        seenCompletions.current.add(g.id);
        setCelebrateGoalId(g.id);
        break;
      }
    }
  }, [active.length, window.NET_WORTH, window.ASSETS?.length]);

  if (goals.length === 0) {
    return <>
      <GoalsEmpty onAdd={onAdd}/>
      {celebrateGoalId && <CelebrationModal goalId={celebrateGoalId} onClose={() => setCelebrateGoalId(null)}/>}
    </>;
  }

  return (
    <>
      <div style={{display:"flex", alignItems:"baseline", justifyContent:"space-between", marginBottom: 20, flexWrap:"wrap", gap: 12}}>
        <div>
          <h1 style={{margin: 0, fontFamily:"var(--serif)", fontStyle:"italic", fontSize: 40, fontWeight: 400, letterSpacing:"-0.02em"}}>
            Goals
          </h1>
          <div style={{color:"var(--ink-3)", fontSize: 14, marginTop: 4}}>
            {active.length} active{completed.length ? ` · ${completed.length} completed` : ""}
          </div>
        </div>
        <div style={{display:"flex", gap: 8}}>
          <button className="btn" onClick={() => setShowArchived(!showArchived)}>
            {showArchived ? "Hide archived" : "Show archived"}
          </button>
          <button className="btn primary" onClick={onAdd}><I.Plus/> New goal</button>
        </div>
      </div>

      {/* Summary strip */}
      <GoalsSummaryStrip goals={active}/>

      {/* Active goals */}
      <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(360px, 1fr))", gap: 16, marginTop: 20}}>
        {active.map(g => <GoalCard key={g.id} goal={g} onOpen={() => onOpenGoal(g.id)}/>)}
      </div>

      {/* Completed */}
      {completed.length > 0 && (
        <div style={{marginTop: 32}}>
          <div className="eyebrow" style={{marginBottom: 10}}>Completed</div>
          <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(360px, 1fr))", gap: 16}}>
            {completed.map(g => <GoalCard key={g.id} goal={g} onOpen={() => onOpenGoal(g.id)}/>)}
          </div>
        </div>
      )}

      {/* Archived */}
      {showArchived && archived.length > 0 && (
        <div style={{marginTop: 32}}>
          <div className="eyebrow" style={{marginBottom: 10}}>Archived</div>
          <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(360px, 1fr))", gap: 16, opacity: 0.55}}>
            {archived.map(g => <GoalCard key={g.id} goal={g} onOpen={() => onOpenGoal(g.id)}/>)}
          </div>
        </div>
      )}

      {celebrateGoalId && <CelebrationModal goalId={celebrateGoalId} onClose={() => setCelebrateGoalId(null)}/>}
    </>
  );
}

function GoalsSummaryStrip({ goals }) {
  if (!goals.length) return null;
  let totalTarget = 0, totalCurrent = 0;
  for (const g of goals) {
    const { current, target } = window.goalsStore.computeProgress(g);
    totalTarget += target;
    totalCurrent += Math.min(current, target || Infinity);
  }
  const onTrack = goals.filter(g => {
    const p = window.goalsStore.computeProgress(g);
    return p.pct >= 0.3;
  }).length;

  return (
    <div style={{
      display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap: 1,
      background: "var(--line)", border: "1px solid var(--line)",
      borderRadius: "var(--radius)", overflow:"hidden",
    }}>
      <div style={{background:"var(--bg-1)", padding: "18px 22px"}}>
        <div className="eyebrow" style={{marginBottom: 6}}>Active goals</div>
        <div className="num" style={{fontSize: 26, letterSpacing:"-0.02em"}}>{goals.length}</div>
      </div>
      <div style={{background:"var(--bg-1)", padding: "18px 22px"}}>
        <div className="eyebrow" style={{marginBottom: 6}}>Combined progress</div>
        <div className="num" style={{fontSize: 26, letterSpacing:"-0.02em"}}>
          {totalTarget > 0 ? ((totalCurrent / totalTarget) * 100).toFixed(0) : 0}<span style={{color:"var(--ink-3)", fontSize: 18}}>%</span>
        </div>
      </div>
      <div style={{background:"var(--bg-1)", padding: "18px 22px"}}>
        <div className="eyebrow" style={{marginBottom: 6}}>On track</div>
        <div className="num" style={{fontSize: 26, letterSpacing:"-0.02em"}}>
          {onTrack}<span style={{color:"var(--ink-3)", fontSize: 18}}> / {goals.length}</span>
        </div>
      </div>
    </div>
  );
}

function GoalCard({ goal, onOpen }) {
  const p = window.goalsStore.computeProgress(goal);
  const kindMeta = window.goalsStore.KINDS[goal.kind] || window.goalsStore.KINDS.freeform;
  const catColor = goal.category ? (window.getCategory(goal.category)?.color || "var(--accent)") : "var(--accent)";
  const done = goal.completed_at || p.pct >= 1;
  const daysLeft = goal.target_date ? Math.ceil((new Date(goal.target_date) - new Date()) / (1000*60*60*24)) : null;

  const priorityTone = goal.priority === "high" ? "var(--down)" : goal.priority === "low" ? "var(--ink-3)" : "var(--accent)";

  return (
    <div onClick={onOpen}
      style={{
        background: "var(--bg-1)",
        border: "1px solid var(--line)",
        borderRadius: "var(--radius)",
        padding: "20px 22px",
        cursor: "pointer",
        transition: "background 120ms, border-color 120ms, transform 120ms",
        position: "relative",
        overflow: "hidden",
      }}
      onMouseEnter={e => { e.currentTarget.style.background = "var(--bg-2)"; e.currentTarget.style.borderColor = "var(--line-2)"; }}
      onMouseLeave={e => { e.currentTarget.style.background = "var(--bg-1)"; e.currentTarget.style.borderColor = "var(--line)"; }}
    >
      {/* Accent bar */}
      <div style={{
        position:"absolute", left: 0, top: 0, bottom: 0, width: 3,
        background: done ? "var(--up)" : catColor,
        opacity: 0.9,
      }}/>

      <div style={{display:"flex", alignItems:"flex-start", gap: 10, marginBottom: 8}}>
        <div style={{flex: 1, minWidth: 0}}>
          <div style={{display:"flex", alignItems:"center", gap: 8, marginBottom: 4}}>
            <span style={{
              fontSize: 10, fontFamily:"var(--mono)", letterSpacing:"0.08em", textTransform:"uppercase",
              color: "var(--ink-4)",
            }}>{kindMeta.label}</span>
            {goal.priority && (
              <span style={{
                fontSize: 10, fontFamily:"var(--mono)", padding: "2px 7px", borderRadius: 99,
                background: `color-mix(in oklab, ${priorityTone} 14%, transparent)`,
                color: priorityTone, letterSpacing:"0.06em", textTransform:"uppercase",
              }}>{goal.priority}</span>
            )}
            {done && (
              <span style={{
                fontSize: 10, fontFamily:"var(--mono)", padding: "2px 7px", borderRadius: 99,
                background: "var(--up-soft)", color: "var(--up)",
                letterSpacing:"0.06em", textTransform:"uppercase",
              }}>✓ Done</span>
            )}
          </div>
          <div style={{fontSize: 17, fontWeight: 500, color:"var(--ink)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>
            {goal.title}
          </div>
        </div>
      </div>

      {/* Progress */}
      <div style={{marginTop: 14}}>
        <div style={{
          display:"flex", alignItems:"flex-end", justifyContent:"space-between", gap: 10,
          marginBottom: 10,
        }}>
          <div style={{display:"flex", alignItems:"baseline", gap: 6, minWidth: 0, flexWrap:"wrap"}}>
            <span className="num" style={{fontSize: 22, letterSpacing:"-0.02em", lineHeight: 1}}>
              {formatMoney(p.current, { compact: p.current >= 10000 })}
            </span>
            <span className="num" style={{color:"var(--ink-3)", fontSize: 13, lineHeight: 1}}>
              of {formatMoney(p.target, { compact: p.target >= 10000 })}
            </span>
          </div>
          <div style={{fontFamily:"var(--mono)", fontSize: 13, color: done ? "var(--up)" : "var(--ink-2)", lineHeight: 1}}>
            {(p.pct * 100).toFixed(0)}%
          </div>
        </div>
        <div style={{
          height: 6, borderRadius: 99,
          background: "var(--bg-3)",
          overflow: "hidden",
        }}>
          <div style={{
            height: "100%",
            width: `${p.pct * 100}%`,
            background: done ? "var(--up)" : catColor,
            transition: "width 400ms",
            borderRadius: 99,
          }}/>
        </div>
      </div>

      {/* Footer meta */}
      <div style={{
        marginTop: 14, paddingTop: 12,
        borderTop: "1px dashed var(--line)",
        display:"flex", alignItems:"center", justifyContent:"space-between",
        fontSize: 12, color:"var(--ink-3)", fontFamily:"var(--mono)",
      }}>
        <span>
          {goal.target_date ? (
            daysLeft > 0 ? `${daysLeft}d to go` :
            daysLeft === 0 ? "Due today" :
            `${Math.abs(daysLeft)}d overdue`
          ) : "No deadline"}
        </span>
        <span>
          {(goal.contributions || []).length ? `${(goal.contributions || []).length} log${(goal.contributions||[]).length === 1 ? "" : "s"}` : (p.autoTracked ? "Auto-tracked" : "Manual")}
        </span>
      </div>
    </div>
  );
}

function GoalsEmpty({ onAdd }) {
  const EXAMPLES = [
    { kind: "category", title: "Build my share portfolio", target: 500000, category: "stocks", priority: "med",
      notes: "Core ETFs + a few individual picks." },
    { kind: "networth", title: "Reach $1M net worth", target: 1000000, priority: "high",
      notes: "The big one." },
    { kind: "emergency", title: "6-month emergency fund", target: 30000, priority: "high",
      notes: "Cash only, high-yield savings." },
    { kind: "liability", title: "Pay off the mortgage", target: 400000, priority: "med",
      notes: "" },
    { kind: "category", title: "Long-term crypto position", target: 50000, category: "crypto", priority: "low",
      notes: "DCA only, never panic sell." },
    { kind: "freeform", title: "Save for a big trip", target: 15000, priority: "low",
      notes: "Japan 2027." },
  ];
  const [suggesting, setSuggesting] = React.useState(false);

  const addExample = (ex) => {
    const d = new Date(); d.setFullYear(d.getFullYear() + 3);
    window.goalsStore.create({ ...ex, target_date: d.toISOString().slice(0,10) });
  };

  const aiSuggest = async () => {
    setSuggesting(true);
    try {
      if (!window.goalsAI) throw new Error("AI not ready");
      const suggestions = await window.goalsAI.suggestGoals();
      for (const s of suggestions.slice(0, 4)) window.goalsStore.create(s);
    } catch (e) {
      alert("Couldn't suggest goals: " + (e.message || "unknown error") + "\n\nAdd one manually below, or set your API key in index.html.");
    } finally { setSuggesting(false); }
  };

  return (
    <div style={{maxWidth: 820, margin: "30px auto"}}>
      <div style={{textAlign:"center", marginBottom: 30}}>
        <div style={{
          width: 72, height: 72, borderRadius: 20, margin: "0 auto 18px",
          background: "linear-gradient(135deg, var(--accent), color-mix(in oklab, var(--accent) 55%, #9bb8ff))",
          display:"grid", placeItems:"center", color:"var(--bg)",
        }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.8" fill="currentColor"/></svg>
        </div>
        <h1 style={{margin: "0 0 8px", fontFamily:"var(--serif)", fontStyle:"italic", fontSize: 44, fontWeight: 400, letterSpacing:"-0.02em"}}>
          Set a goal worth chasing
        </h1>
        <div style={{color:"var(--ink-3)", fontSize: 15, maxWidth: 500, margin: "0 auto", lineHeight: 1.6}}>
          Track progress toward the things that matter — a bigger share portfolio, a paid-off mortgage, a number that makes you sleep easier.
        </div>
      </div>

      <div style={{display:"flex", gap: 10, justifyContent:"center", marginBottom: 28}}>
        <button className="btn primary" onClick={onAdd}><I.Plus/> Add your first goal</button>
        <button className="btn" onClick={aiSuggest} disabled={suggesting}>
          {suggesting ? "Thinking…" : <><I.Bolt/> Let Strata AI suggest some</>}
        </button>
      </div>

      <div className="eyebrow" style={{textAlign:"center", marginBottom: 12}}>Or start from an example</div>
      <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(260px, 1fr))", gap: 12}}>
        {EXAMPLES.map((ex, i) => {
          const kindMeta = window.goalsStore.KINDS[ex.kind];
          const catColor = ex.category ? (window.getCategory(ex.category)?.color || "var(--accent)") : "var(--accent)";
          return (
            <button key={i} onClick={() => addExample(ex)}
              className="suggest-card"
              style={{
                textAlign:"left", padding: "16px 18px",
                background:"var(--bg-1)", border:"1px solid var(--line)",
                borderRadius: 12, color:"var(--ink)",
                transition: "background 120ms, border-color 120ms, transform 120ms",
                position:"relative", overflow:"hidden",
              }}
            >
              <div style={{position:"absolute", left: 0, top: 0, bottom: 0, width: 2, background: catColor, opacity: 0.85}}/>
              <div style={{fontSize: 10, fontFamily:"var(--mono)", letterSpacing:"0.08em", textTransform:"uppercase", color:"var(--ink-4)", marginBottom: 4}}>
                {kindMeta.label}
              </div>
              <div style={{fontSize: 14, fontWeight: 500, marginBottom: 6}}>{ex.title}</div>
              <div style={{fontSize: 12, color:"var(--ink-3)", fontFamily:"var(--mono)"}}>
                Target {formatMoney(ex.target, { compact: true })}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

Object.assign(window, { GoalsScreen, GoalCard, GoalsEmpty, GoalsSummaryStrip });
