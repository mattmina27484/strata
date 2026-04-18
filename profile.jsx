/* Profile — personal info for AI personalisation.
   Stored in localStorage, included in Drive backup.
   Accessible globally via window.getProfile() / window.profileSummary() */

(function() {
  const KEY = "strata.profile.v1";

  const EMPTY = {
    // Identity
    fullName: "",
    age: "",
    occupation: "",
    employer: "",
    // Household
    relationshipStatus: "",         // single | partnered | married | divorced | widowed
    dependentsCount: "",
    dependentAges: "",              // free-text e.g. "4, 7, 12"
    // Income
    annualIncomeGross: "",
    annualIncomeNet: "",
    otherIncomeSources: "",         // free-text
    // Expenses
    monthlyExpenses: "",
    // Location
    country: "",
    region: "",                     // state / province
    // Goals
    retirementAge: "",
    targetNetWorth: "",
    mainGoal: "",                   // free-text
    // Risk
    riskTolerance: "",              // conservative | balanced | growth | aggressive
    timeHorizon: "",                // short | medium | long
    // Notes
    planningNotes: "",
    // Meta
    updatedAt: "",
  };

  function read() {
    try {
      const v = localStorage.getItem(KEY);
      if (!v) return { ...EMPTY };
      return { ...EMPTY, ...JSON.parse(v) };
    } catch { return { ...EMPTY }; }
  }

  function write(patch) {
    const cur = read();
    const next = { ...cur, ...patch, updatedAt: new Date().toISOString() };
    localStorage.setItem(KEY, JSON.stringify(next));
    if (window.rebuildData) window.rebuildData();
    return next;
  }

  function reset() {
    localStorage.removeItem(KEY);
    if (window.rebuildData) window.rebuildData();
  }

  /* Completion percentage — rough, for dashboard chip */
  function completion() {
    const p = read();
    const keys = Object.keys(EMPTY).filter(k => k !== "updatedAt");
    const filled = keys.filter(k => String(p[k] ?? "").trim() !== "").length;
    return Math.round((filled / keys.length) * 100);
  }

  /* Compact summary for AI prompts — only includes filled fields */
  function summary() {
    const p = read();
    const parts = [];
    if (p.fullName) parts.push(`Name: ${p.fullName}`);
    if (p.age) parts.push(`Age: ${p.age}`);
    if (p.occupation) parts.push(`Occupation: ${p.occupation}${p.employer ? ` at ${p.employer}` : ""}`);
    if (p.relationshipStatus) parts.push(`Relationship: ${p.relationshipStatus}`);
    if (p.dependentsCount) parts.push(`Dependents: ${p.dependentsCount}${p.dependentAges ? ` (ages ${p.dependentAges})` : ""}`);
    if (p.annualIncomeGross) parts.push(`Annual income (gross): ${p.annualIncomeGross}`);
    if (p.annualIncomeNet) parts.push(`Annual income (take-home): ${p.annualIncomeNet}`);
    if (p.otherIncomeSources) parts.push(`Other income: ${p.otherIncomeSources}`);
    if (p.monthlyExpenses) parts.push(`Monthly expenses: ${p.monthlyExpenses}`);
    if (p.country || p.region) parts.push(`Location: ${[p.region, p.country].filter(Boolean).join(", ")}`);
    if (p.retirementAge) parts.push(`Target retirement age: ${p.retirementAge}`);
    if (p.targetNetWorth) parts.push(`Target net worth: ${p.targetNetWorth}`);
    if (p.mainGoal) parts.push(`Main goal: ${p.mainGoal}`);
    if (p.riskTolerance) parts.push(`Risk tolerance: ${p.riskTolerance}`);
    if (p.timeHorizon) parts.push(`Time horizon: ${p.timeHorizon}`);
    if (p.planningNotes) parts.push(`Notes: ${p.planningNotes}`);
    return parts.join("\n");
  }

  window.getProfile = read;
  window.saveProfile = write;
  window.resetProfile = reset;
  window.profileCompletion = completion;
  window.profileSummary = summary;
})();

/* ---- UI ---- */

function ProfileSection({ title, subtitle, children }) {
  return (
    <div className="card" style={{marginBottom: 16}}>
      <div className="card-hd" style={{flexDirection:"column", alignItems:"flex-start", gap: 4, padding:"18px 22px"}}>
        <div style={{display:"flex", width:"100%", alignItems:"center", gap: 12}}>
          <h3 style={{margin:0, fontSize: 14, color: "var(--ink)", fontWeight: 500}}>{title}</h3>
        </div>
        {subtitle && <div className="eyebrow" style={{color:"var(--ink-3)", letterSpacing:"0.02em", fontFamily:"var(--sans)", textTransform:"none", fontSize: 12}}>{subtitle}</div>}
      </div>
      <div className="card-bd">{children}</div>
    </div>
  );
}

function ProfileRow({ children, cols = 2 }) {
  return (
    <div style={{display:"grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 14, marginBottom: 14}}>
      {children}
    </div>
  );
}

function ProfileField({ label, name, value, onChange, onBlur, type = "text", placeholder, prefix, suffix, options, textarea, rows = 3, full }) {
  const inputProps = {
    value: value ?? "",
    onChange: (e) => onChange(name, e.target.value),
    onBlur: () => onBlur && onBlur(),
  };

  return (
    <div className="field" style={full ? {gridColumn:"1 / -1"} : {}}>
      <label>{label}</label>
      {options ? (
        <select {...inputProps}>
          <option value="">—</option>
          {options.map(o => (
            <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>
          ))}
        </select>
      ) : textarea ? (
        <textarea
          {...inputProps}
          placeholder={placeholder}
          rows={rows}
          style={{
            background:"var(--bg-2)",
            border:"1px solid var(--line)",
            borderRadius: 10,
            padding: "10px 12px",
            color:"var(--ink)",
            outline:"none",
            resize:"vertical",
            fontFamily: "var(--sans)",
            fontSize: 14,
          }}
        />
      ) : (prefix || suffix) ? (
        <div style={{display:"flex", alignItems:"stretch", background:"var(--bg-2)", border:"1px solid var(--line)", borderRadius: 10, overflow:"hidden"}}>
          {prefix && <span style={{padding:"10px 12px", color:"var(--ink-3)", fontFamily:"var(--mono)", fontSize: 13, borderRight:"1px solid var(--line)"}}>{prefix}</span>}
          <input
            {...inputProps}
            type={type}
            placeholder={placeholder}
            style={{flex:1, background:"transparent", border:"none", padding: "10px 12px", color:"var(--ink)", outline:"none", fontFamily: type === "number" ? "var(--mono)" : "var(--sans)"}}
          />
          {suffix && <span style={{padding:"10px 12px", color:"var(--ink-3)", fontFamily:"var(--mono)", fontSize: 13, borderLeft:"1px solid var(--line)"}}>{suffix}</span>}
        </div>
      ) : (
        <input {...inputProps} type={type} placeholder={placeholder} />
      )}
    </div>
  );
}

function ProfileScreen() {
  const [p, setP] = React.useState(() => window.getProfile());
  const [saveState, setSaveState] = React.useState("idle"); // idle | saving | saved
  const saveTimer = React.useRef(null);
  const savedBadgeTimer = React.useRef(null);
  const latestRef = React.useRef(p);

  React.useEffect(() => {
    latestRef.current = p;
  }, [p]);

  React.useEffect(() => {
    return () => {
      clearTimeout(saveTimer.current);
      clearTimeout(savedBadgeTimer.current);
    };
  }, []);

  const flushSave = React.useCallback(() => {
    clearTimeout(saveTimer.current);
    const next = latestRef.current;
    window.saveProfile(next);
    setSaveState("saved");
    clearTimeout(savedBadgeTimer.current);
    savedBadgeTimer.current = setTimeout(() => setSaveState("idle"), 1500);
  }, []);

  const scheduleSave = React.useCallback(() => {
    clearTimeout(saveTimer.current);
    setSaveState("saving");
    saveTimer.current = setTimeout(() => {
      const next = latestRef.current;
      window.saveProfile(next);
      setSaveState("saved");
      clearTimeout(savedBadgeTimer.current);
      savedBadgeTimer.current = setTimeout(() => setSaveState("idle"), 1500);
    }, 500);
  }, []);

  const update = React.useCallback((name, value) => {
    setP(prev => {
      const next = { ...prev, [name]: value };
      latestRef.current = next;
      return next;
    });
    scheduleSave();
  }, [scheduleSave]);

  const completion = React.useMemo(() => {
    const keys = Object.keys(p).filter(k => k !== "updatedAt");
    const filled = keys.filter(k => String(p[k] ?? "").trim() !== "").length;
    return Math.round((filled / keys.length) * 100);
  }, [p]);

  const ccy = (window.CURRENCIES?.[window.__APP_STATE?.currency] || window.CURRENCIES?.AUD || { symbol: "$" });

  return (
    <div className="page">
      <div style={{display:"flex", alignItems:"flex-end", justifyContent:"space-between", marginBottom: 22, gap: 16, flexWrap:"wrap"}}>
        <div>
          <div className="eyebrow" style={{marginBottom: 6}}>Account</div>
          <h1 style={{margin: 0, fontFamily:"var(--serif)", fontStyle:"italic", fontSize: 38, fontWeight: 400, letterSpacing:"-0.01em"}}>Your profile</h1>
          <div className="muted" style={{fontSize: 13, marginTop: 6, maxWidth: 560}}>
            Used to personalise insights, analysis, and forecasts. Stored locally on this device and synced via your Drive backup. Only you can see this.
          </div>
        </div>
        <div style={{display:"flex", alignItems:"center", gap: 12}}>
          {saveState === "saving" && (
            <span className="pill">
              <span className="dot" style={{width:6, height:6, borderRadius:"50%", background:"var(--ink-3)"}}/> Saving…
            </span>
          )}
          {saveState === "saved" && (
            <span className="pill up">
              <span className="dot" style={{width:6, height:6, borderRadius:"50%", background:"var(--up)"}}/> Saved
            </span>
          )}
          <div style={{textAlign:"right"}}>
            <div className="eyebrow" style={{marginBottom: 4}}>Completion</div>
            <div style={{display:"flex", alignItems:"center", gap: 10}}>
              <div style={{width: 120, height: 6, background:"var(--bg-3)", borderRadius: 3, overflow:"hidden"}}>
                <div style={{width: `${completion}%`, height:"100%", background:"var(--accent)"}}/>
              </div>
              <span className="num" style={{fontSize: 13}}>{completion}%</span>
            </div>
          </div>
        </div>
      </div>

      <ProfileSection title="Identity" subtitle="The basics.">
        <ProfileRow>
          <ProfileField label="Full name" name="fullName" value={p.fullName} onChange={update} onBlur={flushSave} placeholder="Matthew Mina" />
          <ProfileField label="Age" name="age" value={p.age} onChange={update} onBlur={flushSave} type="number" placeholder="34" />
        </ProfileRow>
        <ProfileRow>
          <ProfileField label="Occupation / role" name="occupation" value={p.occupation} onChange={update} onBlur={flushSave} placeholder="Founder, Software engineer, Doctor…" />
          <ProfileField label="Employer or business" name="employer" value={p.employer} onChange={update} onBlur={flushSave} placeholder="Acme Co." />
        </ProfileRow>
      </ProfileSection>

      <ProfileSection title="Household" subtitle="Who depends on your finances.">
        <ProfileRow cols={3}>
          <ProfileField
            label="Relationship status"
            name="relationshipStatus"
            value={p.relationshipStatus}
            onChange={update}
            onBlur={flushSave}
            options={[
              { value:"single", label:"Single" },
              { value:"partnered", label:"Partnered" },
              { value:"married", label:"Married" },
              { value:"divorced", label:"Divorced" },
              { value:"widowed", label:"Widowed" },
            ]}
          />
          <ProfileField label="Dependents" name="dependentsCount" value={p.dependentsCount} onChange={update} onBlur={flushSave} type="number" placeholder="0" />
          <ProfileField label="Dependent ages" name="dependentAges" value={p.dependentAges} onChange={update} onBlur={flushSave} placeholder="e.g. 4, 7, 12" />
        </ProfileRow>
      </ProfileSection>

      <ProfileSection title="Income" subtitle="Annual earnings before and after tax.">
        <ProfileRow>
          <ProfileField label="Annual income (gross)" name="annualIncomeGross" value={p.annualIncomeGross} onChange={update} onBlur={flushSave} type="number" prefix={ccy.symbol} placeholder="180000" />
          <ProfileField label="Annual income (take-home)" name="annualIncomeNet" value={p.annualIncomeNet} onChange={update} onBlur={flushSave} type="number" prefix={ccy.symbol} placeholder="128000" />
        </ProfileRow>
        <ProfileRow cols={1}>
          <ProfileField label="Other income sources" name="otherIncomeSources" value={p.otherIncomeSources} onChange={update} onBlur={flushSave} textarea rows={2} placeholder="Rental income, side business, dividends…" full />
        </ProfileRow>
      </ProfileSection>

      <ProfileSection title="Expenses" subtitle="Rough monthly spend — helps forecast runway and savings rate.">
        <ProfileRow>
          <ProfileField label="Monthly living expenses" name="monthlyExpenses" value={p.monthlyExpenses} onChange={update} onBlur={flushSave} type="number" prefix={ccy.symbol} placeholder="6500" />
        </ProfileRow>
      </ProfileSection>

      <ProfileSection title="Location" subtitle="Affects tax, retirement rules, and regional advice.">
        <ProfileRow>
          <ProfileField label="Country" name="country" value={p.country} onChange={update} onBlur={flushSave} placeholder="Australia" />
          <ProfileField label="State / region" name="region" value={p.region} onChange={update} onBlur={flushSave} placeholder="NSW" />
        </ProfileRow>
      </ProfileSection>

      <ProfileSection title="Goals" subtitle="What you're working towards.">
        <ProfileRow cols={2}>
          <ProfileField label="Target retirement age" name="retirementAge" value={p.retirementAge} onChange={update} onBlur={flushSave} type="number" placeholder="55" />
          <ProfileField label="Target net worth" name="targetNetWorth" value={p.targetNetWorth} onChange={update} onBlur={flushSave} type="number" prefix={ccy.symbol} placeholder="5000000" />
        </ProfileRow>
        <ProfileRow cols={1}>
          <ProfileField label="Main financial goal" name="mainGoal" value={p.mainGoal} onChange={update} onBlur={flushSave} textarea rows={2} placeholder="Financial independence by 50 so I can focus on my business full-time." full />
        </ProfileRow>
      </ProfileSection>

      <ProfileSection title="Risk & horizon" subtitle="How you think about risk.">
        <ProfileRow>
          <ProfileField
            label="Risk tolerance"
            name="riskTolerance"
            value={p.riskTolerance}
            onChange={update}
            onBlur={flushSave}
            options={[
              { value:"conservative", label:"Conservative — capital preservation" },
              { value:"balanced", label:"Balanced — moderate growth" },
              { value:"growth", label:"Growth — long-term appreciation" },
              { value:"aggressive", label:"Aggressive — high risk / high reward" },
            ]}
          />
          <ProfileField
            label="Time horizon"
            name="timeHorizon"
            value={p.timeHorizon}
            onChange={update}
            onBlur={flushSave}
            options={[
              { value:"short", label:"Short (< 3 years)" },
              { value:"medium", label:"Medium (3–10 years)" },
              { value:"long", label:"Long (10+ years)" },
            ]}
          />
        </ProfileRow>
      </ProfileSection>

      <ProfileSection title="Notes for AI" subtitle="Anything else AI features should know when giving you advice.">
        <ProfileRow cols={1}>
          <ProfileField
            label="Context / preferences"
            name="planningNotes"
            value={p.planningNotes}
            onChange={update}
            onBlur={flushSave}
            textarea
            rows={4}
            full
            placeholder="e.g. I'm planning to buy a second investment property in 2 years. I already max my concessional super contributions. I prefer low-volatility allocations."
          />
        </ProfileRow>
      </ProfileSection>

      <div style={{display:"flex", justifyContent:"flex-end", marginTop: 8}}>
        <button
          className="btn"
          style={{color:"var(--down)", borderColor:"color-mix(in oklab, var(--down) 30%, var(--line-2))"}}
          onClick={() => {
            if (confirm("Clear all profile data? This can't be undone.")) {
              clearTimeout(saveTimer.current);
              clearTimeout(savedBadgeTimer.current);
              window.resetProfile();
              const empty = window.getProfile();
              latestRef.current = empty;
              setP(empty);
              setSaveState("idle");
            }
          }}
        >
          Clear profile
        </button>
      </div>
    </div>
  );
}

window.ProfileScreen = ProfileScreen;
console.log("[profile.jsx] loaded, ProfileScreen:", typeof window.ProfileScreen);
