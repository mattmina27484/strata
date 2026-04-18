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

function ProfileScreen() {
  const [p, setP] = React.useState(() => window.getProfile());
  const [saved, setSaved] = React.useState(false);
  const savedTimer = React.useRef(null);

  const update = (patch) => {
    const next = window.saveProfile(patch);
    setP(next);
    setSaved(true);
    clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSaved(false), 1500);
  };

  const f = (name) => ({
    value: p[name] ?? "",
    onChange: (e) => update({ [name]: e.target.value }),
  });

  const completion = window.profileCompletion();

  const Section = ({ title, subtitle, children }) => (
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

  const Row = ({ children, cols = 2 }) => (
    <div style={{display:"grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 14, marginBottom: 14}}>
      {children}
    </div>
  );

  const Field = ({ label, name, type = "text", placeholder, prefix, suffix, options, textarea, rows = 3, full }) => (
    <div className="field" style={full ? {gridColumn:"1 / -1"} : {}}>
      <label>{label}</label>
      {options ? (
        <select {...f(name)}>
          <option value="">—</option>
          {options.map(o => (
            <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>
          ))}
        </select>
      ) : textarea ? (
        <textarea {...f(name)} placeholder={placeholder} rows={rows}
          style={{
            background:"var(--bg-2)", border:"1px solid var(--line)", borderRadius: 10,
            padding: "10px 12px", color:"var(--ink)", outline:"none", resize:"vertical",
            fontFamily: "var(--sans)", fontSize: 14,
          }}
        />
      ) : (prefix || suffix) ? (
        <div style={{display:"flex", alignItems:"stretch", background:"var(--bg-2)", border:"1px solid var(--line)", borderRadius: 10, overflow:"hidden"}}>
          {prefix && <span style={{padding:"10px 12px", color:"var(--ink-3)", fontFamily:"var(--mono)", fontSize: 13, borderRight:"1px solid var(--line)"}}>{prefix}</span>}
          <input {...f(name)} type={type} placeholder={placeholder}
            style={{flex:1, background:"transparent", border:"none", padding: "10px 12px", color:"var(--ink)", outline:"none", fontFamily: type === "number" ? "var(--mono)" : "var(--sans)"}}
          />
          {suffix && <span style={{padding:"10px 12px", color:"var(--ink-3)", fontFamily:"var(--mono)", fontSize: 13, borderLeft:"1px solid var(--line)"}}>{suffix}</span>}
        </div>
      ) : (
        <input {...f(name)} type={type} placeholder={placeholder} />
      )}
    </div>
  );

  const ccy = (window.CURRENCIES?.[window.__APP_STATE?.currency] || window.CURRENCIES?.AUD || { symbol: "$" });

  return (
    <div className="page">
      {/* Header */}
      <div style={{display:"flex", alignItems:"flex-end", justifyContent:"space-between", marginBottom: 22, gap: 16, flexWrap:"wrap"}}>
        <div>
          <div className="eyebrow" style={{marginBottom: 6}}>Account</div>
          <h1 style={{margin: 0, fontFamily:"var(--serif)", fontStyle:"italic", fontSize: 38, fontWeight: 400, letterSpacing:"-0.01em"}}>Your profile</h1>
          <div className="muted" style={{fontSize: 13, marginTop: 6, maxWidth: 560}}>
            Used to personalise insights, analysis, and forecasts. Stored locally on this device and synced via your Drive backup. Only you can see this.
          </div>
        </div>
        <div style={{display:"flex", alignItems:"center", gap: 12}}>
          {saved && <span className="pill up"><span className="dot" style={{width:6, height:6, borderRadius:"50%", background:"var(--up)"}}/> Saved</span>}
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

      <Section title="Identity" subtitle="The basics.">
        <Row>
          <Field label="Full name" name="fullName" placeholder="Matthew Mina" />
          <Field label="Age" name="age" type="number" placeholder="34" />
        </Row>
        <Row>
          <Field label="Occupation / role" name="occupation" placeholder="Founder, Software engineer, Doctor…" />
          <Field label="Employer or business" name="employer" placeholder="Acme Co." />
        </Row>
      </Section>

      <Section title="Household" subtitle="Who depends on your finances.">
        <Row cols={3}>
          <Field label="Relationship status" name="relationshipStatus" options={[
            { value:"single", label:"Single" },
            { value:"partnered", label:"Partnered" },
            { value:"married", label:"Married" },
            { value:"divorced", label:"Divorced" },
            { value:"widowed", label:"Widowed" },
          ]} />
          <Field label="Dependents" name="dependentsCount" type="number" placeholder="0" />
          <Field label="Dependent ages" name="dependentAges" placeholder="e.g. 4, 7, 12" />
        </Row>
      </Section>

      <Section title="Income" subtitle="Annual earnings before and after tax.">
        <Row>
          <Field label="Annual income (gross)" name="annualIncomeGross" type="number" prefix={ccy.symbol} placeholder="180000" />
          <Field label="Annual income (take-home)" name="annualIncomeNet" type="number" prefix={ccy.symbol} placeholder="128000" />
        </Row>
        <Row cols={1}>
          <Field label="Other income sources" name="otherIncomeSources" textarea rows={2} placeholder="Rental income, side business, dividends…" full />
        </Row>
      </Section>

      <Section title="Expenses" subtitle="Rough monthly spend — helps forecast runway and savings rate.">
        <Row>
          <Field label="Monthly living expenses" name="monthlyExpenses" type="number" prefix={ccy.symbol} placeholder="6500" />
        </Row>
      </Section>

      <Section title="Location" subtitle="Affects tax, retirement rules, and regional advice.">
        <Row>
          <Field label="Country" name="country" placeholder="Australia" />
          <Field label="State / region" name="region" placeholder="NSW" />
        </Row>
      </Section>

      <Section title="Goals" subtitle="What you're working towards.">
        <Row cols={2}>
          <Field label="Target retirement age" name="retirementAge" type="number" placeholder="55" />
          <Field label="Target net worth" name="targetNetWorth" type="number" prefix={ccy.symbol} placeholder="5000000" />
        </Row>
        <Row cols={1}>
          <Field label="Main financial goal" name="mainGoal" textarea rows={2} placeholder="Financial independence by 50 so I can focus on my business full-time." full />
        </Row>
      </Section>

      <Section title="Risk & horizon" subtitle="How you think about risk.">
        <Row>
          <Field label="Risk tolerance" name="riskTolerance" options={[
            { value:"conservative", label:"Conservative — capital preservation" },
            { value:"balanced", label:"Balanced — moderate growth" },
            { value:"growth", label:"Growth — long-term appreciation" },
            { value:"aggressive", label:"Aggressive — high risk / high reward" },
          ]} />
          <Field label="Time horizon" name="timeHorizon" options={[
            { value:"short", label:"Short (< 3 years)" },
            { value:"medium", label:"Medium (3–10 years)" },
            { value:"long", label:"Long (10+ years)" },
          ]} />
        </Row>
      </Section>

      <Section title="Notes for AI" subtitle="Anything else AI features should know when giving you advice.">
        <Row cols={1}>
          <Field label="Context / preferences" name="planningNotes" textarea rows={4} full
            placeholder="e.g. I'm planning to buy a second investment property in 2 years. I already max my concessional super contributions. I prefer low-volatility allocations." />
        </Row>
      </Section>

      {/* Danger zone */}
      <div style={{display:"flex", justifyContent:"flex-end", marginTop: 8}}>
        <button className="btn" style={{color:"var(--down)", borderColor:"color-mix(in oklab, var(--down) 30%, var(--line-2))"}}
          onClick={() => {
            if (confirm("Clear all profile data? This can't be undone.")) {
              window.resetProfile();
              setP(window.getProfile());
            }
          }}>Clear profile</button>
      </div>
    </div>
  );
}

window.ProfileScreen = ProfileScreen;
console.log("[profile.jsx] loaded, ProfileScreen:", typeof window.ProfileScreen);
