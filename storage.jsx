/* Local storage data layer — everything lives in your browser's localStorage.
   NO seeding. App starts fully empty until the user adds assets. */

(function() {
  const K = {
    assets:    "strata.assets.v1",
    snapshots: "strata.snapshots.v1",
  };

  const read  = (k, fallback) => {
    try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; }
    catch { return fallback; }
  };
  const write = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  const uid   = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(36).slice(2));

  function notify() {
    if (window.rebuildData) window.rebuildData();
  }

  // ---- Assets ---------------------------------------------------------------
  async function listAssets() { return read(K.assets, []); }

  async function addAsset(asset) {
    const rec = {
      id: uid(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      meta: {},
      ...asset,
    };
    const list = read(K.assets, []);
    list.unshift(rec);
    write(K.assets, list);
    if (rec.manual_value != null) await addSnapshot(rec.id, Number(rec.manual_value));
    else if (rec.live && rec.qty && rec.live_price) {
      await addSnapshot(rec.id, Number(rec.qty) * Number(rec.live_price));
    }
    notify();
    return rec;
  }

  async function updateAssetValue(id, newValue) {
    const list = read(K.assets, []);
    const i = list.findIndex(a => a.id === id);
    if (i < 0) return;
    list[i].manual_value = Number(newValue);
    list[i].updated_at = new Date().toISOString();
    write(K.assets, list);
    await addSnapshot(id, Number(newValue));
    notify();
  }

  async function updateAsset(id, patch) {
    const list = read(K.assets, []);
    const i = list.findIndex(a => a.id === id);
    if (i < 0) return;
    list[i] = { ...list[i], ...patch, updated_at: new Date().toISOString() };
    write(K.assets, list);
    notify();
  }

  async function deleteAsset(id) {
    write(K.assets, read(K.assets, []).filter(a => a.id !== id));
    write(K.snapshots, read(K.snapshots, []).filter(s => s.asset_id !== id));
    notify();
  }

  // ---- Snapshots ------------------------------------------------------------
  async function addSnapshot(assetId, value) {
    const list = read(K.snapshots, []);
    list.push({ id: uid(), asset_id: assetId, value, taken_at: new Date().toISOString() });
    write(K.snapshots, list);
  }
  async function listSnapshots(assetId) {
    return read(K.snapshots, [])
      .filter(s => s.asset_id === assetId)
      .sort((a, b) => new Date(a.taken_at) - new Date(b.taken_at));
  }

  // ---- Backup / restore -----------------------------------------------------
  function exportAll() {
    let profile = null;
    try {
      const pf = localStorage.getItem("strata.profile.v1");
      if (pf) profile = JSON.parse(pf);
    } catch {}
    return {
      app: "strata",
      exported_at: new Date().toISOString(),
      assets:    read(K.assets, []),
      snapshots: read(K.snapshots, []),
      profile,
    };
  }
  function importAll(blob) {
    if (!blob || !Array.isArray(blob.assets)) throw new Error("Invalid backup file");
    write(K.assets,    blob.assets    || []);
    write(K.snapshots, blob.snapshots || []);
    if (blob.profile && typeof blob.profile === "object") {
      try { localStorage.setItem("strata.profile.v1", JSON.stringify(blob.profile)); } catch {}
    }
    notify();
  }
  function resetAll() {
    Object.values(K).forEach(k => localStorage.removeItem(k));
    localStorage.removeItem("strata.profile.v1");
    notify();
  }

  window.db = {
    listAssets, addAsset, updateAsset, updateAssetValue, deleteAsset,
    addSnapshot, listSnapshots,
    exportAll, importAll, resetAll,
  };
})();
