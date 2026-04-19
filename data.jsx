/* Live data layer — reads from localStorage, rebuilds derived globals on change.
   Starts empty; the user adds their own assets. */

const TODAY = new Date();

// -- Historical series generator (fallback only) ------------------------------
function makeSeries(points, startVal, endVal, vol = 0.015, seed = 1) {
  const out = [];
  let rng = seed || 1;
  const rand = () => { rng = (rng * 9301 + 49297) % 233280; return rng / 233280; };
  const drift = points > 1 ? Math.pow((endVal || 1) / (startVal || 1), 1 / (points - 1)) : 1;
  let v = startVal;
  for (let i = 0; i < points; i++) {
    const noise = 1 + (rand() - 0.5) * vol * 2;
    const target = startVal * Math.pow(drift, i);
    v = v * 0.6 + target * 0.4;
    v *= noise;
    const d = new Date(TODAY);
    d.setDate(d.getDate() - (points - 1 - i));
    out.push({ t: d.toISOString().slice(0, 10), v: Math.round(v) });
  }
  if (out.length) out[out.length - 1].v = Math.round(endVal || 0);
  return out;
}

// -- Categories ---------------------------------------------------------------
const CATEGORIES = [
  { id: "stocks",     name: "Stocks & Shares",       color: "var(--cat-stocks)",     live: true  },
  { id: "property",   name: "Real Estate",           color: "var(--cat-property)",   live: "market" },
  { id: "retirement", name: "Super / Retirement",    color: "var(--cat-retirement)", live: false },
  { id: "business",   name: "Business Equity",       color: "var(--cat-business)",   live: false },
  { id: "crypto",     name: "Crypto",                color: "var(--cat-crypto)",     live: true  },
  { id: "cash",       name: "Cash & Savings",        color: "var(--cat-cash)",       live: false },
  { id: "bonds",      name: "Bonds",                 color: "var(--cat-bonds)",      live: false },
  { id: "private",    name: "Private Investments",   color: "var(--cat-private)",    live: false },
  { id: "metals",     name: "Precious Metals",       color: "var(--cat-metals)",     live: true  },
  { id: "collect",    name: "Collectibles & Art",    color: "var(--cat-collect)",    live: false },
  { id: "vehicles",   name: "Vehicles",              color: "var(--cat-vehicles)",   live: false },
  { id: "liability",  name: "Liabilities",           color: "var(--cat-liability)",  live: false, negative: true },
];

// -- Currencies ---------------------------------------------------------------
const CURRENCIES = {
  AUD: { symbol: "A$", code: "AUD", rate: 1 },
  USD: { symbol: "$",  code: "USD", rate: 0.6712 },
  GBP: { symbol: "£",  code: "GBP", rate: 0.5215 },
  EUR: { symbol: "€",  code: "EUR", rate: 0.6180 },
};

// -- Market ticker ------------------------------------------------------------
const TICKER = [
  { sym: "SPY",     val: "518.4",   chg: "+0.21%", pos: true },
  { sym: "AUD/USD", val: "0.6418",  chg: "-0.08%", pos: false },
  { sym: "ASX 200", val: "7,812.6", chg: "+0.34%", pos: true },
  { sym: "BTC/AUD", val: "104,675", chg: "-1.52%", pos: false },
];

function loadAssets() {
  try { return JSON.parse(localStorage.getItem("strata.assets.v1") || "[]"); }
  catch { return []; }
}

function loadSnapshots() {
  try { return JSON.parse(localStorage.getItem("strata.snapshots.v1") || "[]"); }
  catch { return []; }
}

function currentAssetValue(rec) {
  return rec.live && rec.qty && rec.live_price
    ? Number(rec.qty) * Number(rec.live_price)
    : (rec.manual_value != null ? Number(rec.manual_value) : 0);
}

function shapeAsset(rec) {
  const value = currentAssetValue(rec);
  const qtyLabel = rec.qty
    ? (rec.category === "crypto"
        ? `${rec.qty} ${rec.sym || ""}`
        : `${rec.sym ? rec.sym + " • " : ""}${rec.qty} sh`)
    : rec.sub;

  return {
    id: rec.id,
    cat: rec.category === "liability" ? "liability" : rec.category,
    sym: rec.sym || (rec.name || "?").slice(0, 3).toUpperCase(),
    name: rec.name,
    sub: rec.sub || qtyLabel || "",
    value,
    qty: rec.qty,
    price: rec.live_price || null,
    change24h: rec.change24h || 0,
    spark: [],
    meta: rec.meta || {},
  };
}

function buildSpark(assetId, currentValue, snapshots) {
  const mine = snapshots
    .filter(s => s.asset_id === assetId)
    .sort((a, b) => new Date(a.taken_at) - new Date(b.taken_at))
    .map(s => ({ t: (s.taken_at || "").slice(0, 10), v: Number(s.value || 0) }));

  const today = new Date().toISOString().slice(0, 10);

  if (!mine.length) return [currentValue, currentValue];

  const dedup = [];
  for (const p of mine) {
    if (dedup.length && dedup[dedup.length - 1].t === p.t) dedup[dedup.length - 1].v = p.v;
    else dedup.push(p);
  }

  if (dedup[dedup.length - 1].t !== today) dedup.push({ t: today, v: currentValue });
  else dedup[dedup.length - 1].v = currentValue;

  return dedup.map(x => x.v);
}

function isoDay(d) {
  return d.toISOString().slice(0, 10);
}

function parseDay(s) {
  const d = new Date(`${s}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Build true daily portfolio history by carrying forward last known values.
function buildPortfolioHistory(rawAssets, snapshots) {
  const today = new Date();
  const todayDay = isoDay(today);

  const snapsByAsset = new Map();
  for (const s of snapshots) {
    const assetId = s.asset_id;
    const day = (s.taken_at || "").slice(0, 10);
    if (!assetId || !day) continue;
    if (!snapsByAsset.has(assetId)) snapsByAsset.set(assetId, new Map());
    snapsByAsset.get(assetId).set(day, Number(s.value || 0));
  }

  const allDays = new Set([todayDay]);
  for (const [, byDay] of snapsByAsset) {
    for (const day of byDay.keys()) allDays.add(day);
  }

  const assetSeries = rawAssets.map(rec => {
    const current = currentAssetValue(rec);
    const byDay = snapsByAsset.get(rec.id) || new Map();
    return { id: rec.id, current, byDay };
  });

  if (!allDays.size) {
    return [{ t: todayDay, v: Math.round(assetSeries.reduce((s, a) => s + a.current, 0)) }];
  }

  const firstDay = [...allDays].sort()[0];
  const startDate = parseDay(firstDay) || new Date(today);
  const endDate = new Date(today);

  const out = [];
  let cursor = new Date(startDate);

  while (cursor <= endDate) {
    const day = isoDay(cursor);
    let total = 0;

    for (const asset of assetSeries) {
      let valueForDay = asset.current;

      if (asset.byDay.size) {
        let latestDay = null;
        let latestVal = null;
        for (const [d, v] of asset.byDay.entries()) {
          if (d <= day && (!latestDay || d > latestDay)) {
            latestDay = d;
            latestVal = v;
          }
        }
        if (latestDay != null) valueForDay = latestVal;
      }

      total += Number(valueForDay || 0);
    }

    out.push({ t: day, v: Math.round(total) });
    cursor.setDate(cursor.getDate() + 1);
  }

  if (!out.length) {
    out.push({ t: todayDay, v: Math.round(assetSeries.reduce((s, a) => s + a.current, 0)) });
  }

  out[out.length - 1].v = Math.round(assetSeries.reduce((s, a) => s + a.current, 0));
  return out;
}

function sliceRange(history, key) {
  if (!history.length) return [];
  const endDay = parseDay(history[history.length - 1].t) || new Date();

  const lookbackDays = {
    "1D": 1,
    "1W": 7,
    "1M": 30,
    "3M": 90,
    "1Y": 365,
    "5Y": 365 * 5,
    "ALL": null,
  };

  const lookback = lookbackDays[key];
  if (lookback == null) return history;

  const startDate = new Date(endDay);
  startDate.setDate(startDate.getDate() - lookback);
  const startStr = isoDay(startDate);

  let slice = history.filter(p => p.t >= startStr);
  if (!slice.length) slice = [history[0], history[history.length - 1]];

  const before = [...history].reverse().find(p => p.t < slice[0].t);
  if (before) slice = [before, ...slice];

  const dedup = [];
  for (const p of slice) {
    if (dedup.length && dedup[dedup.length - 1].t === p.t) dedup[dedup.length - 1] = p;
    else dedup.push(p);
  }

  return dedup.length >= 2 ? dedup : [history[0], history[history.length - 1]];
}

function computeMonthlyStats(history) {
  if (!history || history.length < 2) {
    return { bestMonth: null, worstMonth: null, avgMonthlyPct: null };
  }

  const monthEnd = new Map();
  for (const p of history) {
    const month = p.t.slice(0, 7);
    monthEnd.set(month, p);
  }

  const months = [...monthEnd.keys()].sort();
  const returns = [];

  for (let i = 1; i < months.length; i++) {
    const prev = monthEnd.get(months[i - 1]);
    const cur = monthEnd.get(months[i]);
    if (!prev || !cur || !prev.v) continue;
    const pct = ((cur.v - prev.v) / prev.v) * 100;
    returns.push({ month: months[i], pct });
  }

  if (!returns.length) {
    return { bestMonth: null, worstMonth: null, avgMonthlyPct: null };
  }

  const bestMonth = returns.reduce((a, b) => (b.pct > a.pct ? b : a));
  const worstMonth = returns.reduce((a, b) => (b.pct < a.pct ? b : a));
  const avgMonthlyPct = returns.reduce((s, r) => s + r.pct, 0) / returns.length;

  return { bestMonth, worstMonth, avgMonthlyPct };
}

function rebuild() {
  const raw = loadAssets();
  const snaps = loadSnapshots();

  const ASSETS = raw.map(r => {
    const a = shapeAsset(r);
    a.spark = buildSpark(a.id, a.value, snaps);
    return a;
  });

  const catMap = {};
  for (const c of CATEGORIES) catMap[c.id] = { ...c, total: 0, count: 0, change24h: 0 };

  for (const a of ASSETS) {
    if (!catMap[a.cat]) continue;
    catMap[a.cat].total += a.value;
    catMap[a.cat].count += 1;
    catMap[a.cat].change24h += (a.change24h || 0) * Math.abs(a.value);
  }

  for (const id in catMap) {
    if (catMap[id].total !== 0) {
      catMap[id].change24h = catMap[id].change24h / Math.abs(catMap[id].total);
    }
  }

  const CATEGORY_TOTALS = Object.values(catMap);

  const NET_WORTH = ASSETS.reduce((s, a) => s + a.value, 0);
  const TOTAL_ASSETS = ASSETS.filter(a => a.value > 0).reduce((s, a) => s + a.value, 0);
  const TOTAL_LIABILITIES = ASSETS.filter(a => a.value < 0).reduce((s, a) => s + a.value, 0);

  const PORTFOLIO_HISTORY = buildPortfolioHistory(raw, snaps);

  const RANGES = {
    "1D": sliceRange(PORTFOLIO_HISTORY, "1D"),
    "1W": sliceRange(PORTFOLIO_HISTORY, "1W"),
    "1M": sliceRange(PORTFOLIO_HISTORY, "1M"),
    "3M": sliceRange(PORTFOLIO_HISTORY, "3M"),
    "1Y": sliceRange(PORTFOLIO_HISTORY, "1Y"),
    "5Y": sliceRange(PORTFOLIO_HISTORY, "5Y"),
    "ALL": sliceRange(PORTFOLIO_HISTORY, "ALL"),
  };

  const HISTORY_STATS = computeMonthlyStats(PORTFOLIO_HISTORY);

  Object.assign(window, {
    ASSETS,
    CATEGORY_TOTALS,
    NET_WORTH,
    TOTAL_ASSETS,
    TOTAL_LIABILITIES,
    PORTFOLIO_HISTORY,
    RANGES,
    HISTORY_STATS,
  });

  window.dispatchEvent(new Event("strata:data-changed"));
}

rebuild();

window.addEventListener("storage", (e) => {
  if (e.key && e.key.startsWith("strata.")) rebuild();
});

Object.assign(window, {
  CATEGORIES,
  CURRENCIES,
  TICKER,
  makeSeries,
  rebuildData: rebuild,
  PROPERTY_MARKETS: {},
});
