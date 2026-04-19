/* Goal detail view + Add/Edit form + Celebration modal. */

function GoalDetailScreen({ goalId, onBack }) {
  const [, tick] = React.useReducer(x => x + 1, 0);
  const [editing, setEditing] = React.useState(false);
  const [logging, setLogging] = React.useState(false);

  React.useEffect(() => {
    const h = () => tick();
    window.addEventListener("strata:goals-changed", h);
    window.addEventListener("strata:data-changed", h);
    return () => {
      window.removeEventListener("strata:goals-changed", h);
      window.removeEventListener("strata:data-changed", h);
    };
  }, []);

  const goal = window.goalsStore.get(goalId);
  if (!goal) {
    return (
      <div style={{textAlign:"center", padding: 60}}>
        <div style={{color:"var(--ink-3)", marginBottom: 14}}>Goal not found.</div>
        <button className="btn" onClick={onBack}>← Back to Goals</button>
      </div>
    );
  }
  const p = window.goalsStore.computeProgress(goal);
  const kindMeta = window.goalsStore.KINDS[goal.kind] || window.goalsStore.KINDS.freeform;
  const done = goal.completed_at || p.pct >= 1;
  const catColor = goal.category ? (window.getCategory(goal.category)?.color || "var(--accent)") : "var(--accent)";
  const daysLeft = goal.target_date ? Math.ceil((new Date(goal.target_date) - new Date()) / (1000*60*60*24)) : null;

  if (editing) {
    return <GoalEditScreen goalId={goalId} onDone={() => setEditing(false)} onDelete={onBack}/>;
  }

  // Trajectory chart: combine auto-tracked current (today) with manual contribution points
  const contribs = [...(goal.contributions || [])].sort((a,b) => a.date.localeCompare(b.date));
  const trajectoryPoints = buildTrajectory(goal, contribs, p);

  return (
    <div style={{maxWidth: 960, margin: "0 auto"}}>
      <button className="btn" onClick={onBack} style={{marginBottom: 20}}>← Back to Goals</button>

      {/* Header */}
      <div style={{
        background:"var(--bg-1)", border:"1px solid var(--line)",
        borderRadius:"var(--radius-lg)", overflow:"hidden", marginBottom: 18,
      }}>
        <div style={{height: 3, background: done ? "var(--up)" : catColor}}/>
        <div style={{padding: "26px 30px"}}>
          <div style={{display:"flex", alignItems:"center", gap: 10, marginBottom: 10, flexWrap:"wrap"}}>
            <span className="eyebrow">{kindMeta.label}</span>
            {goal.priority && (
              <span style={{
                fontSize: 10, fontFamily:"var(--mono)", padding:"2px 8px", borderRadius: 99,
                background: `color-mix(in oklab, ${goal.priority === "high" ? "var(--down)" : goal.priority === "low" ? "var(--ink-3)" : "var(--accent)"} 14%, transparent)`,
                color: goal.priority === "high" ? "var(--down)" : goal.priority === "low" ? "var(--ink-3)" : "var(--accent)",
                letterSpacing:"0.06em", textTransform:"uppercase",
              }}>{goal.priority} priority</span>
            )}
            {done && (
              <span style={{
                fontSize: 10, fontFamily:"var(--mono)", padding:"2px 8px", borderRadius: 99,
                background:"var(--up-soft)", color:"var(--up)",
                letterSpacing:"0.06em", textTransform:"uppercase",
              }}>✓ Complete</span>
            )}
            <div style={{marginLeft:"auto", display:"flex", gap: 8}}>
              <button className="btn" onClick={() => setEditing(true)}>Edit</button>
              <button className="btn primary" onClick={() => setLogging(true)}><I.Plus/> Log contribution</button>
            </div>
          </div>

          <h1 style={{margin:"0 0 16px", fontFamily:"var(--serif)", fontStyle:"italic", fontSize: 40, fontWeight: 400, letterSpacing:"-0.02em", lineHeight: 1.1}}>
            {goal.title}
          </h1>

          {/* Big progress */}
          <div style={{display:"flex", alignItems:"baseline", gap: 14, flexWrap:"wrap"}}>
            <div className="big-num" style={{fontSize: 56, lineHeight: 1}}>
              {formatMoney(p.current, { compact: p.current >= 100000 })}
            </div>
            <div style={{color:"var(--ink-3)", fontSize: 18}}>
              of {formatMoney(p.target, { compact: p.target >= 100000 })}
            </div>
            <div style={{marginLeft:"auto", fontFamily:"var(--mono)", fontSize: 18, color: done ? "var(--up)" : "var(--ink)"}}>
              {(p.pct * 100).toFixed(1)}%
            </div>
          </div>

          <div style={{marginTop: 14, height: 10, borderRadius: 99, background:"var(--bg-3)", overflow:"hidden"}}>
            <div style={{height:"100%", width: `${p.pct * 100}%`, background: done ? "var(--up)" : catColor, transition:"width 400ms", borderRadius: 99}}/>
          </div>

          {/* Meta row */}
          <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(160px, 1fr))", gap: 16, marginTop: 22, paddingTop: 18, borderTop: "1px dashed var(--line)"}}>
            <MetaCell label="Target date" value={goal.target_date ? new Date(goal.target_date).toLocaleDateString(undefined, { day:"numeric", month:"short", year:"numeric" }) : "No deadline"}
              sub={goal.target_date ? (daysLeft > 0 ? `${daysLeft} days to go` : daysLeft === 0 ? "Today" : `${Math.abs(daysLeft)}d overdue`) : null}/>
            <MetaCell label="Remaining" value={formatMoney(Math.max(0, p.target - p.current), { compact: p.target >= 100000 })}/>
            {p.autoTracked && <MetaCell label="Auto-tracked" value={formatMoney(p.autoCurrent, { compact: p.autoCurrent >= 100000 })}
              sub={goal.kind === "category" ? `From ${window.getCategory(goal.category)?.name || goal.category}` :
                    goal.kind === "networth" ? "Net worth" :
                    goal.kind === "emergency" ? "Cash holdings" :
                    goal.kind === "holdings" ? `${goal.holdings.length} holding${goal.holdings.length === 1 ? "" : "s"}` :
                    goal.kind === "liability" ? "Debt paid down" : ""}/>}
            {p.manual > 0 && <MetaCell label="Manual logs" value={formatMoney(p.manual, { compact: p.manual >= 100000 })} sub={`${contribs.length} entr${contribs.length === 1 ? "y" : "ies"}`}/>}
          </div>
        </div>
      </div>

      {/* Trajectory chart */}
      {trajectoryPoints.length >= 2 && (
        <div className="card" style={{marginBottom: 18}}>
          <div className="card-hd">
            <span className="eyebrow">Trajectory</span>
            <h3>Progress over time</h3>
          </div>
          <div className="card-bd">
            <TrajectoryChart points={trajectoryPoints} target={p.target} color={done ? "var(--up)" : catColor}/>
          </div>
        </div>
      )}

      {/* Contributions timeline */}
      <div className="card" style={{marginBottom: 18}}>
        <div className="card-hd">
          <span className="eyebrow">Activity</span>
          <h3>Contributions & milestones</h3>
          <div style={{marginLeft:"auto"}}>
            <button className="btn" onClick={() => setLogging(true)}><I.Plus/> Add</button>
          </div>
        </div>
        <div className="card-bd" style={{padding: 0}}>
          {contribs.length === 0 ? (
            <div style={{padding: "28px 22px", textAlign:"center", color:"var(--ink-3)", fontSize: 13}}>
              No manual contributions logged yet.
              {p.autoTracked && <div style={{marginTop: 4, fontSize: 12}}>Auto-tracked progress will still reflect your portfolio changes.</div>}
            </div>
          ) : (
            <div>
              {[...contribs].reverse().map(c => (
                <div key={c.id} style={{
                  display:"grid", gridTemplateColumns:"90px 1fr auto auto", gap: 16, alignItems:"center",
                  padding: "14px 22px", borderBottom: "1px solid var(--line)",
                }}>
                  <div style={{fontFamily:"var(--mono)", fontSize: 12, color:"var(--ink-3)"}}>
                    {new Date(c.date).toLocaleDateString(undefined, { day:"numeric", month:"short", year: "2-digit"})}
                  </div>
                  <div>
                    <div style={{fontSize: 13}}>{c.note || "Contribution"}</div>
                  </div>
                  <div className="num" style={{fontSize: 14, color: c.amount >= 0 ? "var(--up)" : "var(--down)"}}>
                    {c.amount >= 0 ? "+" : ""}{formatMoney(c.amount)}
                  </div>
                  <button className="btn" onClick={() => { if (confirm("Remove this entry?")) window.goalsStore.removeContribution(goal.id, c.id); }}
                    style={{padding:"4px 8px", fontSize: 12}}><I.Trash/></button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Notes */}
      {goal.notes && (
        <div className="card" style={{marginBottom: 18}}>
          <div className="card-hd"><span className="eyebrow">Notes</span></div>
          <div className="card-bd" style={{whiteSpace:"pre-wrap", fontSize: 14, lineHeight: 1.6, color:"var(--ink-2)"}}>
            {goal.notes}
          </div>
        </div>
      )}

      {/* Actions */}
      <div style={{display:"flex", gap: 8, justifyContent:"space-between", marginTop: 18, flexWrap:"wrap"}}>
        <div style={{display:"flex", gap: 8}}>
          {!goal.completed_at && p.pct >= 1 && (
            <button className="btn primary" onClick={() => window.goalsStore.markComplete(goal.id)}>
              <I.Check/> Mark complete
            </button>
          )}
          {goal.completed_at && (
            <button className="btn" onClick={() => window.goalsStore.uncomplete(goal.id)}>Un-complete</button>
          )}
          {!goal.archived ? (
            <button className="btn" onClick={() => { window.goalsStore.archive(goal.id); onBack(); }}>Archive</button>
          ) : (
            <button className="btn" onClick={() => window.goalsStore.unarchive(goal.id)}>Unarchive</button>
          )}
        </div>
        <button className="btn" onClick={() => { if (confirm("Delete this goal permanently?")) { window.goalsStore.remove(goal.id); onBack(); } }}
          style={{color:"var(--down)"}}>
          Delete goal
        </button>
      </div>

      {logging && <LogContributionModal goal={goal} onClose={() => setLogging(false)}/>}
    </div>
  );
}

function MetaCell({ label, value, sub }) {
  return (
    <div>
      <div className="eyebrow" style={{marginBottom: 4}}>{label}</div>
      <div className="num" style={{fontSize: 18}}>{value}</div>
      {sub && <div style={{fontSize: 11, color:"var(--ink-3)", marginTop: 2, fontFamily:"var(--mono)"}}>{sub}</div>}
    </div>
  );
}

function buildTrajectory(goal, contribs, p) {
  // Build cumulative timeseries of current-value over time.
  // Start from goal.created_at with value 0 (or autoCurrent at start if available).
  // Add a point per contribution (cumulative). End at today with p.current.
  const startDate = (goal.created_at || new Date().toISOString()).slice(0,10);
  const today = new Date().toISOString().slice(0,10);
  const pts = [];
  let cum = 0;
  pts.push({ t: startDate, v: 0 });
  for (const c of contribs) {
    cum += Number(c.amount || 0);
    pts.push({ t: c.date, v: cum + (p.autoTracked ? 0 : 0) });
  }
  // final point = today with full current value (auto + manual)
  if (pts[pts.length - 1].t !== today) {
    pts.push({ t: today, v: p.current });
  } else {
    pts[pts.length - 1].v = p.current;
  }
  return pts;
}

function TrajectoryChart({ points, target, color }) {
  const W = 640, H = 180, PAD = { t: 14, r: 14, b: 20, l: 14 };
  const iw = W - PAD.l - PAD.r, ih = H - PAD.t - PAD.b;
  const maxV = Math.max(target, ...points.map(p => p.v)) * 1.05 || 1;
  const ts = points.map(p => new Date(p.t).getTime());
  const t0 = Math.min(...ts), t1 = Math.max(...ts);
  const span = (t1 - t0) || 1;
  const x = (t) => PAD.l + ((new Date(t).getTime() - t0) / span) * iw;
  const y = (v) => PAD.t + ih - (v / maxV) * ih;

  const path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${x(p.t).toFixed(1)} ${y(p.v).toFixed(1)}`).join(" ");
  const area = path + ` L ${x(points[points.length-1].t).toFixed(1)} ${y(0)} L ${x(points[0].t).toFixed(1)} ${y(0)} Z`;
  const targetY = y(target);
  const gradId = "gradGoal_" + Math.random().toString(36).slice(2, 8);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%", height: H, display:"block"}}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28"/>
          <stop offset="100%" stopColor={color} stopOpacity="0.02"/>
        </linearGradient>
      </defs>
      {/* target line */}
      <line x1={PAD.l} x2={W - PAD.r} y1={targetY} y2={targetY}
            stroke="var(--line-2)" strokeDasharray="4 4"/>
      <text x={W - PAD.r - 4} y={targetY - 5} textAnchor="end"
            style={{fontFamily:"var(--mono)", fontSize: 10, fill:"var(--ink-3)"}}>
        Target {formatMoney(target, { compact: true })}
      </text>
      <path d={area} fill={`url(#${gradId})`}/>
      <path d={path} fill="none" stroke={color} strokeWidth="2"/>
      {points.map((p, i) => (
        <circle key={i} cx={x(p.t)} cy={y(p.v)} r="3" fill={color} stroke="var(--bg-1)" strokeWidth="1.5"/>
      ))}
      {/* x-axis endpoints */}
      <text x={PAD.l} y={H - 6} style={{fontFamily:"var(--mono)", fontSize: 10, fill:"var(--ink-4)"}}>
        {new Date(points[0].t).toLocaleDateString(undefined, { day:"numeric", month:"short"})}
      </text>
      <text x={W - PAD.r} y={H - 6} textAnchor="end" style={{fontFamily:"var(--mono)", fontSize: 10, fill:"var(--ink-4)"}}>
        Today
      </text>
    </svg>
  );
}

/* ---------------- Add/Edit form ---------------- */

function GoalEditScreen({ goalId, onDone, onDelete }) {
  const existing = goalId ? window.goalsStore.get(goalId) : null;
  const [kind, setKind] = React.useState(existing?.kind || "category");
  const [title, setTitle] = React.useState(existing?.title || "");
  const [target, setTarget] = React.useState(existing?.target || "");
  const [targetDate, setTargetDate] = React.useState(existing?.target_date || "");
  const [priority, setPriority] = React.useState(existing?.priority || "med");
  const [category, setCategory] = React.useState(existing?.category || "stocks");
  const [notes, setNotes] = React.useState(existing?.notes || "");
  const [holdings, setHoldings] = React.useState(existing?.holdings || []);
  const [liabilityId, setLiabilityId] = React.useState(existing?.liability_id || "");
  const [startBalance, setStartBalance] = React.useState(existing?.start_balance || "");

  const assets = window.ASSETS || [];
  const liabilities = assets.filter(a => a.cat === "liability");

  const save = () => {
    if (!title.trim()) { alert("Please give your goal a title."); return; }
    if (!target || Number(target) <= 0) { alert("Please set a target amount."); return; }

    const patch = {
      kind, title: title.trim(), notes: notes.trim(),
      target: Number(target), target_date: targetDate,
      priority,
      category: kind === "category" ? category : null,
      holdings: kind === "holdings" ? holdings : [],
      liability_id: kind === "liability" ? liabilityId : null,
      start_balance: kind === "liability" ? Number(startBalance) || 0 : null,
    };
    if (existing) window.goalsStore.update(existing.id, patch);
    else window.goalsStore.create(patch);
    onDone();
  };

  const KINDS = window.goalsStore.KINDS;

  return (
    <div style={{maxWidth: 680, margin: "0 auto"}}>
      <button className="btn" onClick={onDone} style={{marginBottom: 20}}>← {existing ? "Cancel" : "Back"}</button>
      <h1 style={{margin: "0 0 24px", fontFamily:"var(--serif)", fontStyle:"italic", fontSize: 36, fontWeight: 400, letterSpacing:"-0.02em"}}>
        {existing ? "Edit goal" : "New goal"}
      </h1>

      <div style={{display:"flex", flexDirection:"column", gap: 16}}>
        {/* Kind picker */}
        <div className="field">
          <label>Goal type</label>
          <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(200px, 1fr))", gap: 8}}>
            {Object.entries(KINDS).map(([k, meta]) => (
              <button key={k} type="button" onClick={() => setKind(k)}
                style={{
                  textAlign:"left", padding: "10px 12px",
                  background: kind === k ? "var(--bg-3)" : "var(--bg-2)",
                  border: "1px solid " + (kind === k ? "var(--accent)" : "var(--line)"),
                  borderRadius: 10, color:"var(--ink)",
                }}>
                <div style={{fontSize: 13, fontWeight: 500, marginBottom: 2}}>{meta.label}</div>
                <div style={{fontSize: 11, color:"var(--ink-3)"}}>{meta.blurb}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label>Title</label>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Build my share portfolio to $1M"/>
        </div>

        <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap: 12}}>
          <div className="field">
            <label>Target amount</label>
            <input type="number" value={target} onChange={e => setTarget(e.target.value)} placeholder="e.g. 1000000"/>
          </div>
          <div className="field">
            <label>Target date</label>
            <input type="date" value={targetDate} onChange={e => setTargetDate(e.target.value)}/>
          </div>
        </div>

        {kind === "category" && (
          <div className="field">
            <label>Category to grow</label>
            <select value={category} onChange={e => setCategory(e.target.value)}>
              {(window.CATEGORIES || []).filter(c => !c.negative).map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <div style={{fontSize: 11, color:"var(--ink-3)", marginTop: 4}}>
              Progress updates automatically as you add holdings in this category.
            </div>
          </div>
        )}

        {kind === "holdings" && (
          <HoldingPicker selected={holdings} setSelected={setHoldings}/>
        )}

        {kind === "liability" && (
          <>
            <div className="field">
              <label>Which liability?</label>
              <select value={liabilityId} onChange={e => setLiabilityId(e.target.value)}>
                <option value="">— Select —</option>
                {liabilities.map(l => (
                  <option key={l.id} value={l.id}>{l.name} · {formatMoney(Math.abs(l.value))}</option>
                ))}
              </select>
              {liabilities.length === 0 && (
                <div style={{fontSize: 11, color:"var(--ink-3)", marginTop: 4}}>
                  No liabilities added yet. Add one under Portfolio → Add asset → Liabilities.
                </div>
              )}
            </div>
            <div className="field">
              <label>Starting balance (optional)</label>
              <input type="number" value={startBalance} onChange={e => setStartBalance(e.target.value)} placeholder="Amount owed when you started this goal"/>
              <div style={{fontSize: 11, color:"var(--ink-3)", marginTop: 4}}>
                Used to calculate how much you've paid down. Defaults to current balance.
              </div>
            </div>
          </>
        )}

        <div className="field">
          <label>Priority</label>
          <div className="seg" style={{maxWidth: 280}}>
            {["high","med","low"].map(p => (
              <button key={p} type="button" className={priority === p ? "active" : ""} onClick={() => setPriority(p)}>
                {p === "med" ? "Medium" : p[0].toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label>Notes (optional)</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={4}
            style={{
              background:"var(--bg-2)", border:"1px solid var(--line)",
              borderRadius: 10, padding: "10px 12px", color:"var(--ink)",
              resize:"vertical", fontFamily:"var(--sans)",
            }}
            placeholder="Plan, strategy, thinking behind this goal…"/>
        </div>

        <div style={{display:"flex", gap: 8, justifyContent:"flex-end", marginTop: 10}}>
          {existing && (
            <button className="btn" onClick={() => {
              if (confirm("Delete this goal permanently?")) {
                window.goalsStore.remove(existing.id);
                onDelete ? onDelete() : onDone();
              }
            }} style={{color:"var(--down)", marginRight:"auto"}}>Delete</button>
          )}
          <button className="btn" onClick={onDone}>Cancel</button>
          <button className="btn primary" onClick={save}>{existing ? "Save changes" : "Create goal"}</button>
        </div>
      </div>
    </div>
  );
}

function HoldingPicker({ selected, setSelected }) {
  const assets = (window.ASSETS || []).filter(a => a.value > 0);
  const [q, setQ] = React.useState("");
  const [customSym, setCustomSym] = React.useState("");
  const [customName, setCustomName] = React.useState("");
  const selIds = new Set(selected.map(h => typeof h === "string" ? h : h.id).filter(Boolean));
  const selSyms = new Set(selected.filter(h => typeof h === "object" && !h.id).map(h => (h.sym || "").toUpperCase()));

  const filtered = assets.filter(a =>
    !q || a.name.toLowerCase().includes(q.toLowerCase()) || (a.sym || "").toLowerCase().includes(q.toLowerCase())
  );

  const toggle = (a) => {
    if (selIds.has(a.id)) setSelected(selected.filter(h => (typeof h === "string" ? h : h.id) !== a.id));
    else setSelected([...selected, a.id]);
  };

  const addCustom = () => {
    if (!customSym.trim() && !customName.trim()) return;
    setSelected([...selected, { sym: customSym.trim().toUpperCase(), name: customName.trim() }]);
    setCustomSym(""); setCustomName("");
  };

  const removeCustom = (idx) => {
    const next = [...selected]; next.splice(idx, 1); setSelected(next);
  };

  return (
    <div className="field">
      <label>Holdings to track</label>
      <div style={{display:"flex", flexDirection:"column", gap: 10}}>
        {selected.length > 0 && (
          <div style={{display:"flex", flexWrap:"wrap", gap: 6}}>
            {selected.map((h, i) => {
              const a = typeof h === "string" ? assets.find(x => x.id === h) : null;
              const label = a ? `${a.sym} · ${a.name}` : `${h.sym || ""}${h.name ? " · " + h.name : ""}`;
              return (
                <span key={i} style={{
                  display:"inline-flex", alignItems:"center", gap: 6,
                  padding: "4px 10px", borderRadius: 99,
                  background:"var(--bg-3)", border:"1px solid var(--line)",
                  fontSize: 12, fontFamily:"var(--mono)",
                }}>
                  {label}
                  <button type="button" onClick={() => {
                    if (a) setSelected(selected.filter(x => (typeof x === "string" ? x : x.id) !== a.id));
                    else removeCustom(i);
                  }} style={{color:"var(--ink-3)", fontSize: 14, lineHeight: 1}}>×</button>
                </span>
              );
            })}
          </div>
        )}

        {assets.length > 0 && (
          <>
            <input placeholder="Search your holdings…" value={q} onChange={e => setQ(e.target.value)}/>
            <div style={{maxHeight: 180, overflowY:"auto", border:"1px solid var(--line)", borderRadius: 10, background:"var(--bg-2)"}}>
              {filtered.length === 0 && (
                <div style={{padding: 12, fontSize: 12, color:"var(--ink-3)"}}>No matches.</div>
              )}
              {filtered.map(a => {
                const sel = selIds.has(a.id);
                return (
                  <div key={a.id} onClick={() => toggle(a)}
                    style={{
                      display:"flex", alignItems:"center", gap: 10, padding: "8px 12px",
                      borderBottom:"1px solid var(--line)", cursor:"pointer",
                      background: sel ? "color-mix(in oklab, var(--accent) 8%, transparent)" : "transparent",
                    }}>
                    <div style={{
                      width: 16, height: 16, borderRadius: 4,
                      border: "1.5px solid " + (sel ? "var(--accent)" : "var(--line-2)"),
                      background: sel ? "var(--accent)" : "transparent",
                      display:"grid", placeItems:"center", color:"var(--accent-ink)",
                    }}>{sel && <I.Check/>}</div>
                    <div style={{flex: 1, fontSize: 13}}>
                      <span className="num" style={{color:"var(--ink)", marginRight: 8}}>{a.sym}</span>
                      <span style={{color:"var(--ink-2)"}}>{a.name}</span>
                    </div>
                    <div className="num" style={{fontSize: 12, color:"var(--ink-3)"}}>
                      {formatMoney(a.value, { compact: true })}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        <div style={{
          padding: 12, border:"1px dashed var(--line)", borderRadius: 10,
          background:"var(--bg-2)",
        }}>
          <div style={{fontSize: 11, color:"var(--ink-3)", marginBottom: 6, fontFamily:"var(--mono)", letterSpacing:"0.08em", textTransform:"uppercase"}}>
            Or add by ticker / name
          </div>
          <div style={{display:"flex", gap: 6}}>
            <input placeholder="Ticker (VGS)" value={customSym} onChange={e => setCustomSym(e.target.value)} style={{flex: "0 0 100px"}}/>
            <input placeholder="Name (optional)" value={customName} onChange={e => setCustomName(e.target.value)} style={{flex: 1}}/>
            <button type="button" className="btn" onClick={addCustom}>Add</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Log contribution modal ---------------- */

function LogContributionModal({ goal, onClose }) {
  const [amount, setAmount] = React.useState("");
  const [date, setDate] = React.useState(new Date().toISOString().slice(0,10));
  const [note, setNote] = React.useState("");

  const save = () => {
    const n = Number(amount);
    if (!n || isNaN(n)) { alert("Enter an amount."); return; }
    window.goalsStore.addContribution(goal.id, { amount: n, date, note });
    onClose();
  };

  return (
    <div onClick={onClose} style={{
      position:"fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000,
      display:"grid", placeItems:"center", padding: 20,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: "100%", maxWidth: 420,
        background:"var(--bg-1)", border:"1px solid var(--line-2)",
        borderRadius:"var(--radius-lg)", padding: 24,
        boxShadow: "var(--shadow-2)",
      }}>
        <div className="eyebrow" style={{marginBottom: 6}}>Log contribution</div>
        <h3 style={{margin: "0 0 18px", fontSize: 20, fontFamily:"var(--serif)", fontStyle:"italic", fontWeight: 400}}>
          {goal.title}
        </h3>
        <div style={{display:"flex", flexDirection:"column", gap: 12}}>
          <div className="field">
            <label>Amount</label>
            <input type="number" autoFocus value={amount} onChange={e => setAmount(e.target.value)} placeholder="e.g. 10000"/>
            <div style={{fontSize: 11, color:"var(--ink-3)", marginTop: 4}}>
              Use a negative number if you withdrew.
            </div>
          </div>
          <div className="field">
            <label>Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}/>
          </div>
          <div className="field">
            <label>Note (optional)</label>
            <input value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Payday deposit, bonus, gift…"/>
          </div>
        </div>
        <div style={{display:"flex", gap: 8, justifyContent:"flex-end", marginTop: 20}}>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={save}>Log it</button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Celebration ---------------- */

function CelebrationModal({ goalId, onClose }) {
  const goal = window.goalsStore.get(goalId);
  if (!goal) return null;

  React.useEffect(() => {
    // Fire confetti
    const host = document.getElementById("celebrate-confetti");
    if (!host) return;
    host.innerHTML = "";
    for (let i = 0; i < 80; i++) {
      const d = document.createElement("div");
      const hue = Math.random() < 0.5 ? "var(--accent)" : "#9bb8ff";
      d.style.cssText = `
        position:absolute; left: ${Math.random()*100}%; top: -20px;
        width: ${6 + Math.random()*6}px; height: ${10 + Math.random()*10}px;
        background: ${hue}; border-radius: 2px;
        animation: confetti-fall ${2 + Math.random()*2}s linear ${Math.random()*0.8}s forwards;
        transform: rotate(${Math.random()*360}deg);
      `;
      host.appendChild(d);
    }
  }, []);

  return (
    <div onClick={onClose} style={{
      position:"fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 2000,
      display:"grid", placeItems:"center", padding: 20, overflow:"hidden",
    }}>
      <style>{`
        @keyframes confetti-fall {
          to { transform: translateY(110vh) rotate(720deg); opacity: 0.3; }
        }
        @keyframes celebrate-pop {
          0% { transform: scale(0.7); opacity: 0; }
          60% { transform: scale(1.04); }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
      <div id="celebrate-confetti" style={{position:"absolute", inset: 0, pointerEvents:"none"}}/>
      <div onClick={e => e.stopPropagation()} style={{
        maxWidth: 440, width:"100%",
        background:"var(--bg-1)", border:"1px solid var(--line-2)",
        borderRadius:"var(--radius-lg)", padding: "32px 30px", textAlign:"center",
        animation: "celebrate-pop 400ms ease-out",
        boxShadow: "var(--shadow-2)",
      }}>
        <div style={{
          width: 72, height: 72, borderRadius: "50%", margin: "0 auto 18px",
          background: "var(--up-soft)", color:"var(--up)",
          display:"grid", placeItems:"center",
        }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12l5 5L20 7"/>
          </svg>
        </div>
        <div className="eyebrow" style={{marginBottom: 8}}>Goal reached</div>
        <h2 style={{margin: "0 0 10px", fontFamily:"var(--serif)", fontStyle:"italic", fontSize: 32, fontWeight: 400, letterSpacing:"-0.01em"}}>
          You did it.
        </h2>
        <div style={{fontSize: 15, color:"var(--ink-2)", marginBottom: 20}}>
          <strong style={{color:"var(--ink)"}}>{goal.title}</strong>
        </div>
        <div style={{fontSize: 13, color:"var(--ink-3)", marginBottom: 24, lineHeight: 1.6}}>
          That's a milestone worth taking a moment for. What's next?
        </div>
        <div style={{display:"flex", gap: 8, justifyContent:"center"}}>
          <button className="btn" onClick={() => { window.goalsStore.archive(goal.id); onClose(); }}>Archive it</button>
          <button className="btn primary" onClick={() => { window.goalsStore.markComplete(goal.id); onClose(); }}>
            <I.Check/> Mark complete
          </button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { GoalDetailScreen, GoalEditScreen, LogContributionModal, CelebrationModal });
