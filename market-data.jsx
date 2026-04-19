async function fetchQuote(symbol) {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbol}`
    );
    const data = await res.json();
    const q = data?.quoteResponse?.result?.[0];

    if (!q) return null;

    return {
      symbol,
      price: q.regularMarketPrice,
      changePct: q.regularMarketChangePercent,
    };
  } catch (e) {
    console.warn("Quote fetch failed:", symbol);
    return null;
  }
}

async function refreshTicker() {
  const symbols = ["SPY", "AUDUSD=X", "^AXJO", "BTC-AUD"];

  const results = await Promise.all(symbols.map(fetchQuote));

  window.TICKER = results
    .filter(Boolean)
    .map(r => ({
      sym:
        r.symbol === "^AXJO" ? "ASX 200" :
        r.symbol === "AUDUSD=X" ? "AUD/USD" :
        r.symbol === "BTC-AUD" ? "BTC/AUD" :
        r.symbol,
      val: r.price?.toLocaleString(),
      chg: `${r.changePct >= 0 ? "+" : ""}${r.changePct.toFixed(2)}%`,
      pos: r.changePct >= 0,
    }));

  window.dispatchEvent(new Event("strata:data-changed"));
}

window.refreshTicker = refreshTicker;
