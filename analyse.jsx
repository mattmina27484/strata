/* AI allocation analysis — sends portfolio summary to Claude, parses & renders. */

function buildPortfolioSummary() {
  const cats = window.CATEGORY_TOTALS.filter(c => c.count > 0);
  const positive = cats.filter(c => !c.negative).reduce((s, c) => s + c.total, 0);
  const liabilities = cats.filter(c => c.negative).reduce((s, c) => s + Math.abs(c.total), 0);
  const net = window.NET_WORTH;
  const ccy = (window.CURRENCIES[window.__APP_STATE.currency] || window.CURRENCIES.AUD);

  const byCat = cats.map(c => ({
    name: c.name,
    total: Math.round(c.total),
    pct: positive > 0 ? +((Math.abs(c.total) / positive) * 100).toFixed(1) : 0,
    count: c.count,
    holdings: window.ASSETS
      .filter(a => a.cat === c.id)
      .map(a => ({ name: a.name, value: Math.round(a.value), sub: a.sub || "" })),
  }));

  return {
    currency: ccy.code,
    net_worth: Math.round(net),
    total_assets: Math.round(positive),
    total_liabilities: Math.round(liabilities),
    categories: byCat,
  };
}

function AnalysePanel({ onClose }) {
  const [state, setState] = React.useState("loading"); // loading | ok | error
  const [data, setData] = React.useState(null);
  const [error, setError] = React.useState("");
  const portfolio = React.useMemo(buildPortfolioSummary, []);

  React.useEffect(() => {
    run();
  }, []);

  async function run() {
    setState("loading"); setError("");
    const profileCtx = (window.profileSummary && window.profileSummary()) || "";
    const prompt = `You are a thoughtful, conservative financial analyst. Review this person's portfolio and produce a JSON-only response (no markdown, no prose before/after) with this exact shape:

{
  "score": <number 0-10, diversification & balance>,
  "score_label": "<short phrase e.g. 'Well diversified' or 'Over-concentrated'>",
  "headline": "<one-sentence plain-English summary>",
  "observations": [ "<3-5 short bullet observations about current state>" ],
  "risks": [ { "title": "<short title>", "detail": "<one sentence>" } ],
  "suggestions": [ { "title": "<action verb title e.g. 'Add bond exposure'>", "detail": "<2 sentences why + how>", "priority": "high" | "medium" | "low" } ],
  "disclaimer": "<one-sentence reminder this is not financial advice>"
}

Portfolio data (currency: ${portfolio.currency}):
${JSON.stringify(portfolio, null, 2)}
${profileCtx ? `
About the person (use this to personalise observations, risks, and suggestions — reference age, dependents, income, goals, risk tolerance where relevant):
${profileCtx}
` : ""}
Rules:
- Be specific — reference actual category names, percentages, and amounts from the data.
- Don't recommend specific ticker symbols; stay at asset-class level.
- Tone: neutral, not alarmist. Respect that the person has built real wealth.
- If allocation is already reasonable, say so; don't invent problems.
- Output ONLY the JSON object. Start with { and end with }. No backticks.`;

    try {
      let raw;
      const endpoint = window.STRATA_AI_ENDPOINT;
      const body = {
        model: "claude-haiku-4-5",
        max_tokens: 1200,
        messages: [{ role: "user", content: prompt }],
      };

      if (endpoint && /^https?:\/\//.test(endpoint)) {
        const r = await fetch(endpoint.replace(/\/$/, "") + "/v1/messages", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!r.ok) throw new Error("Worker " + r.status + ": " + await r.text());
        const j = await r.json();
        raw = (j.content?.[0]?.text) || "";
      } else if (window.ANTHROPIC_API_KEY && window.ANTHROPIC_API_KEY.startsWith("sk-")) {
        const r = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "x-api-key": window.ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
            "anthropic-dangerous-direct-browser-access": "true",
            "content-type": "application/json",
          },
          body: JSON.stringify(body),
        });
        if (!r.ok) throw new Error("Anthropic API: " + r.status + " " + await r.text());
        const j = await r.json();
        raw = (j.content?.[0]?.text) || "";
      } else if (window.claude?.complete) {
        raw = await window.claude.complete(prompt);
      } else {
        throw new Error("No AI endpoint configured. Set window.STRATA_AI_ENDPOINT (Worker URL) or window.ANTHROPIC_API_KEY in index.html — see DEPLOY.md.");
      }

      const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
      const parsed = JSON.parse(cleaned);
      setData(parsed);
      setState("ok");
    } catch (e) {
      console.error(e);
      setError(e.message || "Couldn't reach the analysis service.");
      setState("error");
    }
  }

  return (
    <div style={{
      position: "fixed", inset: 0, background: "color-mix(in oklab, var(--bg) 80%, transparent)",
      backdropFilter: "blur(8px)",
      zIndex: 50, display: "grid", placeItems: "start center", padding: "40px 20px", overflowY: "auto",
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        width: "min(820px, 100%)",
        background: "var(--bg-1)",
        border: "1px solid var(--line)",
        borderRadius: 16,
        padding: 0,
        boxShadow: "0 30px 80px -20px rgba(0,0,0,0.5)",
      }}>
        <div style={{padding: "20px 26px", borderBottom: "1px solid var(--line)", display:"flex", alignItems:"center", gap: 12}}>
          <span style={{
            width: 32, height: 32, borderRadius: 10, display:"grid", placeItems:"center",
            background: "linear-gradient(135deg, var(--accent), color-mix(in oklab, var(--accent) 60%, var(--up)))",
            color: "var(--bg)",
          }}><I.Bolt/></span>
          <div>
            <div className="eyebrow">AI allocation review</div>
            <div style={{fontSize: 18, marginTop: 2}}>Portfolio analysis</div>
          </div>
          <div style={{marginLeft:"auto", display:"flex", gap: 8}}>
            {state === "ok" && <button className="btn" onClick={run}>Regenerate</button>}
            <button className="btn" onClick={onClose}>Close</button>
          </div>
        </div>

        <div style={{padding: 26}}>
          {state === "loading" && <LoadingPulse/>}
          {state === "error" && (
            <div>
              <div style={{fontSize: 15}}>Couldn't generate analysis.</div>
              <div className="muted" style={{fontSize: 13, marginTop: 8}}>{error}</div>
              <button className="btn" style={{marginTop: 14}} onClick={run}>Try again</button>
            </div>
          )}
          {state === "ok" && data && <AnalyseContent data={data}/>}
        </div>
      </div>
    </div>
  );
}

function LoadingPulse() {
  const messages = [
    "Reading your allocation…",
    "Weighing concentration risk…",
    "Comparing to balanced benchmarks…",
    "Drafting recommendations…",
  ];
  const [i, setI] = React.useState(0);
  React.useEffect(() => {
    const t = setInterval(() => setI(x => (x + 1) % messages.length), 1400);
    return () => clearInterval(t);
  }, []);
  return (
    <div style={{padding: "28px 0"}}>
      <div style={{display:"flex", alignItems:"center", gap: 14}}>
        <div style={{
          width: 10, height: 10, borderRadius: 50, background: "var(--accent)",
          animation: "strata-pulse 1.2s ease-in-out infinite",
        }}/>
        <div style={{fontSize: 15}}>{messages[i]}</div>
      </div>
      <style>{`@keyframes strata-pulse { 0%,100% { opacity: .25; transform: scale(1); } 50% { opacity: 1; transform: scale(1.25); } }`}</style>
      <div style={{marginTop: 28, display:"flex", flexDirection:"column", gap: 10}}>
        {[...Array(4)].map((_, k) => (
          <div key={k} style={{height: 14, borderRadius: 4, background: "var(--bg-2)", width: `${85 - k * 12}%`, opacity: 0.6}}/>
        ))}
      </div>
    </div>
  );
}

function AnalyseContent({ data }) {
  const score = Math.max(0, Math.min(10, Number(data.score) || 0));
  return (
    <div style={{display:"flex", flexDirection:"column", gap: 22}}>
      <div style={{display: "grid", gridTemplateColumns: "auto 1fr", gap: 22, alignItems: "center"}}>
        <ScoreRing value={score}/>
        <div>
          <div className="eyebrow">{data.score_label || "Portfolio score"}</div>
          <div style={{fontSize: 19, marginTop: 6, lineHeight: 1.4}}>{data.headline}</div>
        </div>
      </div>

      {Array.isArray(data.observations) && data.observations.length > 0 && (
        <Section title="What I notice">
          <ul style={{margin: 0, paddingLeft: 18, color: "var(--ink-2)", fontSize: 14, lineHeight: 1.65}}>
            {data.observations.map((o, i) => <li key={i} style={{marginBottom: 6}}>{o}</li>)}
          </ul>
        </Section>
      )}

      {Array.isArray(data.risks) && data.risks.length > 0 && (
        <Section title="Risks to consider">
          <div style={{display:"flex", flexDirection:"column", gap: 10}}>
            {data.risks.map((r, i) => (
              <div key={i} style={{
                padding: "12px 14px",
                background: "var(--bg-2)",
                border: "1px solid var(--line)",
                borderLeft: "3px solid var(--down)",
                borderRadius: 8,
              }}>
                <div style={{fontSize: 14, fontWeight: 500}}>{r.title}</div>
                <div className="muted" style={{fontSize: 13, marginTop: 4, lineHeight: 1.5}}>{r.detail}</div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {Array.isArray(data.suggestions) && data.suggestions.length > 0 && (
        <Section title="Suggestions">
          <div style={{display:"flex", flexDirection:"column", gap: 10}}>
            {data.suggestions.map((s, i) => {
              const tone = s.priority === "high" ? "var(--down)" : s.priority === "low" ? "var(--ink-3)" : "var(--accent)";
              return (
                <div key={i} style={{
                  padding: "14px 16px",
                  background: "var(--bg-2)",
                  border: "1px solid var(--line)",
                  borderRadius: 10,
                  display: "grid",
                  gridTemplateColumns: "auto 1fr",
                  gap: 14,
                  alignItems: "start",
                }}>
                  <span style={{
                    fontSize: 10, fontFamily: "var(--mono)", textTransform: "uppercase",
                    letterSpacing: "0.08em", padding: "3px 8px", borderRadius: 50,
                    background: `color-mix(in oklab, ${tone} 16%, transparent)`,
                    color: tone, alignSelf: "start", marginTop: 2,
                  }}>{s.priority || "medium"}</span>
                  <div>
                    <div style={{fontSize: 14, fontWeight: 500}}>{s.title}</div>
                    <div className="muted" style={{fontSize: 13, marginTop: 4, lineHeight: 1.55}}>{s.detail}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      <div style={{fontSize: 11, color: "var(--ink-4)", borderTop: "1px solid var(--line)", paddingTop: 14, lineHeight: 1.6}}>
        {data.disclaimer || "This analysis is for informational purposes only and is not financial advice. Consult a licensed advisor for personal decisions."}
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <div className="eyebrow" style={{marginBottom: 10}}>{title}</div>
      {children}
    </div>
  );
}

function ScoreRing({ value }) {
  const size = 96, stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = value / 10;
  const color = value >= 7 ? "var(--up)" : value >= 4 ? "var(--accent)" : "var(--down)";
  return (
    <div style={{position: "relative", width: size, height: size}}>
      <svg width={size} height={size} style={{transform: "rotate(-90deg)"}}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--line)" strokeWidth={stroke}/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
                strokeDasharray={`${c * pct} ${c}`} strokeLinecap="round"/>
      </svg>
      <div style={{position:"absolute", inset: 0, display:"grid", placeItems:"center", textAlign:"center"}}>
        <div>
          <div style={{fontSize: 26, fontFamily: "var(--mono)", lineHeight: 1}}>{value.toFixed(1)}</div>
          <div style={{fontSize: 10, color: "var(--ink-4)", marginTop: 2}}>/ 10</div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { AnalysePanel, AnalyseContent, ScoreRing, LoadingPulse });
