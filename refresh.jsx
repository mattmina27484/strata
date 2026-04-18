/* Price refresh service — fetches live prices for all live-tracked assets,
   updates their live_price + change24h in localStorage, and records a snapshot
   so history builds up over time. Runs on boot and every 5 minutes. */

(function() {
  const REFRESH_MS = 5 * 60 * 1000;    // 5 min
  const SNAPSHOT_INTERVAL_MS = 24 * 3600 * 1000; // 1 per day per asset

  async function refreshOnce() {
    if (!window.db || !window.prices) return;
    const assets = await window.db.listAssets();
    const live = assets.filter(a => a.live && a.sym && a.qty && (a.category === "stocks" || a.category === "crypto"));
    if (!live.length) return;
    const ccy = (window.__APP_STATE?.currency || "AUD");
    try {
      const priced = await window.prices.priceAssets(live, ccy);
      const now = Date.now();
      const lastSnaps = JSON.parse(localStorage.getItem("strata.snapshots.v1") || "[]");
      const lastSnapByAsset = {};
      for (const s of lastSnaps) {
        const d = new Date(s.taken_at).getTime();
        if (!lastSnapByAsset[s.asset_id] || d > lastSnapByAsset[s.asset_id]) lastSnapByAsset[s.asset_id] = d;
      }
      for (const a of live) {
        const p = priced[a.id];
        if (!p || !Number.isFinite(p.price)) continue;
        await window.db.updateAsset(a.id, {
          live_price: p.price,
          change24h: p.change24h,
          last_priced_at: new Date().toISOString(),
        });
        // Record a daily snapshot for history
        if (!lastSnapByAsset[a.id] || (now - lastSnapByAsset[a.id]) > SNAPSHOT_INTERVAL_MS) {
          await window.db.addSnapshot(a.id, p.value);
        }
      }
      if (window.rebuildData) window.rebuildData();
      localStorage.setItem("strata.prices.lastRefresh", new Date().toISOString());
      window.dispatchEvent(new CustomEvent("strata:prices-refreshed"));
    } catch (e) {
      console.warn("Price refresh failed:", e);
    }
  }

  // --- Market ticker: live indices & BTC -----------------------------------
  async function refreshTicker() {
    const out = [];
    // Yahoo Finance indices are CORS-blocked from production domains. Skipping silently.

    try {
      // BTC in AUD
      const r = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=aud&include_24hr_change=true");
      const j = await r.json();
      if (j.bitcoin) {
        out.push({
          sym: "BTC/AUD",
          val: Math.round(j.bitcoin.aud).toLocaleString(),
          chg: (j.bitcoin.aud_24h_change >= 0 ? "+" : "") + j.bitcoin.aud_24h_change.toFixed(2) + "%",
          pos: j.bitcoin.aud_24h_change >= 0,
        });
      }
    } catch {}

    if (out.length) {
      window.TICKER = out;
      window.dispatchEvent(new CustomEvent("strata:ticker-updated"));
    }
  }

  async function refreshAll() {
    await Promise.all([refreshOnce(), refreshTicker()]);
  }

  // Run on boot (after short delay for rest of app to init) + every 5 min
  setTimeout(refreshAll, 1500);
  setInterval(refreshAll, REFRESH_MS);

  // Expose for manual refresh button
  window.refreshPrices = refreshAll;
})();
