/* Google Drive backup — stores your Strata data as a single JSON file in your Drive's
   "appDataFolder" (private, only this app can see it). Uses Google Identity Services —
   no API key, no server, no OAuth dance with redirects. Just a popup.

   Requires: window.GOOGLE_CLIENT_ID set in index.html.                     */

(function() {
  const FILE_NAME = "strata-backup.json";
  const SCOPE = "https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email";
  let tokenClient = null;
  let accessToken = null;
  let expiresAt   = 0;
  let fileId = null;
  let autoSync = false;
  let inflight = null;
  let lastSyncAt = null;
  let profile = null;
  const listeners = new Set();

  function emit() { for (const l of listeners) { try { l(state()); } catch {} } }
  function state() {
    return {
      signedIn: !!accessToken && Date.now() < expiresAt,
      autoSync,
      lastSyncAt,
      hasClientId: !!window.GOOGLE_CLIENT_ID,
      profile,
    };
  }

  async function fetchProfile() {
    if (!accessToken) return;
    try {
      const r = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: "Bearer " + accessToken },
      });
      if (r.ok) {
        const j = await r.json();
        profile = {
          name: j.name || j.email || "User",
          email: j.email || "",
          picture: j.picture || "",
          initials: (j.name || j.email || "U").split(/[\s@]+/).filter(Boolean).slice(0, 2).map(s => s[0]?.toUpperCase()).join("") || "U",
        };
        localStorage.setItem("strata.drive.profile", JSON.stringify(profile));
        emit();
      }
    } catch (e) { console.warn("profile fetch failed", e); }
  }

  function ensureTokenClient() {
    if (tokenClient) return tokenClient;
    if (!window.google?.accounts?.oauth2) return null;
    if (!window.GOOGLE_CLIENT_ID) return null;
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: window.GOOGLE_CLIENT_ID,
      scope: SCOPE,
      callback: () => {}, // replaced per call
    });
    return tokenClient;
  }

  function signIn() {
    return new Promise((resolve, reject) => {
      const client = ensureTokenClient();
      if (!client) { reject(new Error("Google Sign-In not loaded yet")); return; }
      client.callback = (resp) => {
        if (resp.error) { reject(new Error(resp.error)); return; }
        accessToken = resp.access_token;
        expiresAt = Date.now() + (resp.expires_in || 3600) * 1000 - 60000;
        sessionStorage.setItem("strata.drive.token", JSON.stringify({accessToken, expiresAt}));
        fetchProfile();
        emit();
        resolve();
      };
      client.requestAccessToken({prompt: accessToken ? "" : "consent"});
    });
  }

  // Restore token from session if still valid
  try {
    const raw = sessionStorage.getItem("strata.drive.token");
    if (raw) {
      const t = JSON.parse(raw);
      if (Date.now() < t.expiresAt) { accessToken = t.accessToken; expiresAt = t.expiresAt; }
    }
    const lf = localStorage.getItem("strata.drive.fileId");
    if (lf) fileId = lf;
    const ls = localStorage.getItem("strata.drive.lastSyncAt");
    if (ls) lastSyncAt = ls;
    const as = localStorage.getItem("strata.drive.autoSync");
    if (as === "1") autoSync = true;
    const pf = localStorage.getItem("strata.drive.profile");
    if (pf) profile = JSON.parse(pf);
  } catch {}

  // If we restored a live token but have no profile yet, fetch it
  if (accessToken && Date.now() < expiresAt && !profile) {
    setTimeout(fetchProfile, 0);
  }

  function signOut() {
    accessToken = null; expiresAt = 0; fileId = null; profile = null;
    sessionStorage.removeItem("strata.drive.token");
    localStorage.removeItem("strata.drive.fileId");
    localStorage.removeItem("strata.drive.profile");
    emit();
  }

  async function ensureToken() {
    if (accessToken && Date.now() < expiresAt) return;
    await signIn();
  }

  // Find the backup file id (in appDataFolder)
  async function findFileId() {
    if (fileId) return fileId;
    await ensureToken();
    const r = await fetch(`https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${encodeURIComponent(`name='${FILE_NAME}'`)}&fields=files(id,name)`, {
      headers: { Authorization: "Bearer " + accessToken },
    });
    const j = await r.json();
    if (j.files && j.files[0]) {
      fileId = j.files[0].id;
      localStorage.setItem("strata.drive.fileId", fileId);
    }
    return fileId;
  }

  async function upload() {
    await ensureToken();
    const payload = JSON.stringify(window.db.exportAll(), null, 2);
    await findFileId();

    // Multipart upload (create or update)
    const boundary = "-------strata" + Math.random().toString(36).slice(2);
    const metadata = fileId
      ? { name: FILE_NAME, mimeType: "application/json" }
      : { name: FILE_NAME, mimeType: "application/json", parents: ["appDataFolder"] };
    const body =
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\nContent-Type: application/json\r\n\r\n${payload}\r\n--${boundary}--`;

    const url = fileId
      ? `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`
      : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`;
    const method = fileId ? "PATCH" : "POST";

    const r = await fetch(url, {
      method,
      headers: {
        "Authorization": "Bearer " + accessToken,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    });
    if (!r.ok) throw new Error("Drive upload failed: " + r.status);
    const j = await r.json();
    if (!fileId) { fileId = j.id; localStorage.setItem("strata.drive.fileId", fileId); }
    lastSyncAt = new Date().toISOString();
    localStorage.setItem("strata.drive.lastSyncAt", lastSyncAt);
    emit();
  }

  async function download() {
    await ensureToken();
    await findFileId();
    if (!fileId) throw new Error("No backup found in Drive yet. Click Backup first.");
    const r = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers: { Authorization: "Bearer " + accessToken },
    });
    if (!r.ok) throw new Error("Drive download failed: " + r.status);
    const blob = await r.json();
    window.db.importAll(blob);
    lastSyncAt = new Date().toISOString();
    localStorage.setItem("strata.drive.lastSyncAt", lastSyncAt);
    emit();
  }

  // Coalesce rapid-fire changes into a single upload
  let debounceT = null;
  function scheduleAutoSync() {
    if (!autoSync) return;
    if (!state().signedIn) return;
    clearTimeout(debounceT);
    debounceT = setTimeout(async () => {
      try { await upload(); } catch (e) { console.warn("Auto-sync failed:", e); }
    }, 2500);
  }
  window.addEventListener("strata:data-changed", scheduleAutoSync);

  function setAutoSync(on) {
    autoSync = !!on;
    if (autoSync) localStorage.setItem("strata.drive.autoSync", "1");
    else          localStorage.removeItem("strata.drive.autoSync");
    emit();
    if (autoSync) scheduleAutoSync();
  }

  function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

  window.drive = {
    state, signIn, signOut, upload, download, setAutoSync, onChange,
  };
})();
