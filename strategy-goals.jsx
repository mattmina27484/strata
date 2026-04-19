/* Goals & Strategy — turns AI allocation suggestions into an actionable plan.
   Stored in localStorage and editable in-app. */

(function() {
  const KEY = "strata.strategy.v1";

  function uid() {
    return (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(36).slice(2));
  }

  function emptyState() {
    return {
      plans: [],
      activePlanId: null,
      updatedAt: "",
    };
  }

  function read() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return emptyState();
      const parsed = JSON.parse(raw);
      return {
        plans: Array.isArray(parsed.plans) ? parsed.plans : [],
        activePlanId: parsed.activePlanId || (parsed.plans?.[0]?.id ?? null),
        updatedAt: parsed.updatedAt || "",
      };
    } catch {
      return emptyState();
    }
  }

  function write(next) {
    const payload = {
      ...next,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(KEY, JSON.stringify(payload));
    window.dispatchEvent(new Event("strata:strategy-changed"));
    return payload;
  }

  function normalisePlan(input) {
    const now = new Date().toISOString();
    const planId = input.id || uid();
    const strategies = Array.isArray(input.strategies) ? input.strategies : [];
    const targetAllocation = Array.isArray(input.target_allocation) ? input.target_allocation : [];

    return {
      id: planId,
      name: input.name || "AI strategy plan",
      summary: input.summary || "",
      source: input.source || "ai-analysis",
      createdAt: input.createdAt || now,
      updatedAt: now,
      target_allocation: targetAllocation.map((item) => ({
        id: item.id || uid(),
        category: item.category || item.name || "Other",
        percent: Number(item.percent) || 0,
        amount: Number(item.amount) || 0,
        rationale: item.rationale || "",
      })),
      strategies: strategies.map((s) => ({
        id: s.id || uid(),
        title: s.title || "Untitled strategy",
        priority: s.priority || "medium",
        status: s.status || "planned",
        why: s.why || s.detail || "",
        target_amount: Number(s.target_amount) || 0,
        target_percent: Number(s.target_percent) || 0,
        due_label: s.due_label || "",
        target_date: s.target_date || "",
        progress_amount: Number(s.progress_amount) || 0,
        notes: s.notes || "",
        assets: Array.isArray(s.assets) ? s.assets.map((a) => ({
          id: a.id || uid(),
          name: a.name || "Asset",
          ticker: a.ticker || "",
          type: a.type || "",
          allocation_percent: Number(a.allocation_percent) || 0,
          notes: a.notes || "",
        })) : [],
        actions: Array.isArray(s.actions) ? s.actions.map((a) => ({
          id: a.id || uid(),
          title: a.title || a.label || "Action",
          due_label: a.due_label || a.when || "",
          target_date: a.target_date || "",
          status: a.status || "planned",
          notes: a.notes || "",
        })) : [],
      })),
    };
  }

  function addPlan(planInput) {
    const state = read();
    const plan = normalisePlan(planInput);
    const nextPlans = [plan, ...state.plans.filter(p => p.id !== plan.id)];
    return write({
      plans: nextPlans,
      activePlanId: plan.id,
    });
  }

  function setActivePlan(planId) {
    const state = read();
    return write({ ...state, activePlanId: planId });
  }

  function updateStrategy(planId, strategyId, patch) {
    const state = read();
    const plans = state.plans.map((plan) => {
      if (plan.id !== planId) return plan;
      return {
        ...plan,
        updatedAt: new Date().toISOString(),
        strategies: plan.strategies.map((strategy) => strategy.id === strategyId ? { ...strategy, ...patch } : strategy),
      };
    });
    return write({ ...state, plans });
  }

  function updateAction(planId, strategyId, actionId, patch) {
    const state = read();
    const plans = state.plans.map((plan) => {
      if (plan.id !== planId) return plan;
      return {
        ...plan,
        updatedAt: new Date().toISOString(),
        strategies: plan.strategies.map((strategy) => {
          if (strategy.id !== strategyId) return strategy;
          return {
            ...strategy,
            actions: strategy.actions.map((action) => action.id === actionId ? { ...action, ...patch } : action),
          };
        }),
      };
    });
    return write({ ...state, plans });
  }

  function removePlan(planId) {
    const state = read();
    const plans = state.plans.filter((p) => p.id !== planId);
    return write({
      plans,
      activePlanId: plans[0]?.id || null,
    });
  }

  function getActivePlan() {
    const state = read();
    return state.plans.find((p) => p.id === state.activePlanId) || state.plans[0] || null;
  }

  window.strategyStore = {
    read,
    write,
    addPlan,
    setActivePlan,
    updateStrategy,
    updateAction,
    removePlan,
    getActivePlan,
  };
})();

function strategyCategoryId(name) {
  const normalized = String(name || "").toLowerCase().trim();
  const found = (window.CATEGORIES || []).find((c) => c.name.toLowerCase() === normalized || c.id === normalized);
  return found?.id || null;
}

function strategyColorForCategory(name) {
  const id = strategyCategoryId(name);
  const cat = id ? window.CATEGORIES.find((c) => c.id === id) : null;
  return cat ? cat.color : "var(--accent)";
}

function StrategyEmptyState() {
  return (
    <div style={{
      padding: "72px 32px",
      textAlign: "center",
      border: "1px dashed var(--line)",
      borderRadius: 14,
      background: "var(--bg-1)",
    }}>
      <div className="eyebrow">No strategy plan yet</div>
      <div className="big-num" style={{fontSize: 32, marginTop: 10}}>Turn analysis into an action plan</div>
      <div className="muted" style={{fontSize: 14, marginTop: 10, maxWidth: 560, marginLeft: "auto", marginRight: "auto"}}>
        Go to Allocation, run Analyse allocation, then save the AI plan here. You’ll get a target allocation, timeline, and asset ideas in one place.
      </div>
      <button className="btn primary" style={{marginTop: 20}} onClick={() => window.__APP_NAVIGATE?.({ id: "allocation" })}>
        <I.Bolt/> Open allocation analysis
      </button>
    </div>
  );
}

function StrategyPlanSwitcher({ plans, activePlanId, onChange }) {
  if (!plans.length) return null;
  return (
    <div style={{display:"flex", gap: 8, flexWrap:"wrap"}}>
      {plans.map((plan) => (
        <button
          key={plan.id}
          className={activePlanId === plan.id ? "btn primary" : "btn"}
          onClick={() => onChange(plan.id)}
        >
          {plan.name}
        </button>
      ))}
    </div>
  );
}

function StrategyDonutCard({ title, segments, totalLabel }) {
  const [hover, setHover] = React.useState(null);
  const total = segments.reduce((sum, s) => sum + Math.abs(s.value), 0);
  const active = hover != null ? segments[hover] : null;

  return (
    <Card title={title} tight>
      <div style={{display:"grid", gridTemplateColumns:"280px 1fr", gap: 22, alignItems:"center"}}>
        <div style={{position:"relative", width: 240, height: 240, justifySelf:"center"}}>
          <Donut segments={segments} size={240} thickness={32} hoverIdx={hover} onHover={setHover} />
          <div style={{position:"absolute", inset:0, display:"grid", placeItems:"center", textAlign:"center", pointerEvents:"none"}}>
            <div>
              <div className="eyebrow">{active ? active.name : totalLabel}</div>
              <div className="big-num" style={{fontSize: 28, marginTop: 6}}>
                {active ? `${active.pct.toFixed(1)}%` : formatMoney(total)}
              </div>
              <div className="muted tt" style={{fontSize:11, marginTop:4}}>
                {active ? formatMoney(active.value) : `${segments.length} categories`}
              </div>
            </div>
          </div>
        </div>
        <div>
          {segments.map((seg, i) => (
            <div key={seg.id}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              style={{
                display: "grid",
                gridTemplateColumns: "auto 1fr auto auto",
                gap: 16,
                padding: "10px 8px",
                borderBottom: "1px solid var(--line)",
                alignItems:"center",
                background: hover === i ? "var(--bg-2)" : "transparent",
                borderRadius: 6,
              }}>
              <span style={{width:10, height:10, background:seg.color, borderRadius:3}}></span>
              <span style={{fontSize:14}}>{seg.name}</span>
              <span className="num muted" style={{fontSize: 13}}>{seg.pct.toFixed(1)}%</span>
              <span className="num" style={{fontSize:14, minWidth:110, textAlign:"right"}}>{formatMoney(seg.value)}</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

function StrategyTimeline({ plan, onActionStatus }) {
  const items = [];
  plan.strategies.forEach((strategy) => {
    strategy.actions.forEach((action) => {
      items.push({
        ...action,
        strategyId: strategy.id,
        strategyTitle: strategy.title,
      });
    });
  });

  items.sort((a, b) => {
    const ad = a.target_date ? new Date(a.target_date).getTime() : Number.MAX_SAFE_INTEGER;
    const bd = b.target_date ? new Date(b.target_date).getTime() : Number.MAX_SAFE_INTEGER;
    return ad - bd;
  });

  if (!items.length) return null;

  return (
    <Card eyebrow="Execution timeline" title="What to do, and when">
      <div style={{display:"flex", flexDirection:"column", gap: 12}}>
        {items.map((item) => (
          <div key={item.id} style={{display:"grid", gridTemplateColumns:"150px 1fr auto", gap: 14, alignItems:"center", padding:"12px 0", borderBottom:"1px solid var(--line)"}}>
            <div>
              <div className="num" style={{fontSize: 13}}>{item.target_date ? new Date(item.target_date).toLocaleDateString() : item.due_label || "Planned"}</div>
              {item.due_label && item.target_date && <div className="muted" style={{fontSize: 11, marginTop: 2}}>{item.due_label}</div>}
            </div>
            <div>
              <div style={{fontSize: 14, fontWeight: 500}}>{item.title}</div>
              <div className="muted" style={{fontSize: 12, marginTop: 3}}>{item.strategyTitle}</div>
              {item.notes && <div className="muted" style={{fontSize: 12, marginTop: 5}}>{item.notes}</div>}
            </div>
            <div style={{display:"flex", gap: 6, flexWrap:"wrap", justifyContent:"flex-end"}}>
              {[
                ["planned", "Planned"],
                ["in_progress", "Started"],
                ["done", "Done"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  className={item.status === value ? "btn primary" : "btn"}
                  onClick={() => onActionStatus(item.strategyId, item.id, value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function StrategyCard({ strategy, onStatus, onProgress }) {
  const target = Math.max(0, Number(strategy.target_amount) || 0);
  const progress = Math.max(0, Number(strategy.progress_amount) || 0);
  const pct = target > 0 ? Math.min(100, (progress / target) * 100) : (strategy.status === "done" ? 100 : 0);
  const tone = strategy.priority === "high" ? "var(--down)" : strategy.priority === "low" ? "var(--ink-3)" : "var(--accent)";

  return (
    <Card tight>
      <div style={{display:"flex", gap: 14, alignItems:"flex-start", justifyContent:"space-between", flexWrap:"wrap"}}>
        <div style={{flex:1, minWidth: 300}}>
          <div style={{display:"flex", gap: 10, alignItems:"center", flexWrap:"wrap"}}>
            <span style={{
              fontSize: 10, fontFamily: "var(--mono)", textTransform: "uppercase",
              letterSpacing: "0.08em", padding: "3px 8px", borderRadius: 50,
              background: `color-mix(in oklab, ${tone} 16%, transparent)`, color: tone,
            }}>{strategy.priority || "medium"}</span>
            <div style={{fontSize: 16, fontWeight: 500}}>{strategy.title}</div>
          </div>
          {strategy.why && <div className="muted" style={{fontSize: 13, marginTop: 8, lineHeight: 1.55}}>{strategy.why}</div>}

          <div style={{display:"grid", gridTemplateColumns:"repeat(4, minmax(0, 1fr))", gap: 12, marginTop: 16}}>
            <div>
              <div className="eyebrow">Target amount</div>
              <div className="num" style={{fontSize: 17, marginTop: 6}}>{target ? formatMoney(target) : "—"}</div>
            </div>
            <div>
              <div className="eyebrow">Target %</div>
              <div className="num" style={{fontSize: 17, marginTop: 6}}>{strategy.target_percent ? `${strategy.target_percent.toFixed(1)}%` : "—"}</div>
            </div>
            <div>
              <div className="eyebrow">Timeline</div>
              <div className="num" style={{fontSize: 17, marginTop: 6}}>{strategy.due_label || (strategy.target_date ? new Date(strategy.target_date).toLocaleDateString() : "—")}</div>
            </div>
            <div>
              <div className="eyebrow">Status</div>
              <div className="num" style={{fontSize: 17, marginTop: 6}}>{strategy.status.replaceAll("_", " ")}</div>
            </div>
          </div>

          <div style={{marginTop: 16}}>
            <div style={{display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:6}}>
              <span className="muted">Progress</span>
              <span className="num">{pct.toFixed(0)}%</span>
            </div>
            <div className="alloc-bar"><div className="seg" style={{width: `${pct}%`, background: "var(--accent)"}}/></div>
            <div style={{display:"flex", gap: 8, alignItems:"center", marginTop: 10, flexWrap:"wrap"}}>
              <button className={strategy.status === "planned" ? "btn primary" : "btn"} onClick={() => onStatus("planned")}>Planned</button>
              <button className={strategy.status === "in_progress" ? "btn primary" : "btn"} onClick={() => onStatus("in_progress")}>In progress</button>
              <button className={strategy.status === "done" ? "btn primary" : "btn"} onClick={() => onStatus("done")}>Done</button>
              <input
                type="number"
                placeholder="Completed amount"
                defaultValue={progress || ""}
                onBlur={(e) => onProgress(Number(e.target.value) || 0)}
                style={{maxWidth: 180}}
              />
            </div>
          </div>
        </div>
      </div>

      {(strategy.assets?.length || strategy.actions?.length) ? (
        <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap: 18, marginTop: 20}}>
          <div>
            <div className="eyebrow" style={{marginBottom: 10}}>Suggested assets</div>
            <div style={{display:"flex", flexDirection:"column", gap: 8}}>
              {(strategy.assets || []).map((asset) => (
                <div key={asset.id} style={{padding:"10px 12px", background:"var(--bg-2)", border:"1px solid var(--line)", borderRadius:10}}>
                  <div style={{display:"flex", justifyContent:"space-between", gap: 12}}>
                    <div style={{fontSize: 14, fontWeight: 500}}>{asset.name}</div>
                    <div className="num" style={{fontSize: 12}}>{asset.allocation_percent ? `${asset.allocation_percent}%` : ""}</div>
                  </div>
                  <div className="muted" style={{fontSize: 12, marginTop: 4}}>
                    {[asset.ticker, asset.type].filter(Boolean).join(" · ")}
                  </div>
                  {asset.notes && <div className="muted" style={{fontSize: 12, marginTop: 6, lineHeight: 1.5}}>{asset.notes}</div>}
                </div>
              ))}
              {!strategy.assets?.length && <div className="muted" style={{fontSize: 13}}>No asset ideas attached to this strategy yet.</div>}
            </div>
          </div>
          <div>
            <div className="eyebrow" style={{marginBottom: 10}}>Action steps</div>
            <div style={{display:"flex", flexDirection:"column", gap: 8}}>
              {(strategy.actions || []).map((action) => (
                <div key={action.id} style={{padding:"10px 12px", background:"var(--bg-2)", border:"1px solid var(--line)", borderRadius:10}}>
                  <div style={{display:"flex", justifyContent:"space-between", gap: 12}}>
                    <div style={{fontSize: 14, fontWeight: 500}}>{action.title}</div>
                    <div className="muted" style={{fontSize: 12}}>{action.status.replaceAll("_", " ")}</div>
                  </div>
                  <div className="muted" style={{fontSize: 12, marginTop: 4}}>{action.due_label || (action.target_date ? new Date(action.target_date).toLocaleDateString() : "Planned")}</div>
                  {action.notes && <div className="muted" style={{fontSize: 12, marginTop: 6, lineHeight: 1.5}}>{action.notes}</div>}
                </div>
              ))}
              {!strategy.actions?.length && <div className="muted" style={{fontSize: 13}}>No action steps attached to this strategy yet.</div>}
            </div>
          </div>
        </div>
      ) : null}
    </Card>
  );
}


function inferTargetAllocationFromAnalysis(data) {
  const currentCats = (window.CATEGORY_TOTALS || []).filter(c => c.count > 0 && !c.negative);
  const total = currentCats.reduce((sum, c) => sum + c.total, 0) || 1;
  const current = {};
  currentCats.forEach(c => { current[c.id] = (c.total / total) * 100; });

  const target = {
    stocks: current.stocks || 0,
    bonds: current.bonds || 0,
    cash: current.cash || 0,
    property: current.property || 0,
    crypto: current.crypto || 0,
    retirement: current.retirement || 0,
    business: current.business || 0,
    private: current.private || 0,
    metals: current.metals || 0,
    collect: current.collect || 0,
    vehicles: current.vehicles || 0,
  };

  const suggestions = Array.isArray(data?.suggestions) ? data.suggestions : [];
  const combined = suggestions.map(s => `${s.title || ''} ${s.detail || ''}`.toLowerCase()).join(' ');

  if (/equit|stock|share/.test(combined)) target.stocks = Math.max(target.stocks, 25);
  if (/bond|fixed income/.test(combined)) target.bonds = Math.max(target.bonds, 10);
  if (/reduce cash|excess cash|cash drag|too much cash/.test(combined)) target.cash = Math.min(target.cash || 100, 20);
  if (/liquid|liquidity|emergency/.test(combined)) target.cash = Math.max(target.cash, 10);
  if (/crypto/.test(combined)) target.crypto = Math.min(Math.max(target.crypto, 2), 10);

  // fund increases primarily from cash, then private/business if still needed
  const desiredIncrease = ['stocks','bonds','cash','crypto'].reduce((sum, k) => sum + target[k], 0)
    - ['stocks','bonds','cash','crypto'].reduce((sum, k) => sum + (current[k] || 0), 0);
  if (desiredIncrease > 0) {
    let remaining = desiredIncrease;
    ['cash','private','business','property'].forEach(k => {
      if (remaining <= 0) return;
      const available = Math.max(0, target[k] || 0);
      const cut = Math.min(available, remaining);
      target[k] = Math.max(0, available - cut);
      remaining -= cut;
    });
  }

  const totalPct = Object.values(target).reduce((sum, v) => sum + v, 0) || 1;
  return Object.entries(target)
    .filter(([, pct]) => pct > 0.2)
    .map(([id, pct]) => {
      const cat = (window.CATEGORIES || []).find(c => c.id === id);
      const percent = (pct / totalPct) * 100;
      return {
        id,
        category: cat?.name || id,
        percent: Math.round(percent * 10) / 10,
        amount: Math.round((window.NET_WORTH || 0) * (percent / 100)),
        rationale: current[id] ? `Current ${Math.round(current[id] * 10) / 10}% → target ${Math.round(percent * 10) / 10}%` : `New target allocation of ${Math.round(percent * 10) / 10}%`,
      };
    })
    .sort((a, b) => b.percent - a.percent);
}

function inferAssetsForSuggestion(text) {
  const t = String(text || '').toLowerCase();
  const assets = [];
  if (/equit|stock|share/.test(t)) {
    assets.push({ name: 'Broad market equity ETF', ticker: '', type: 'Equities', allocation_percent: 60, notes: 'Core diversified exposure.' });
    assets.push({ name: 'International equity ETF', ticker: '', type: 'Equities', allocation_percent: 40, notes: 'Diversifies geography and sector exposure.' });
  }
  if (/bond|fixed income/.test(t)) {
    assets.push({ name: 'Investment-grade bond fund', ticker: '', type: 'Bonds', allocation_percent: 70, notes: 'Defensive ballast and income.' });
    assets.push({ name: 'Short-duration bond fund', ticker: '', type: 'Bonds', allocation_percent: 30, notes: 'Lower interest-rate sensitivity.' });
  }
  if (/cash|liquid|liquidity/.test(t)) {
    assets.push({ name: 'High-yield savings / cash reserve', ticker: '', type: 'Cash', allocation_percent: 100, notes: 'For near-term flexibility and buffer.' });
  }
  if (/crypto/.test(t)) {
    assets.push({ name: 'Major crypto allocation', ticker: '', type: 'Crypto', allocation_percent: 100, notes: 'Keep sizing modest relative to total portfolio.' });
  }
  return assets.slice(0, 3);
}

function inferActionsForSuggestion(s, idx) {
  const baseDate = new Date();
  const monthOffset = idx * 2;
  const date1 = new Date(baseDate); date1.setMonth(date1.getMonth() + monthOffset + 1);
  const date2 = new Date(baseDate); date2.setMonth(date2.getMonth() + monthOffset + 3);
  return [
    {
      title: 'Define target size and funding source',
      due_label: 'Weeks 1–2',
      target_date: date1.toISOString().slice(0,10),
      status: 'planned',
      notes: 'Decide how much capital to move and which current holdings will fund it.',
    },
    {
      title: s.title || 'Execute allocation shift',
      due_label: 'Months 1–3',
      target_date: date2.toISOString().slice(0,10),
      status: 'planned',
      notes: s.detail || '',
    },
  ];
}

function createStrategyPlanFromAnalysis(data) {
  const suggestions = Array.isArray(data?.suggestions) ? data.suggestions : [];
  return {
    name: 'AI strategy plan',
    summary: data?.headline || 'Generated from Allocation analysis.',
    source: 'ai-analysis',
    target_allocation: inferTargetAllocationFromAnalysis(data),
    strategies: suggestions.map((s, idx) => ({
      title: s.title || `Strategy ${idx + 1}`,
      priority: s.priority || 'medium',
      status: 'planned',
      why: s.detail || '',
      target_amount: Math.round(((window.NET_WORTH || 0) * ([0.12, 0.08, 0.05][idx] || 0.05))),
      target_percent: [12, 8, 5][idx] || 5,
      due_label: idx === 0 ? 'Next 90 days' : idx === 1 ? 'Next 6 months' : 'Next 12 months',
      progress_amount: 0,
      assets: inferAssetsForSuggestion(`${s.title || ''} ${s.detail || ''}`),
      actions: inferActionsForSuggestion(s, idx),
    })),
  };
}

window.createStrategyPlanFromAnalysis = createStrategyPlanFromAnalysis;
window.saveAnalysisToStrategyPlan = function(data) {
  const plan = createStrategyPlanFromAnalysis(data);
  window.strategyStore.addPlan(plan);
  return plan;
};

function StrategyScreen() {
  const [store, setStore] = React.useState(() => window.strategyStore.read());

  React.useEffect(() => {
    const sync = () => setStore(window.strategyStore.read());
    window.addEventListener("strata:strategy-changed", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("strata:strategy-changed", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const plan = store.plans.find((p) => p.id === store.activePlanId) || store.plans[0] || null;
  if (!plan) {
    return (
      <div className="row-gap">
        <div>
          <div className="eyebrow">Goals & strategy</div>
          <div className="big-num" style={{fontSize: 36}}>From analysis to action</div>
        </div>
        <StrategyEmptyState/>
      </div>
    );
  }

  const currentCats = window.CATEGORY_TOTALS.filter((c) => c.count > 0 && !c.negative);
  const currentTotal = currentCats.reduce((sum, c) => sum + c.total, 0);
  const currentSegments = currentCats.map((c) => ({
    id: c.id,
    name: c.name,
    value: c.total,
    pct: currentTotal > 0 ? (c.total / currentTotal) * 100 : 0,
    color: getComputedStyle(document.documentElement).getPropertyValue(c.color.replace("var(", "").replace(")", "")).trim() || c.color,
  }));

  const targetSegments = (plan.target_allocation || []).filter((x) => x.percent > 0).map((item) => ({
    id: item.id,
    name: item.category,
    value: item.amount || (window.NET_WORTH * (item.percent / 100)),
    pct: item.percent,
    color: strategyColorForCategory(item.category),
  }));

  const compareRows = targetSegments.map((target) => {
    const current = currentSegments.find((c) => c.name === target.name || c.id === strategyCategoryId(target.name));
    return {
      name: target.name,
      currentPct: current?.pct || 0,
      targetPct: target.pct,
      gapPct: target.pct - (current?.pct || 0),
      currentValue: current?.value || 0,
      targetValue: target.value,
      color: target.color,
    };
  }).sort((a, b) => Math.abs(b.gapPct) - Math.abs(a.gapPct));

  const totalTarget = targetSegments.reduce((sum, s) => sum + s.value, 0);
  const completedValue = plan.strategies.reduce((sum, s) => sum + (Number(s.progress_amount) || 0), 0);
  const targetValue = plan.strategies.reduce((sum, s) => sum + (Number(s.target_amount) || 0), 0);
  const overallPct = targetValue > 0 ? Math.min(100, (completedValue / targetValue) * 100) : 0;

  return (
    <div className="row-gap">
      <div style={{display:"flex", alignItems:"flex-end", justifyContent:"space-between", gap: 16, flexWrap:"wrap"}}>
        <div>
          <div className="eyebrow">Goals & strategy</div>
          <div className="big-num" style={{fontSize: 36}}>{plan.name}</div>
          {plan.summary && <div className="muted" style={{fontSize: 13, marginTop: 8, maxWidth: 720}}>{plan.summary}</div>}
        </div>
        <div style={{display:"flex", gap: 10, flexWrap:"wrap", alignItems:"center"}}>
          <StrategyPlanSwitcher plans={store.plans} activePlanId={plan.id} onChange={(id) => window.strategyStore.setActivePlan(id)} />
          <button className="btn" onClick={() => window.__APP_NAVIGATE?.({ id: "allocation" })}><I.Bolt/> Regenerate from allocation</button>
          <button className="btn" style={{color:"var(--down)"}} onClick={() => {
            if (confirm(`Delete strategy plan \"${plan.name}\"?`)) {
              window.strategyStore.removePlan(plan.id);
              setStore(window.strategyStore.read());
            }
          }}>Delete plan</button>
        </div>
      </div>

      <div className="grid-3">
        <Card eyebrow="Overall progress" title="Plan completion">
          <div className="big-num" style={{fontSize: 42}}>{overallPct.toFixed(0)}%</div>
          <div className="muted" style={{fontSize: 12, marginTop: 6}}>{formatMoney(completedValue)} completed of {formatMoney(targetValue || 0)}</div>
          <div style={{marginTop: 12}} className="alloc-bar"><div className="seg" style={{width: `${overallPct}%`, background: "var(--accent)"}}/></div>
        </Card>
        <Card eyebrow="Target allocation" title="Capital to reposition">
          <div className="big-num" style={{fontSize: 42}}>{formatMoney(totalTarget)}</div>
          <div className="muted" style={{fontSize: 12, marginTop: 6}}>{targetSegments.length} target buckets</div>
        </Card>
        <Card eyebrow="Strategies" title="Execution items">
          <div className="big-num" style={{fontSize: 42}}>{plan.strategies.length}</div>
          <div className="muted" style={{fontSize: 12, marginTop: 6}}>{plan.strategies.filter(s => s.status === "done").length} completed</div>
        </Card>
      </div>

      <div className="grid-2">
        <StrategyDonutCard title="Current allocation" segments={currentSegments} totalLabel="Current mix" />
        <StrategyDonutCard title="Target allocation" segments={targetSegments} totalLabel="Target mix" />
      </div>

      <Card eyebrow="Target vs current" title="Where to move capital">
        <div style={{display:"flex", flexDirection:"column", gap: 10}}>
          {compareRows.map((row) => (
            <div key={row.name} style={{display:"grid", gridTemplateColumns:"auto 1fr auto auto auto", gap: 16, alignItems:"center", padding:"10px 0", borderBottom:"1px solid var(--line)"}}>
              <span style={{width:10, height:10, background:row.color, borderRadius:3}}></span>
              <span style={{fontSize:14}}>{row.name}</span>
              <span className="muted num" style={{fontSize: 12}}>Now {row.currentPct.toFixed(1)}%</span>
              <span className="num" style={{fontSize: 12}}>Target {row.targetPct.toFixed(1)}%</span>
              <span className="num" style={{fontSize: 12, color: row.gapPct >= 0 ? "var(--accent)" : "var(--down)"}}>
                {row.gapPct >= 0 ? "+" : ""}{row.gapPct.toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      </Card>

      <StrategyTimeline
        plan={plan}
        onActionStatus={(strategyId, actionId, status) => {
          window.strategyStore.updateAction(plan.id, strategyId, actionId, { status });
          setStore(window.strategyStore.read());
        }}
      />

      <div style={{display:"flex", flexDirection:"column", gap: 14}}>
        {plan.strategies.map((strategy) => (
          <StrategyCard
            key={strategy.id}
            strategy={strategy}
            onStatus={(status) => {
              const patch = { status };
              if (status === "done" && strategy.target_amount > 0 && !strategy.progress_amount) patch.progress_amount = strategy.target_amount;
              window.strategyStore.updateStrategy(plan.id, strategy.id, patch);
              setStore(window.strategyStore.read());
            }}
            onProgress={(progress_amount) => {
              window.strategyStore.updateStrategy(plan.id, strategy.id, { progress_amount });
              setStore(window.strategyStore.read());
            }}
          />
        ))}
      </div>
    </div>
  );
}

window.StrategyScreen = StrategyScreen;
