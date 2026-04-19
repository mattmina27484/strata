/* Goals AI integration — function calling for Strata AI.
   Exposes window.goalsAI with:
     - buildGoalsContext()   : string to inject into system prompt
     - parseToolCalls(text)  : extract <tool_use> JSON blocks from assistant text
     - executeToolCall(call) : perform the write after user confirms
     - suggestGoals()        : one-shot — ask Claude to propose starter goals from profile + portfolio
*/

(function() {
  function buildGoalsContext() {
    const goals = (window.goalsStore?.list(false) || []);
    if (!goals.length) return "# Goals\n(The user has not set any goals yet. You can suggest goals or offer to create them.)\n";
    const lines = goals.map(g => {
      const p = window.goalsStore.computeProgress(g);
      const pct = (p.pct * 100).toFixed(0);
      const dateStr = g.target_date ? ` by ${g.target_date}` : "";
      const cat = g.category ? ` [${g.category}]` : "";
      return `- (id: ${g.id}) "${g.title}" — ${g.kind}${cat} · ${formatMoney(p.current, { compact: true })} / ${formatMoney(g.target, { compact: true })} (${pct}%)${dateStr} · priority=${g.priority}`;
    }).join("\n");
    return `# The user's active goals\n${lines}\n`;
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

  /* One-shot suggest via built-in claude helper. */
  async function suggestGoals() {
    if (!window.claude?.complete) throw new Error("Claude helper unavailable.");
    const cats = (window.CATEGORY_TOTALS || []).filter(c => c.count > 0);
    const net = window.NET_WORTH || 0;
    const profile = (window.profileSummary && window.profileSummary()) || "(no profile provided)";
    const prompt = `You are a wealth advisor. Suggest 4 meaningful, specific financial goals tailored to this user. Return STRICT JSON only — an array of goal objects. No prose, no markdown.

User profile:
${profile}

Current portfolio:
- Net worth: ${formatMoney(net)}
- Categories: ${cats.map(c => `${c.name} ${formatMoney(c.total, {compact: true})}`).join(", ") || "(empty)"}

Goal object shape:
{ "kind": "networth|category|holdings|liability|emergency|freeform", "title": "short goal title", "target": number, "target_date": "YYYY-MM-DD", "priority": "high|med|low", "category": "stocks|property|retirement|business|crypto|cash|bonds|private|metals|collect|vehicles|null", "notes": "why this matters" }

Rules:
- Make targets realistic given their current position.
- Set target_date 1-10 years out depending on goal size.
- Mix priorities (at least one high, one low).
- For emergency fund use kind=emergency and category=null.
- For mortgage/debt use kind=liability.
- Output ONLY the JSON array, starting with [ and ending with ].`;

    const text = await window.claude.complete(prompt);
    const match = text.match(/\[[\s\S]*\]/);
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
  const [state, setState] = React.useState("pending"); // pending | applied | rejected | error
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
