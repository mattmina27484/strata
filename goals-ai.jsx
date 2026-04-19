/* Goals AI integration — function calling for Strata AI.
   Exposes window.goalsAI with:
     - buildGoalsContext()   : string to inject into system prompt
     - parseToolCalls(text)  : extract <tool_use> JSON blocks from assistant text
     - executeToolCall(call) : perform the write after user confirms
     - suggestGoals()        : one-shot — ask Claude to propose starter goals from profile + portfolio
*/

(function() {
  function describeGoalKind(kind) {
    const map = {
      networth: "Net worth target",
      category: "Category target",
      holdings: "Specific holdings target",
      liability: "Debt paydown target",
      emergency: "Emergency fund",
      freeform: "Free-form goal",
    };
    return map[kind] || kind || "Goal";
  }

  function resolveHoldingNames(goal) {
    const assets = window.ASSETS || [];
    const selected = Array.isArray(goal.holdings) ? goal.holdings : [];
    return selected.map(h => {
      if (typeof h === "string") {
        const a = assets.find(x => x.id === h);
        return a ? `${a.name}${a.sym ? ` (${a.sym})` : ""}` : h;
      }
      if (typeof h === "object" && h) {
        return [h.name, h.sym].filter(Boolean).join(" ").trim();
      }
      return "";
    }).filter(Boolean);
  }

  function resolveLiabilityName(goal) {
    if (!goal.liability_id) return "";
    const a = (window.ASSETS || []).find(x => x.id === goal.liability_id);
    return a ? a.name : goal.liability_id;
  }

  function buildGoalsContext() {
    const goals = (window.goalsStore?.list(false) || []);
    if (!goals.length) {
      return `# The user's goals
The user has not set any goals yet.
You should still help them, but where appropriate you can suggest creating goals with specific target amounts and dates.`;
    }

    const lines = [];
    const completed = goals.filter(g => !!g.completed_at).length;
    const active = goals.length - completed;

    lines.push("# The user's goals");
    lines.push(`Total goals: ${goals.length}`);
    lines.push(`Active goals: ${active}`);
    if (completed) lines.push(`Completed goals: ${completed}`);
    lines.push("");

    goals.forEach((g, idx) => {
      const p = window.goalsStore.computeProgress(g);
      const pct = (p.pct * 100).toFixed(0);
      const remaining = Math.max(0, (Number(p.target) || 0) - (Number(p.current) || 0));
      const categoryName = g.category ? (window.getCategory(g.category)?.name || g.category) : "";
      const holdings = resolveHoldingNames(g);
      const liabilityName = resolveLiabilityName(g);

      lines.push(`## Goal ${idx + 1}`);
      lines.push(`ID: ${g.id}`);
      lines.push(`Title: ${g.title}`);
      lines.push(`Type: ${describeGoalKind(g.kind)}`);
      if (g.priority) lines.push(`Priority: ${g.priority}`);
      if (g.target_date) lines.push(`Target date: ${g.target_date}`);
      if (g.completed_at) lines.push(`Completed at: ${g.completed_at}`);
      lines.push(`Target amount: ${formatMoney(Number(p.target) || 0, { compact: true })}`);
      lines.push(`Current progress: ${formatMoney(Number(p.current) || 0, { compact: true })}`);
      lines.push(`Progress percent: ${pct}%`);
      lines.push(`Remaining to target: ${formatMoney(remaining, { compact: true })}`);

      if (g.kind === "category" && categoryName) {
        lines.push(`Tracked category: ${categoryName}`);
      }

      if (g.kind === "holdings" && holdings.length) {
        lines.push(`Tracked holdings: ${holdings.join(", ")}`);
      }

      if (g.kind === "liability" && liabilityName) {
        lines.push(`Tracked liability: ${liabilityName}`);
        if (g.start_balance) {
          lines.push(`Starting balance: ${formatMoney(Number(g.start_balance) || 0, { compact: true })}`);
        }
      }

      if (p.autoTracked) {
        lines.push(`Auto-tracked component: ${formatMoney(Number(p.autoCurrent) || 0, { compact: true })}`);
      }

      if (p.manual) {
        lines.push(`Manual logged contributions: ${formatMoney(Number(p.manual) || 0, { compact: true })}`);
      }

      const contributions = Array.isArray(g.contributions) ? [...g.contributions] : [];
      if (contributions.length) {
        const recent = contributions
          .sort((a, b) => String(b.date || b.ts || "").localeCompare(String(a.date || a.ts || "")))
          .slice(0, 3)
          .map(c => {
            const amount = formatMoney(Number(c.amount) || 0, { compact: true, showSign: true });
            const date = c.date || "";
            const note = c.note ? ` — ${c.note}` : "";
            return `${date}: ${amount}${note}`;
          });
        lines.push(`Recent contributions: ${recent.join(" | ")}`);
      }

      if (g.notes) {
        lines.push(`Notes: ${g.notes}`);
      }

      lines.push("");
    });

    lines.push("When advising, treat these goals as an important part of the user's decision-making. Reference them explicitly when relevant.");

    return lines.join("\n");
  }

  const TOOL_INSTRUCTIONS = `
# Tool use — modifying goals
You can propose changes to the user's goals. ALWAYS propose, never silently commit. The app will show the user a confirmation card, and they must accept before anything changes.

To propose a tool call, emit EXACTLY this format on its own line:
<tool_use>
{"tool":"create_goal","args":{"kind":"category","title":"Build shares to $1M","target":1000000,"target_date":"2032-12-31","category":"stocks","priority":"med","notes":"Long-term ETF accumulation"}}
</tool_use>

Available tools:
- create_goal: args = {kind, title, target, target_date?, priority?, category?, notes?, holdings?, liability_id?}
  - kind must be one of: networth, category, holdings, liability, emergency, freeform
  - category (if kind=category) must be one of: stocks, property, retirement, business, crypto, cash, bonds, private, metals, collect, vehicles
  - priority: "high" | "med" | "low"
- edit_goal: args = {id, title?, target?, target_date?, priority?, notes?, category?}
- log_contribution: args = {id, amount, date?, note?}
- delete_goal: args = {id}

You can emit multiple tool_use blocks in one response. Briefly explain WHY above each tool_use so the user understands the proposal.`;

  function parseToolCalls(text) {
    if (!text) return [];
    const calls = [];
    const re = /<tool_use>\s*([\s\S]*?)\s*<\/tool_use>/g;
    let m;
    while ((m = re.exec(text)) !== null) {
      try {
        const j = JSON.parse(m[1]);
        if (j && j.tool) calls.push({ raw: m[0], tool: j.tool, args: j.args || {} });
      } catch (_) {}
    }
    return calls;
  }

  function stripToolCalls(text) {
    return (text || "").replace(/<tool_use>[\s\S]*?<\/tool_use>/g, "").replace(/\n{3,}/g, "\n\n").trim();
  }

  function executeToolCall(call) {
    const { tool, args } = call;
    if (tool === "create_goal") {
      const g = window.goalsStore.create({
        kind: args.kind || "freeform",
        title: args.title || "Untitled",
        target: Number(args.target) || 0,
        target_date: args.target_date || "",
        priority: window.goalsStore.parsePriorityOrMed(args.priority),
        category: args.category || null,
        holdings: args.holdings || [],
        liability_id: args.liability_id || null,
        notes: args.notes || "",
      });
      return { ok: true, message: `Created goal "${g.title}"`, goalId: g.id };
    }
    if (tool === "edit_goal") {
      const existing = window.goalsStore.get(args.id);
      if (!existing) return { ok: false, message: "Goal not found." };
      const patch = {};
      ["title","target","target_date","priority","notes","category"].forEach(k => {
        if (args[k] !== undefined) patch[k] = k === "target" ? Number(args[k]) : args[k];
      });
      if (patch.priority) patch.priority = window.goalsStore.parsePriorityOrMed(patch.priority);
      window.goalsStore.update(args.id, patch);
      return { ok: true, message: `Updated "${existing.title}"`, goalId: args.id };
    }
    if (tool === "log_contribution") {
      const g = window.goalsStore.get(args.id);
      if (!g) return { ok: false, message: "Goal not found." };
      window.goalsStore.addContribution(args.id, {
        amount: Number(args.amount) || 0,
        date: args.date,
        note: args.note,
      });
      return { ok: true, message: `Logged ${formatMoney(Number(args.amount)||0)} to "${g.title}"`, goalId: args.id };
    }
    if (tool === "delete_goal") {
      const g = window.goalsStore.get(args.id);
      if (!g) return { ok: false, message: "Goal not found." };
      window.goalsStore.remove(args.id);
      return { ok: true, message: `Deleted "${g.title}"` };
    }
    return { ok: false, message: "Unknown tool: " + tool };
  }

  async function completeWithStrataAI(prompt) {
    const endpoint = window.STRATA_AI_ENDPOINT;
    const apiKey = window.ANTHROPIC_API_KEY;

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
      return (j.content?.[0]?.text) || "";
    }

    if (apiKey && apiKey.startsWith("sk-")) {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error("Anthropic API: " + r.status + " " + await r.text());
      const j = await r.json();
      return (j.content?.[0]?.text) || "";
    }

    if (window.claude?.complete) {
      return await window.claude.complete(prompt);
    }

    throw new Error("No AI endpoint configured. Set window.STRATA_AI_ENDPOINT or window.ANTHROPIC_API_KEY in index.html.");
  }

  async function suggestGoals() {
    const cats = (window.CATEGORY_TOTALS || []).filter(c => c.count > 0);
    const net = window.NET_WORTH || 0;
    const profile = (window.profileSummary && window.profileSummary()) || "(no profile provided)";
    const goals = buildGoalsContext();

    const prompt = `You are a wealth advisor. Suggest 4 meaningful, specific financial goals tailored to this user. Return STRICT JSON only — an array of goal objects. No prose, no markdown.

User profile:
${profile}

Current portfolio:
- Net worth: ${formatMoney(net)}
- Categories: ${cats.map(c => `${c.name} ${formatMoney(c.total, {compact: true})}`).join(", ") || "(empty)"}

Existing goals:
${goals}

Goal object shape:
{ "kind": "networth|category|holdings|liability|emergency|freeform", "title": "short goal title", "target": number, "target_date": "YYYY-MM-DD", "priority": "high|med|low", "category": "stocks|property|retirement|business|crypto|cash|bonds|private|metals|collect|vehicles|null", "notes": "why this matters" }

Rules:
- Make targets realistic given their current position.
- Do not duplicate existing goals.
- Set target_date 1-10 years out depending on goal size.
- Mix priorities (at least one high, one low).
- For emergency fund use kind=emergency and category=null.
- For mortgage/debt use kind=liability.
- Output ONLY the JSON array, starting with [ and ending with ].`;

    const text = await completeWithStrataAI(prompt);
    const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
    const match = cleaned.match(/\[[\s\S]*\]/);
    if (!match) throw new Error("Couldn't parse AI response.");
    const arr = JSON.parse(match[0]);
    return arr.map(a => ({
      kind: a.kind || "freeform",
      title: a.title || "Untitled",
      target: Number(a.target) || 0,
      target_date: a.target_date || "",
      priority: window.goalsStore.parsePriorityOrMed(a.priority),
      category: a.category || null,
      notes: a.notes || "",
    }));
  }

  window.goalsAI = {
    buildGoalsContext,
    TOOL_INSTRUCTIONS,
    parseToolCalls,
    stripToolCalls,
    executeToolCall,
    suggestGoals,
  };
})();

/* ---- Tool confirmation card (used inside Strata AI chat) ---- */

function ToolProposalCard({ call, onApplied }) {
  const [state, setState] = React.useState("pending");
  const [result, setResult] = React.useState(null);
  const { tool, args } = call;

  const apply = () => {
    const r = window.goalsAI.executeToolCall(call);
    setResult(r);
    setState(r.ok ? "applied" : "error");
    onApplied?.(r);
  };

  const reject = () => setState("rejected");

  const labels = {
    create_goal: "Create goal",
    edit_goal: "Edit goal",
    log_contribution: "Log contribution",
    delete_goal: "Delete goal",
  };

  const rows = [];
  if (args.title) rows.push(["Title", args.title]);
  if (args.kind) rows.push(["Type", window.goalsStore.KINDS[args.kind]?.label || args.kind]);
  if (args.target != null) rows.push(["Target", formatMoney(Number(args.target) || 0)]);
  if (args.amount != null) rows.push(["Amount", formatMoney(Number(args.amount) || 0)]);
  if (args.target_date) rows.push(["By", args.target_date]);
  if (args.date) rows.push(["Date", args.date]);
  if (args.category) rows.push(["Category", window.getCategory(args.category)?.name || args.category]);
  if (args.priority) rows.push(["Priority", args.priority]);
  if (args.note) rows.push(["Note", args.note]);
  if (args.notes) rows.push(["Notes", args.notes]);
  if (tool === "edit_goal" || tool === "delete_goal" || tool === "log_contribution") {
    const g = args.id && window.goalsStore.get(args.id);
    if (g) rows.unshift(["Goal", g.title]);
  }

  const borderColor = state === "applied" ? "var(--up)" :
                      state === "rejected" ? "var(--ink-4)" :
                      state === "error" ? "var(--down)" : "var(--accent)";

  return (
    <div style={{
      margin: "14px 0",
      background: "var(--bg-2)",
      border: "1px solid " + (state === "pending" ? "color-mix(in oklab, var(--accent) 40%, var(--line))" : "var(--line)"),
      borderLeft: "3px solid " + borderColor,
      borderRadius: 12,
      overflow: "hidden",
    }}>
      <div style={{padding: "12px 16px", display:"flex", alignItems:"center", gap: 10, borderBottom: "1px solid var(--line)"}}>
        <span style={{
          fontSize: 10, fontFamily:"var(--mono)", letterSpacing:"0.1em", textTransform:"uppercase",
          color: state === "applied" ? "var(--up)" : state === "error" ? "var(--down)" : "var(--accent)",
        }}>
          {state === "applied" ? "✓ Applied" : state === "rejected" ? "Dismissed" : state === "error" ? "Error" : "Proposed action"}
        </span>
        <span style={{fontSize: 13, fontWeight: 500}}>{labels[tool] || tool}</span>
      </div>
      <div style={{padding: "12px 16px"}}>
        <div style={{display:"grid", gridTemplateColumns:"100px 1fr", gap: "6px 14px", fontSize: 13}}>
          {rows.map(([k, v], i) => (
            <React.Fragment key={i}>
              <div style={{color:"var(--ink-3)", fontFamily:"var(--mono)", fontSize: 11, textTransform:"uppercase", letterSpacing:"0.06em", alignSelf:"center"}}>{k}</div>
              <div style={{color:"var(--ink)", overflow:"hidden", textOverflow:"ellipsis"}}>{String(v)}</div>
            </React.Fragment>
          ))}
        </div>
        {state === "pending" && (
          <div style={{display:"flex", gap: 8, marginTop: 14, justifyContent:"flex-end"}}>
            <button className="btn" onClick={reject}>Dismiss</button>
            <button className="btn primary" onClick={apply}>
              {tool === "delete_goal" ? "Yes, delete" : "Apply"}
            </button>
          </div>
        )}
        {state === "applied" && result && (
          <div style={{marginTop: 10, fontSize: 12, color:"var(--up)"}}>
            {result.message}
          </div>
        )}
        {state === "error" && result && (
          <div style={{marginTop: 10, fontSize: 12, color:"var(--down)"}}>
            {result.message}
          </div>
        )}
      </div>
    </div>
  );
}

window.ToolProposalCard = ToolProposalCard;
