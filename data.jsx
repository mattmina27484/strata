/* Live data layer — reads from localStorage, rebuilds derived globals on change.
   Starts empty; the user adds their own assets. */

const TODAY = new Date();

// -- Historical series generator (still used for per-asset spark/chart fallback)
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
    const d = new Date(TODAY); d.setDate(d.getDate() - (points - 1 - i));
    out.push({ t: d.toISOString().slice(0, 10), v: Math.round(v) });
  }
  if (out.length) out[out.length - 1].v = endVal;
  return out;
}

// -- Categories (static reference) --------------------------------------------
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

// -- Currencies ----------------------------------------------------------------
const CURRENCIES = {
  AUD: { symbol: "A$", code: "AUD", rate: 1 },
  USD: { symbol: "$",  code: "USD", rate: 0.6712 },
  GBP: { symbol: "£",  code: "GBP", rate: 0.5215 },
  EUR: { symbol: "€",  code: "EUR", rate: 0.6180 },
};

// -- Market ticker (static reference display only) ----------------------------
const TICKER = [
  { sym: "ASX 200", val: "8,412.3", chg: "+0.64%", pos: true },
  { sym: "S&P 500", val: "5,982.1", chg: "+0.21%", pos: true },
  { sym: "BTC/AUD", val: "146,220", chg: "+3.12%", pos: true },
];

// ============================================================================
// LIVE DATA — rebuilt whenever the user changes something
// ============================================================================

function loadAssets() {
  try { return JSON.parse(localStorage.getItem("strata.assets.v1") || "[]"); }
  catch { return []; }
}

function loadSnapshots() {
  try { return JSON.parse(localStorage.getItem("strata.snapshots.v1") || "[]"); }
  catch { return []; }
}

function isTermDeposit(rec) {
  const name = String(rec?.name || "").toLowerCase();
  const sub = String(rec?.sub || "").toLowerCase();
  const type = String(rec?.type || rec?.assetType || rec?.asset_type || "").toLowerCase();
  return (
    type === "term_deposit" ||
    type === "term deposit" ||
    name.includes("term deposit") ||
    sub.includes("term deposit")
  );
}

function getAssetCategory(rec) {
  // Term deposits should roll up under Cash & Savings
  if (isTermDeposit(rec)) return "cash";
  if (rec.category === "liability") return "liability";
  return rec.category || "cash";
}

function getAssetSymbol(rec) {
  if (rec.sym) return rec.sym;
  if (isTermDeposit(rec)) return "TD";
  return (rec.name || "?").slice(0, 3).toUpperCase();
}

function getAssetSubtitle(rec) {
  if (rec.sub) return rec.sub;

  if (rec.qty) {
    if (rec.category === "crypto") return `${rec.qty} ${rec.sym || ""}`;
    return `${rec.sym ? rec.sym + " • " : ""}${rec.qty} sh`;
  }

  if (isTermDeposit(rec)) return "Term Deposit";
  return "";
}

// Convert the localStorage asset shape into the legacy shape the UI expects
function shapeAsset(rec) {
  const value = rec.live && rec.qty && rec.live_price
    ? rec.qty * rec.live_price
    : (rec.manual_value != null ? Number(rec.manual_value) : 0);

  return {
    id: rec.id,
    cat: getAssetCategory(rec),
    sym: getAssetSymbol(rec),
    name: rec.name,
    sub: getAssetSubtitle(rec),
    value,
    qty: rec.qty,
    price: rec.live_price || null,
    change24h: rec.change24h || 0,
    spark: [],           // filled below from snapshots
    meta: rec.meta || {},
  };
}

function buildSpark(assetId, currentValue, snapshots) {
  const mine = snapshots
    .filter(s => s.asset_id === assetId)
    .sort((a, b) => new Date(a.taken_at) - new Date(b.taken_at))
    .map(s => s.value);

  if (mine.length === 0) return [currentValue, currentValue];
  mine.push(currentValue);
  return mine;
}

function rebuild() {
  const raw = loadAssets();
  const snaps = loadSnapshots();

  const ASSETS = raw.map(r => {
    const a = shapeAsset(r);
    a.spark = buildSpark(a.id, a.value, snaps);
    return a;
  });

  // Category totals
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

  const NET_WORTH         = ASSETS.reduce((s, a) => s + a.value, 0);
  const TOTAL_ASSETS      = ASSETS.filter(a => a.value > 0).reduce((s, a) => s + a.value, 0);
  const TOTAL_LIABILITIES = ASSETS.filter(a => a.value < 0).reduce((s, a) => s + a.value, 0);

  // Net-worth history from aggregated daily snapshots
  const bucket = {};
  for (const s of snaps) {
    const day = (s.taken_at || "").slice(0, 10);
    if (!day) continue;
    bucket[day] = (bucket[day] || 0) + s.value;
  }

  const days = Object.keys(bucket).sort();

  const makeRange = (n) => {
    const picked = days.slice(-n);
    return picked.map(d => ({ t: d, v: Math.round(bucket[d]) }));
  };

  // Always append a "today" point with current net worth so the chart ends at now
  const appendToday = (arr) => {
    const today = new Date().toISOString().slice(0, 10);
    if (!arr.length || arr[arr.length - 1].t !== today) {
      arr.push({ t: today, v: Math.round(NET_WORTH) });
    } else {
      arr[arr.length - 1].v = Math.round(NET_WORTH);
    }
    return arr;
  };

  // If no history, give a single point so charts render
  const emptyOrHistory = (n) => {
    const r = appendToday(makeRange(n));
    return r.length >= 2 ? r : [{ t: "start", v: NET_WORTH }, { t: "now", v: NET_WORTH }];
  };

  const RANGES = {
    "1D":  emptyOrHistory(2),
    "1W":  emptyOrHistory(7),
    "1M":  emptyOrHistory(30),
    "3M":  emptyOrHistory(90),
    "1Y":  emptyOrHistory(365),
    "5Y":  emptyOrHistory(365 * 5),
    "ALL": emptyOrHistory(100000),
  };

  // Publish to window
  Object.assign(window, {
    ASSETS,
    CATEGORY_TOTALS,
    NET_WORTH,
    TOTAL_ASSETS,
    TOTAL_LIABILITIES,
    RANGES,
  });

  // Notify listeners
  window.dispatchEvent(new Event("strata:data-changed"));
}

// Initial build + rebuild on cross-tab storage changes
rebuild();

window.addEventListener("storage", (e) => {
  if (e.key && e.key.startsWith("strata.")) rebuild();
});

// Expose helpers + reference data
Object.assign(window, {
  CATEGORIES,
  CURRENCIES,
  TICKER,
  makeSeries,
  rebuildData: rebuild,
  PROPERTY_MARKETS: {},  // no mock markets in empty mode
});
