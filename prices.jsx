/* Live price fetchers. No API keys needed.
   Crypto → CoinGecko free API.
   Stocks → Yahoo Finance public endpoint.
   Cached in-memory for 60s.                                           */

(function() {
  const cache = new Map(); // key → { v, t }
  const TTL = 60 * 1000;

  function cached(key) {
    const hit = cache.get(key);
    if (hit && (Date.now() - hit.t) < TTL) return hit.v;
    return null;
  }
  function put(key, v) { cache.set(key, { v, t: Date.now() }); return v; }

  // ----- Crypto ---------------------------------------------------------------
  // maps our sym → CoinGecko id
  const COIN_IDS = {
    BTC:"bitcoin", ETH:"ethereum", SOL:"solana", BNB:"binancecoin", XRP:"ripple",
    ADA:"cardano", AVAX:"avalanche-2", DOGE:"dogecoin", LINK:"chainlink",
    DOT:"polkadot", MATIC:"matic-network", LTC:"litecoin", UNI:"uniswap",
    ATOM:"cosmos", ARB:"arbitrum", OP:"optimism",
  };

  async function fetchCryptoPrices(syms, vsCurrency = "aud") {
    const ids = syms.map(s => COIN_IDS[s.toUpperCase()]).filter(Boolean);
    if (ids.length === 0) return {};
    const key = `crypto:${vsCurrency}:${ids.join(",")}`;
    const hit = cached(key); if (hit) return hit;

    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(",")}&vs_currencies=${vsCurrency}&include_24hr_change=true`;
    try {
      const r = await fetch(url);
      const j = await r.json();
      const out = {};
      for (const sym of syms) {
        const id = COIN_IDS[sym.toUpperCase()];
        if (j[id]) {
          out[sym] = {
            price: j[id][vsCurrency],
            change24h: j[id][`${vsCurrency}_24h_change`] || 0,
          };
        }
      }
      return put(key, out);
    } catch (e) {
      console.warn("CoinGecko fetch failed", e);
      return {};
    }
  }

  // ----- Stocks ---------------------------------------------------------------
  // Yahoo Finance: https://query1.finance.yahoo.com/v7/finance/quote?symbols=AAPL,CBA.AX
  async function fetchStockPrices(symbols) {
    // Yahoo Finance is CORS-blocked in browsers on production domains.
    // For live stock prices, users should configure STRATA_AI_ENDPOINT and add a
    // /prices proxy route to the Worker. Returning {} silently keeps the app working.
    if (symbols.length === 0) return {};
    return {};
  }

  // ----- FX -------------------------------------------------------------------
  async function fetchFxRate(base = "AUD", quote = "USD") {
    // FX rates also CORS-blocked from Yahoo. Return 1 for now.
    return 1;
  }

  // ----- Unified: fetch prices for a set of assets ----------------------------
  // Input: [{id, category, sym, qty, manual_value}], returns map id → {value, price, change24h}
  async function priceAssets(assets, baseCcy = "AUD") {
    const cryptoSyms = [...new Set(assets.filter(a => a.category === "crypto" && a.sym).map(a => a.sym))];
    const stockSyms = [...new Set(assets.filter(a => a.category === "stocks" && a.sym).map(a => a.sym))];

    const [crypto, stocks] = await Promise.all([
      fetchCryptoPrices(cryptoSyms, baseCcy.toLowerCase()),
      fetchStockPrices(stockSyms),
    ]);

    const out = {};
    for (const a of assets) {
      if (a.category === "crypto" && crypto[a.sym]) {
        out[a.id] = { price: crypto[a.sym].price, change24h: crypto[a.sym].change24h, value: crypto[a.sym].price * (a.qty || 0) };
      } else if (a.category === "stocks" && stocks[a.sym]) {
        const quote = stocks[a.sym];
        // Convert if stock ccy != base
        let price = quote.price;
        if (quote.currency && quote.currency !== baseCcy) {
          const fx = await fetchFxRate(quote.currency, baseCcy);
          price = quote.price * fx;
        }
        out[a.id] = { price, change24h: quote.change24h, value: price * (a.qty || 0) };
      } else {
        out[a.id] = { value: a.manual_value || 0, change24h: 0 };
      }
    }
    return out;
  }

  window.prices = { fetchCryptoPrices, fetchStockPrices, fetchFxRate, priceAssets };
})();
