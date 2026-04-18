/* Profile — personal info for AI personalisation.
   Stored in localStorage, included in Drive backup.
   Accessible globally via window.getProfile() / window.profileSummary() */

(function() {
  const KEY = "strata.profile.v1";

  const EMPTY = {
    fullName: "",
    age: "",
    occupation: "",
    employer: "",
    relationshipStatus: "",
    dependentsCount: "",
    dependentAges: "",
    annualIncomeGross: "",
    annualIncomeNet: "",
    otherIncomeSources: "",
    monthlyExpenses: "",
    country: "",
    region: "",
    retirementAge: "",
    targetNetWorth: "",
    mainGoal: "",
    riskTolerance: "",
    timeHorizon: "",
    planningNotes: "",
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

  function completion() {
    const p = read();
    const keys = Object.keys(EMPTY).filter(k => k !== "updatedAt");
    const filled = keys.filter(k => String(p[k] ?? "").trim() !== "").length;
    return Math.round((filled / keys.length) * 100);
  }

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
    if (p.monthlyExpenses) parts.push(`Monthly expenses: ${p.monthlyExpenses}`);
    if (p.country || p.region) parts.push(`Location: ${[p.region, p.country].filter(Boolean).join(", ")}`);
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
      <div className="card-hd" style={{flexDirection:"column", alignItems:"flex-start", gap: 4}}>
        <h3>{title}</h3>
        {subtitle && <div className="eyebrow">{subtitle}</div>}
      </div>
      <div className="card-bd">{children}</div>
    </div>
  );
}

function ProfileRow({ children, cols = 2 }) {
  return (
    <div style={{display:"grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 14}}>
      {children}
    </div>
  );
}

function ProfileField({ label, name, value, onChange, type = "text", placeholder }) {
  return (
    <div className="field">
      <label>{label}</label>
      <input
        value={value ?? ""}
        onChange={(e) => onChange(name, e.target.value)}
        type={type}
        placeholder={placeholder}
      />
    </div>
  );
}

function ProfileScreen() {
  const [p, setP] = React.useState(() => window.getProfile());

  const update = (name, value) => {
    const next = window.saveProfile({ [name]: value });
    setP(next);
  };

  return (
    <div className="page">
      <h1>Your profile</h1>

      <ProfileSection title="Identity">
        <ProfileRow>
          <ProfileField label="Full name" name="fullName" value={p.fullName} onChange={update} />
          <ProfileField label="Age" name="age" value={p.age} onChange={update} />
        </ProfileRow>
      </ProfileSection>

      <ProfileSection title="Goals">
        <ProfileRow>
          <ProfileField label="Target net worth" name="targetNetWorth" value={p.targetNetWorth} onChange={update} />
        </ProfileRow>
      </ProfileSection>

      <button onClick={() => {
        window.resetProfile();
        setP(window.getProfile());
      }}>
        Clear profile
      </button>
    </div>
  );
}

window.ProfileScreen = ProfileScreen;
