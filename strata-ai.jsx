/* Strata AI — chat screen.
   Personal wealth advisor powered by Claude.
   System prompt + portfolio + profile + goals are injected on every turn.
   Conversation history persists in localStorage. */

(function() {
  const KEY_CONV = "strata.ai.conversations.v1";
  const KEY_ACTIVE = "strata.ai.activeConversation";

  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(36).slice(2));

  function readConvs() {
    try { return JSON.parse(localStorage.getItem(KEY_CONV)) || []; }
    catch { return []; }
  }
  function writeConvs(list) { localStorage.setItem(KEY_CONV, JSON.stringify(list)); }
  function getActiveId() { return localStorage.getItem(KEY_ACTIVE) || null; }
  function setActiveId(id) {
    if (id) localStorage.setItem(KEY_ACTIVE, id);
    else localStorage.removeItem(KEY_ACTIVE);
  }

  function createConv() {
    const c = { id: uid(), title: "New chat", messages: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    const list = readConvs();
    list.unshift(c);
    writeConvs(list);
    setActiveId(c.id);
    return c;
  }

  function updateConv(id, patch) {
    const list = readConvs();
    const i = list.findIndex(c => c.id === id);
    if (i < 0) return;
    list[i] = { ...list[i], ...patch, updatedAt: new Date().toISOString() };
    writeConvs(list);
  }

  function deleteConv(id) {
    writeConvs(readConvs().filter(c => c.id !== id));
    if (getActiveId() === id) setActiveId(null);
  }

  window.strataChat = { readConvs, writeConvs, getActiveId, setActiveId, createConv, updateConv, deleteConv };
})();

/* ---- Context builders ---- */

function buildSystemPrompt() {
  const ccy = (window.CURRENCIES?.[window.__APP_STATE?.currency] || window.CURRENCIES?.AUD || { code: "AUD", symbol: "$" });
  const cats = (window.CATEGORY_TOTALS || []).filter(c => c.count > 0);
  const positive = cats.filter(c => !c.negative).reduce((s, c) => s + c.total, 0);
  const liabilities = cats.filter(c => c.negative).reduce((s, c) => s + Math.abs(c.total), 0);
  const net = window.NET_WORTH || 0;

  const byCat = cats.map(c => {
    const pct = positive > 0 ? ((Math.abs(c.total) / positive) * 100).toFixed(1) : "0";
    const holdings = (window.ASSETS || [])
      .filter(a => a.cat === c.id)
      .map(a => `    - ${a.name}${a.sub ? ` (${a.sub})` : ""}: ${ccy.symbol}${Math.round((a.value || 0) * (ccy.rate || 1)).toLocaleString()}`)
      .join("\n");
    return `- ${c.name}: ${ccy.symbol}${Math.round(c.total * (ccy.rate || 1)).toLocaleString()} (${pct}% of assets, ${c.count} holdings)${holdings ? "\n" + holdings : ""}`;
  }).join("\n");

  const profileCtx = (window.profileSummary && window.profileSummary()) || "";
  const goalsCtx = (window.goalsAI && window.goalsAI.buildGoalsContext && window.goalsAI.buildGoalsContext()) || "";
  const toolInstr = (window.goalsAI && window.goalsAI.TOOL_INSTRUCTIONS) || "";
  const today = new Date().toISOString().slice(0, 10);

  return `You are Strata AI — a personal wealth advisor built into the user's net worth tracking app. You have direct access to their portfolio, profile, and goals. Your job is to help them understand, improve, and grow their wealth.

# Today's date
${today}

# The user's current portfolio (currency: ${ccy.code})
- Net worth: ${ccy.symbol}${Math.round(net * (ccy.rate || 1)).toLocaleString()}
- Total assets: ${ccy.symbol}${Math.round(positive * (ccy.rate || 1)).toLocaleString()}
- Total liabilities: ${ccy.symbol}${Math.round(liabilities * (ccy.rate || 1)).toLocaleString()}

## Breakdown by category
${byCat || "(No assets added yet.)"}

${profileCtx ? `# About the user\n${profileCtx}\n` : "# About the user\n(No profile filled in yet — gently suggest they complete their Profile for better advice.)\n"}

${goalsCtx ? `${goalsCtx}\n` : "# The user's goals\n(No goals saved yet.)\n"}

${toolInstr}

# How to behave
- Be **specific** and **personal** — reference their actual numbers, category names, holdings, age, profile, and goals. Generic advice is useless.
- If goals exist, use them actively when giving recommendations. Prioritise advice based on what best helps the user progress toward those goals.
- If the user expresses an intention that clearly maps to a financial goal, you should proactively propose creating or updating a goal using a tool_use block.
- Speak plainly. No jargon without explaining it. Conversational, confident, never preachy.
- When asked for recommendations, be direct: say what you'd do and why, grounded in their situation.
- For forecasts, state your assumptions clearly (e.g. "assuming 7% nominal returns and $X/month contributions…") and show the math.
- If they ask for current market data, news, or live prices: be honest that you don't have real-time market access in this version, but you can reason from general principles or from data they share with you.
- Stay at asset-class and strategy level. Don't recommend specific stock tickers or make promises about returns.
- Don't give regulated legal/tax/financial advice — instead help them think clearly and suggest they verify specifics with a qualified advisor when appropriate. Mention this lightly, once, only when it actually matters.
- Format responses with markdown: use **bold** for emphasis, bullet lists for options, and short paragraphs. Use headings (##) only for longer responses with multiple sections.
- Keep it tight. Don't pad.`;
}

/* ---- Streaming call to Anthropic ---- */

async function streamChat(messages, onDelta, onDone, onError) {
  const endpoint = window.STRATA_AI_ENDPOINT;
  const apiKey = window.ANTHROPIC_API_KEY;
  const systemPrompt = buildSystemPrompt();

  const body = {
    model: "claude-haiku-4-5",
    max_tokens: 1600,
    system: systemPrompt,
    stream: true,
    messages: messages.map(m => ({ role: m.role, content: m.content })),
  };

  if (endpoint && /^https?:\/\//.test(endpoint)) {
    try {
      const r = await fetch(endpoint.replace(/\/$/, "") + "/v1/messages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error("Worker " + r.status + ": " + await r.text());
      await consumeSSE(r, onDelta);
      onDone();
      return;
    } catch (e) {
      onError(e); return;
    }
  }

  if (apiKey && apiKey.startsWith("sk-")) {
    try {
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
      if (!r.ok) throw new Error("Anthropic API " + r.status + ": " + await r.text());
      await consumeSSE(r, onDelta);
      onDone();
      return;
    } catch (e) {
      onError(e); return;
    }
  }

  if (window.claude?.complete) {
    try {
      const full = await window.claude.complete({
        messages: [{ role: "user", content: systemPrompt + "\n\n---\n\n" + messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join("\n\n") }],
      });
      const words = full.split(/(\s+)/);
      for (const w of words) { onDelta(w); await new Promise(r => setTimeout(r, 12)); }
      onDone();
      return;
    } catch (e) {
      onError(e); return;
    }
  }

  onError(new Error("No API key configured. Add window.STRATA_AI_ENDPOINT or window.ANTHROPIC_API_KEY in index.html."));
}

async function consumeSSE(response, onDelta) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop();
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      try {
        const j = JSON.parse(data);
        if (j.type === "content_block_delta" && j.delta?.type === "text_delta") {
          onDelta(j.delta.text || "");
        }
      } catch {}
    }
  }
}

/* ---- Simple markdown renderer ---- */

function renderMarkdown(text) {
  if (!text) return "";
  let t = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  t = t.replace(/```([\s\S]*?)```/g, (_, code) => `<pre class="md-code">${code}</pre>`);
  t = t.replace(/`([^`\n]+)`/g, '<code class="md-ic">$1</code>');
  t = t.replace(/^###\s+(.+)$/gm, '<h4 class="md-h">$1</h4>');
  t = t.replace(/^##\s+(.+)$/gm, '<h3 class="md-h">$1</h3>');
  t = t.replace(/^#\s+(.+)$/gm, '<h2 class="md-h">$1</h2>');
  t = t.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
  t = t.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");

  const lines = t.split("\n");
  const out = [];
  let inUL = false, inOL = false;
  const closeLists = () => {
    if (inUL) { out.push("</ul>"); inUL = false; }
    if (inOL) { out.push("</ol>"); inOL = false; }
  };

  for (const raw of lines) {
    const ul = /^\s*[-*]\s+(.+)$/.exec(raw);
    const ol = /^\s*\d+\.\s+(.+)$/.exec(raw);
    if (ul) {
      if (!inUL) { closeLists(); out.push('<ul class="md-ul">'); inUL = true; }
      out.push(`<li>${ul[1]}</li>`);
    } else if (ol) {
      if (!inOL) { closeLists(); out.push('<ol class="md-ol">'); inOL = true; }
      out.push(`<li>${ol[1]}</li>`);
    } else {
      closeLists();
      if (raw.trim() === "") out.push("");
      else out.push(raw);
    }
  }
  closeLists();

  const joined = out.join("\n");
  const paras = joined.split(/\n{2,}/).map(block => {
    if (/^\s*<(ul|ol|pre|h2|h3|h4)/.test(block)) return block;
    if (block.trim() === "") return "";
    return `<p>${block.replace(/\n/g, "<br/>")}</p>`;
  });
  return paras.join("\n");
}

/* ---- UI ---- */

const SUGGESTED_PROMPTS = [
  { title: "Review my allocation", body: "Review my current allocation. Where am I over-concentrated, where am I light, and what would you rebalance first?" },
  { title: "Am I on track for retirement?", body: "Given my age, income, target retirement age, and current net worth, am I on track? What would I need to change to hit my target?" },
  { title: "Biggest risks right now", body: "What are the top 3 risks in my current portfolio given my situation, and how would you mitigate each?" },
  { title: "Next $10k — where?", body: "If I had $10,000 to invest right now, given my current allocation and goals, where would you put it and why?" },
  { title: "Stress-test my plan", body: "Walk me through how my portfolio would likely behave in a recession, a high-inflation environment, and a prolonged bear market. What would I do in each?" },
  { title: "Explain my biggest holding", body: "Tell me about my single largest holding — what's good about it, what the risks are, and whether I'm over-exposed." },
  { title: "Check my goals", body: "List every goal currently saved in my app, show progress on each one, and tell me which single goal should be my highest priority right now and why." },
];

function StrataAIScreen() {
  const [convs, setConvs] = React.useState(() => window.strataChat.readConvs());
  const [activeId, setActive] = React.useState(() => window.strataChat.getActiveId());
  const [input, setInput] = React.useState("");
  const [streaming, setStreaming] = React.useState(false);
  const [streamingText, setStreamingText] = React.useState("");
  const [error, setError] = React.useState("");
  const scrollRef = React.useRef(null);
  const inputRef = React.useRef(null);
  const abortRef = React.useRef(false);

  const active = convs.find(c => c.id === activeId);
  const messages = active?.messages || [];

  const refresh = () => setConvs(window.strataChat.readConvs());

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length, streamingText]);

  React.useEffect(() => {
    inputRef.current?.focus();
  }, [activeId]);

  React.useEffect(() => {
    const seededConvId = sessionStorage.getItem("strata.ai.autoSend");
    if (!seededConvId) return;
    sessionStorage.removeItem("strata.ai.autoSend");
    const list = window.strataChat.readConvs();
    const conv = list.find(c => c.id === seededConvId);
    if (!conv || !conv.messages.length) return;
    const firstMsg = conv.messages[0];
    if (!firstMsg?.pending) return;

    const cleanedMessages = [{ ...firstMsg, pending: false }];
    window.strataChat.updateConv(seededConvId, { messages: cleanedMessages });
    window.strataChat.setActiveId(seededConvId);
    setActive(seededConvId);
    setConvs(window.strataChat.readConvs());

    setStreaming(true);
    setStreamingText("");
    let accumulated = "";
    abortRef.current = false;

    streamChat(
      cleanedMessages,
      (delta) => { if (abortRef.current) return; accumulated += delta; setStreamingText(accumulated); },
      () => {
        const assistantMsg = { id: "m" + Date.now(), role: "assistant", content: accumulated, ts: new Date().toISOString() };
        window.strataChat.updateConv(seededConvId, { messages: [...cleanedMessages, assistantMsg] });
        setStreamingText("");
        setStreaming(false);
        setConvs(window.strataChat.readConvs());
      },
      (err) => {
        console.error(err);
        setError(err.message || "Something went wrong.");
        setStreaming(false);
        setStreamingText("");
      }
    );
  }, []);

  function newChat() {
    const c = window.strataChat.createConv();
    setActive(c.id);
    refresh();
    setInput("");
    setError("");
  }

  function selectChat(id) {
    window.strataChat.setActiveId(id);
    setActive(id);
    setError("");
  }

  function delChat(id, e) {
    e.stopPropagation();
    if (!confirm("Delete this conversation?")) return;
    window.strataChat.deleteConv(id);
    const list = window.strataChat.readConvs();
    setConvs(list);
    if (activeId === id) setActive(list[0]?.id || null);
  }

  async function send(text) {
    const content = (text ?? input).trim();
    if (!content || streaming) return;

    let convId = activeId;
    if (!convId) {
      const c = window.strataChat.createConv();
      convId = c.id;
      setActive(convId);
    }

    const userMsg = { id: "m" + Date.now(), role: "user", content, ts: new Date().toISOString() };
    const current = window.strataChat.readConvs().find(c => c.id === convId);
    const nextMessages = [...(current?.messages || []), userMsg];
    const title = current?.title === "New chat" || !current?.title
      ? content.slice(0, 50) + (content.length > 50 ? "…" : "")
      : current.title;

    window.strataChat.updateConv(convId, { messages: nextMessages, title });
    refresh();
    setInput("");
    setError("");
    setStreaming(true);
    setStreamingText("");

    let accumulated = "";
    abortRef.current = false;

    await streamChat(
      nextMessages,
      (delta) => {
        if (abortRef.current) return;
        accumulated += delta;
        setStreamingText(accumulated);
      },
      () => {
        const assistantMsg = { id: "m" + Date.now(), role: "assistant", content: accumulated, ts: new Date().toISOString() };
        window.strataChat.updateConv(convId, { messages: [...nextMessages, assistantMsg] });
        setStreamingText("");
        setStreaming(false);
        refresh();
      },
      (err) => {
        console.error(err);
        setError(err.message || "Something went wrong.");
        setStreaming(false);
        setStreamingText("");
      }
    );
  }

  function stop() {
    abortRef.current = true;
    if (streamingText.trim()) {
      const assistantMsg = { id: "m" + Date.now(), role: "assistant", content: streamingText + " [stopped]", ts: new Date().toISOString() };
      const current = window.strataChat.readConvs().find(c => c.id === activeId);
      window.strataChat.updateConv(activeId, { messages: [...(current?.messages || []), assistantMsg] });
      refresh();
    }
    setStreamingText("");
    setStreaming(false);
  }

  function onInputKey(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  const hasAssets = (window.ASSETS || []).length > 0;

  return (
    <div style={{
      height: "calc(100vh - 57px)",
      display: "grid",
      gridTemplateColumns: "260px 1fr",
      background: "var(--bg)",
    }}>
      <div style={{
        borderRight: "1px solid var(--line)",
        background: "var(--bg-1)",
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
      }}>
        <div style={{padding: "16px 14px", borderBottom: "1px solid var(--line)"}}>
          <button className="btn primary" style={{width:"100%", justifyContent:"center"}} onClick={newChat}>
            <I.Plus/> New chat
          </button>
        </div>

        <div style={{flex: 1, overflowY: "auto", padding: "8px 8px 16px"}}>
          {convs.length === 0 && (
            <div style={{padding: "16px 10px", fontSize: 12, color: "var(--ink-3)"}}>
              No conversations yet. Start a new chat.
            </div>
          )}

          {convs.map(c => (
            <div
              key={c.id}
              onClick={() => selectChat(c.id)}
              className="ai-conv-item"
              style={{
                padding: "10px 12px",
                margin: "2px 0",
                borderRadius: 8,
                cursor: "pointer",
                background: c.id === activeId ? "var(--bg-3)" : "transparent",
                display: "flex",
                alignItems: "center",
                gap: 8,
                transition: "background 120ms",
              }}
              onMouseEnter={e => { if (c.id !== activeId) e.currentTarget.style.background = "var(--bg-2)"; }}
              onMouseLeave={e => { if (c.id !== activeId) e.currentTarget.style.background = "transparent"; }}
            >
              <div style={{flex: 1, minWidth: 0}}>
                <div style={{
                  fontSize: 13,
                  color: c.id === activeId ? "var(--ink)" : "var(--ink-2)",
                  whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis",
                }}>{c.title}</div>
                <div style={{fontSize: 10, color: "var(--ink-4)", fontFamily:"var(--mono)", marginTop: 2}}>
                  {c.messages.length} msg{c.messages.length === 1 ? "" : "s"}
                </div>
              </div>

              <button
                className="ai-conv-del"
                onClick={(e) => delChat(c.id, e)}
                style={{
                  opacity: 0,
                  width: 22,
                  height: 22,
                  borderRadius: 6,
                  color: "var(--ink-3)",
                  display: "grid",
                  placeItems: "center",
                  transition: "opacity 120ms, color 120ms, background 120ms",
                }}
                title="Delete"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                </svg>
              </button>
            </div>
          ))}
        </div>
      </div>

      <div style={{display: "flex", flexDirection: "column", minHeight: 0, minWidth: 0}}>
        <div style={{
          padding: "14px 28px",
          borderBottom: "1px solid var(--line)",
          display: "flex",
          alignItems: "center",
          gap: 12,
          background: "var(--bg-1)",
        }}>
          <span style={{
            width: 28, height: 28, borderRadius: 8, display:"grid", placeItems:"center",
            background: "linear-gradient(135deg, var(--accent), color-mix(in oklab, var(--accent) 55%, #9bb8ff))",
            color: "var(--bg)",
          }}><I.Bolt/></span>
          <div>
            <div style={{fontFamily:"var(--serif)", fontStyle:"italic", fontSize: 18}}>Strata AI</div>
            <div style={{fontSize: 11, color:"var(--ink-3)", fontFamily:"var(--mono)", letterSpacing:"0.08em", textTransform:"uppercase"}}>
              Your wealth advisor · knows your portfolio, profile & goals
            </div>
          </div>
        </div>

        <div ref={scrollRef} style={{flex: 1, overflowY: "auto", padding: "28px 0"}}>
          <div style={{maxWidth: 760, margin: "0 auto", padding: "0 28px"}}>
            {messages.length === 0 && !streaming && (
              <div>
                <div style={{textAlign:"center", padding: "40px 0 32px"}}>
                  <div style={{
                    width: 56, height: 56, borderRadius: 16, margin: "0 auto 18px",
                    background: "linear-gradient(135deg, var(--accent), color-mix(in oklab, var(--accent) 55%, #9bb8ff))",
                    display: "grid", placeItems: "center", color: "var(--bg)",
                  }}>
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L3 14h7l-1 8 11-13h-7l1-7z"/></svg>
                  </div>
                  <h2 style={{margin: "0 0 8px", fontFamily:"var(--serif)", fontStyle:"italic", fontSize: 36, fontWeight: 400, letterSpacing:"-0.01em"}}>
                    How can I help with your wealth?
                  </h2>
                  <div style={{color:"var(--ink-3)", fontSize: 14, maxWidth: 440, margin: "0 auto"}}>
                    I can see your portfolio, profile, and goals. Ask me anything about your allocation, priorities, risks, or next moves.
                  </div>
                </div>

                {!hasAssets && (
                  <div style={{
                    margin: "16px 0 24px",
                    padding: "14px 16px",
                    background: "var(--bg-2)",
                    border: "1px solid var(--line)",
                    borderRadius: 12,
                    fontSize: 13,
                    color: "var(--ink-2)",
                  }}>
                    <strong style={{color:"var(--ink)"}}>Tip:</strong> You haven't added any assets yet — my advice will be generic until you do.
                  </div>
                )}

                <div style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10}}>
                  {SUGGESTED_PROMPTS.map((p, i) => (
                    <button
                      key={i}
                      onClick={() => send(p.body)}
                      className="suggest-card"
                      style={{
                        textAlign: "left",
                        padding: "14px 16px",
                        background: "var(--bg-1)",
                        border: "1px solid var(--line)",
                        borderRadius: 12,
                        color: "var(--ink)",
                        transition: "background 120ms, border-color 120ms, transform 120ms",
                      }}
                    >
                      <div style={{fontSize: 13, fontWeight: 500, marginBottom: 4}}>{p.title}</div>
                      <div style={{fontSize: 12, color: "var(--ink-3)", lineHeight: 1.4}}>
                        {p.body.slice(0, 80)}{p.body.length > 80 ? "…" : ""}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map(m => <ChatMessage key={m.id} msg={m} />)}

            {streaming && streamingText && (
              <ChatMessage msg={{ role: "assistant", content: streamingText }} streaming />
            )}

            {streaming && !streamingText && (
              <div style={{padding: "16px 0", display:"flex", alignItems:"center", gap: 10, color:"var(--ink-3)", fontSize: 13}}>
                <span className="ai-dots"><span/><span/><span/></span>
                Thinking…
              </div>
            )}

            {error && (
              <div style={{
                margin: "12px 0",
                padding: "12px 14px",
                background: "var(--down-soft)",
                border: "1px solid color-mix(in oklab, var(--down) 30%, transparent)",
                borderRadius: 10,
                color: "var(--down)",
                fontSize: 13,
              }}>
                <strong>Error:</strong> {error}
              </div>
            )}
          </div>
        </div>

        <div style={{
          borderTop: "1px solid var(--line)",
          background: "var(--bg-1)",
          padding: "16px 28px 20px",
        }}>
          <div style={{maxWidth: 760, margin: "0 auto"}}>
            <div style={{
              display: "flex",
              alignItems: "flex-end",
              gap: 8,
              background: "var(--bg-2)",
              border: "1px solid var(--line-2)",
              borderRadius: 14,
              padding: "10px 10px 10px 14px",
              transition: "border-color 120ms",
            }}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={onInputKey}
                placeholder={messages.length === 0 ? "Ask about your portfolio, goals, risks, next moves…" : "Ask anything…"}
                rows={1}
                disabled={streaming}
                style={{
                  flex: 1,
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  color: "var(--ink)",
                  fontFamily: "var(--sans)",
                  fontSize: 14,
                  resize: "none",
                  padding: "6px 0",
                  maxHeight: 200,
                  lineHeight: 1.5,
                }}
                onInput={e => {
                  e.target.style.height = "auto";
                  e.target.style.height = Math.min(200, e.target.scrollHeight) + "px";
                }}
              />

              {streaming ? (
                <button
                  onClick={stop}
                  style={{
                    width: 36, height: 36, borderRadius: 10, display: "grid", placeItems: "center",
                    background: "var(--bg-3)", color: "var(--ink)",
                  }}
                  title="Stop"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="1"/></svg>
                </button>
              ) : (
                <button
                  onClick={() => send()}
                  disabled={!input.trim()}
                  style={{
                    width: 36, height: 36, borderRadius: 10, display: "grid", placeItems: "center",
                    background: input.trim() ? "var(--accent)" : "var(--bg-3)",
                    color: input.trim() ? "var(--accent-ink)" : "var(--ink-4)",
                    transition: "background 120ms",
                    cursor: input.trim() ? "pointer" : "default",
                  }}
                  title="Send (Enter)"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14"/><path d="M13 5l7 7-7 7"/>
                  </svg>
                </button>
              )}
            </div>

            <div style={{
              fontSize: 11,
              color: "var(--ink-4)",
              fontFamily: "var(--mono)",
              marginTop: 8,
              textAlign: "center",
            }}>
              Strata AI can make mistakes. Not financial advice — verify important decisions with a qualified advisor.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChatMessage({ msg, streaming }) {
  const isUser = msg.role === "user";

  if (isUser) {
    return (
      <div style={{display: "flex", justifyContent: "flex-end", margin: "18px 0"}}>
        <div style={{
          maxWidth: "78%",
          background: "var(--bg-3)",
          border: "1px solid var(--line)",
          borderRadius: "16px 16px 4px 16px",
          padding: "10px 14px",
          color: "var(--ink)",
          fontSize: 14,
          lineHeight: 1.55,
          whiteSpace: "pre-wrap",
        }}>
          {msg.content}
        </div>
      </div>
    );
  }

  const toolCalls = window.goalsAI?.parseToolCalls ? window.goalsAI.parseToolCalls(msg.content) : [];
  const visibleText = window.goalsAI?.stripToolCalls ? window.goalsAI.stripToolCalls(msg.content) : msg.content;

  return (
    <div style={{display: "flex", gap: 12, margin: "22px 0"}}>
      <div style={{
        width: 28, height: 28, borderRadius: 8, flexShrink: 0,
        background: "linear-gradient(135deg, var(--accent), color-mix(in oklab, var(--accent) 55%, #9bb8ff))",
        display: "grid", placeItems: "center", color: "var(--bg)",
      }}><I.Bolt/></div>

      <div style={{flex: 1, minWidth: 0, paddingTop: 2}}>
        {visibleText?.trim() ? (
          <div
            className="ai-md"
            style={{
              fontSize: 14,
              lineHeight: 1.62,
              color: "var(--ink)",
            }}
            dangerouslySetInnerHTML={{ __html: renderMarkdown(visibleText) + (streaming ? '<span class="ai-cursor">▊</span>' : "") }}
          />
        ) : null}

        {!streaming && toolCalls.length > 0 && (
          <div style={{marginTop: visibleText?.trim() ? 14 : 0}}>
            {toolCalls.map((call, i) => (
              <ToolProposalCard key={i} call={call} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

window.StrataAIScreen = StrataAIScreen;
console.log("[strata-ai.jsx] loaded, StrataAIScreen:", typeof window.StrataAIScreen);
