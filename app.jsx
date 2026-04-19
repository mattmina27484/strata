/* App shell: routing, app state, sidebar, topbar */

function useAppState() {
  const [state, setStateRaw] = React.useState(() => ({
    dashboardVariant: window.__TWEAKS.dashboardVariant,
    theme: window.__TWEAKS.theme,
    currency: window.__TWEAKS.currency,
  }));

  // expose state to formatters
  window.__APP_STATE = state;

  const setState = React.useCallback((patch) => {
    setStateRaw(prev => {
      const next = { ...prev, ...patch };
      window.__APP_STATE = next;
      return next;
    });
    // persist via edit-mode message
    window.parent.postMessage({ type: "__edit_mode_set_keys", edits: patch }, "*");
  }, []);

  return [state, setState];
}

window.__useAppState = () => [window.__APP_STATE_EXT.state, window.__APP_STATE_EXT.setState];

function Sidebar({ route, setRoute }) {
  const Link = ({ id, icon: Icon, label, badge }) => (
    <button
      className={"nav-item " + (route.id === id && !route.assetId && !route.goalId ? "active" : "")}
      onClick={() => setRoute({ id })}
    >
      <span style={{ display: "inline-flex", color: "var(--ink-3)" }}>
        <Icon />
      </span>
      <span>{label}</span>
      {badge ? <span className="badge">{badge}</span> : null}
    </button>
  );

  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark" />
        <span className="brand-name">Strata</span>
        <span className="brand-sub">v2.4</span>
      </div>

      <div className="nav-group">
        <div className="nav-group-label">Intelligence</div>
        <Link id="strata-ai" icon={I.Bolt} label="Strata AI" />
        <Link id="news" icon={I.Bell} label="News" />
      </div>

      <div className="nav-group">
        <div className="nav-group-label">Overview</div>
        <Link id="dashboard" icon={I.Dashboard} label="Dashboard" />
        <Link id="history" icon={I.Chart} label="History" />
        <Link id="allocation" icon={I.Pie} label="Allocation" />
        <Link
          id="goals"
          icon={I.Target}
          label="Goals"
          badge={(window.goalsStore?.list?.(false) || []).length || undefined}
        />
      </div>

      <div className="nav-group">
        <div className="nav-group-label">Portfolio</div>
        <Link
          id="assets"
          icon={I.Layers}
          label="All holdings"
          badge={(window.ASSETS || []).length || undefined}
        />
        <Link
          id="categories"
          icon={I.Home}
          label="Categories"
          badge={(window.CATEGORY_TOTALS || []).filter(c => c.count > 0).length || undefined}
        />
        <Link id="add" icon={I.Plus} label="Add asset" />
      </div>

      <div className="nav-group">
        <div className="nav-group-label">Account</div>
        <Link id="profile" icon={I.User || I.Settings} label="Profile" />
        <Link id="settings" icon={I.Settings} label="Settings" />
      </div>

      <div className="sidebar-footer">
        <UserChip />
      </div>
    </aside>
  );
}

function UserChip() {
  const [drive, setDrive] = React.useState(() => window.drive?.state() || {});

  React.useEffect(() => {
    if (!window.drive) return;
    const unsub = window.drive.onChange(setDrive);
    return () => {
      try { unsub?.(); } catch {}
    };
  }, []);

  const p = drive.profile;
  const name = p?.name || "Not signed in";
  const meta = p?.email || (drive.hasClientId ? "Sign in on Settings" : "Local only");
  const initials = p?.initials || "—";

  return (
    <div className="user-chip" title={p?.email || ""}>
      {p?.picture ? (
        <img
          src={p.picture}
          alt=""
          className="avatar"
          style={{ objectFit: "cover" }}
          onError={(e) => { e.currentTarget.style.display = "none"; }}
        />
      ) : (
        <span className="avatar">{initials}</span>
      )}
      <div style={{ minWidth: 0, flex: 1 }}>
        <div className="name" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {name}
        </div>
        <div className="meta" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {meta}
        </div>
      </div>
    </div>
  );
}

function Topbar({ route, setRoute, state, setState }) {
  const [, tick] = React.useReducer(x => x + 1, 0);
  const [refreshing, setRefreshing] = React.useState(false);

  React.useEffect(() => {
    const h = () => tick();
    window.addEventListener("strata:ticker-updated", h);
    return () => window.removeEventListener("strata:ticker-updated", h);
  }, []);

  const crumbsFor = (r) => {
    if (r.id === "dashboard") return ["Overview", "Dashboard"];
    if (r.id === "history") return ["Overview", "History"];
    if (r.id === "allocation") return ["Overview", "Allocation"];
    if (r.id === "goals") {
      if (r.goalId) return ["Overview", "Goals", window.goalsStore?.get?.(r.goalId)?.title || "Goal"];
      if (r.mode === "edit") return ["Overview", "Goals", "New goal"];
      return ["Overview", "Goals"];
    }
    if (r.id === "assets") {
      return r.assetId
        ? ["Portfolio", "Holdings", (window.ASSETS || []).find(a => a.id === r.assetId)?.name]
        : ["Portfolio", "Holdings"];
    }
    if (r.id === "categories") return ["Portfolio", "Categories"];
    if (r.id === "add") return ["Portfolio", "Add asset"];
    if (r.id === "strata-ai") return ["Intelligence", "Strata AI"];
    if (r.id === "news") return ["Intelligence", "News"];
    if (r.id === "profile") return ["Account", "Profile"];
    if (r.id === "settings") return ["Account", "Settings"];
    return ["—"];
  };

  const crumbs = crumbsFor(route);

  return (
    <div className="topbar">
      <div className="crumbs">
        {crumbs.map((c, i) => (
          <React.Fragment key={i}>
            {i > 0 && <span className="sep">/</span>}
            <span className={i === crumbs.length - 1 ? "cur" : ""}>{c}</span>
          </React.Fragment>
        ))}
      </div>

      <div className="topbar-spacer" />

      <div className="market-ticker col-hide">
        {window.TICKER.slice(0, 3).map(t => (
          <span key={t.sym}>
            <span className="sym">{t.sym}</span>
            <span>{t.val}</span>{" "}
            <span className={t.pos ? "pos" : "neg"}>{t.chg}</span>
          </span>
        ))}
      </div>

      <button
        className="icon-btn"
        title="Refresh prices"
        onClick={async () => {
          setRefreshing(true);
          try {
            await window.refreshPrices?.();
          } finally {
            setTimeout(() => setRefreshing(false), 600);
          }
        }}
        style={refreshing ? { animation: "spin 1s linear infinite" } : {}}
      >
        <I.Refresh />
      </button>

      <button className="icon-btn" title="Notifications">
        <I.Bell />
      </button>

      <div className="theme-toggle" style={{ marginLeft: 4 }}>
        <button className={state.theme === "dark" ? "active" : ""} onClick={() => setState({ theme: "dark" })}>
          Dark
        </button>
        <button className={state.theme === "light" ? "active" : ""} onClick={() => setState({ theme: "light" })}>
          Light
        </button>
      </div>
    </div>
  );
}

function App() {
  const [state, setState] = useAppState();
  window.__APP_STATE_EXT = { state, setState };

  const [route, setRoute] = React.useState({ id: "dashboard" });
  const [range, setRange] = React.useState("1Y");
  const [showSplash, setShowSplash] = React.useState(true);
  const [, forceTick] = React.useReducer(x => x + 1, 0);

  React.useEffect(() => {
    const h = () => forceTick();
    window.addEventListener("strata:data-changed", h);
    window.addEventListener("strata:goals-changed", h);
    return () => {
      window.removeEventListener("strata:data-changed", h);
      window.removeEventListener("strata:goals-changed", h);
    };
  }, []);

  // Apply theme to root
  React.useEffect(() => {
    document.documentElement.setAttribute("data-theme", state.theme);
  }, [state.theme]);

  // Edit mode
  const [editMode, setEditMode] = React.useState(false);
  React.useEffect(() => {
    const onMsg = (e) => {
      if (!e.data) return;
      if (e.data.type === "__activate_edit_mode") setEditMode(true);
      if (e.data.type === "__deactivate_edit_mode") setEditMode(false);
    };
    window.addEventListener("message", onMsg);
    window.parent.postMessage({ type: "__edit_mode_available" }, "*");
    return () => window.removeEventListener("message", onMsg);
  }, []);

  const openAsset = (id) => setRoute({ id: "assets", assetId: id });
  const openCategory = (id) => setRoute({ id: "categories", categoryId: id });

  React.useEffect(() => {
    window.__APP_NAVIGATE = setRoute;
    return () => {
      try { delete window.__APP_NAVIGATE; } catch {}
    };
  }, [setRoute]);

  const renderScreen = () => {
    if (route.id === "dashboard") {
      if (state.dashboardVariant === "categories") {
        return (
          <DashboardCategories
            range={range}
            setRange={setRange}
            onOpenAsset={openAsset}
            onOpenCategory={openCategory}
            onAdd={() => setRoute({ id: "add" })}
          />
        );
      }
      if (state.dashboardVariant === "story") {
        return (
          <DashboardStory
            range={range}
            setRange={setRange}
            onAdd={() => setRoute({ id: "add" })}
          />
        );
      }
      return (
        <DashboardHero
          range={range}
          setRange={setRange}
          onOpenAsset={openAsset}
          onAdd={() => setRoute({ id: "add" })}
        />
      );
    }

    if (route.id === "history") return <HistoryScreen />;
    if (route.id === "allocation") return <AllocationScreen />;

    if (route.id === "goals") {
      if (route.goalId) {
        return <GoalDetailScreen goalId={route.goalId} onBack={() => setRoute({ id: "goals" })} />;
      }
      if (route.mode === "edit") {
        return <GoalEditScreen onDone={() => setRoute({ id: "goals" })} />;
      }
      return (
        <GoalsScreen
          onOpenGoal={(id) => setRoute({ id: "goals", goalId: id })}
          onAdd={() => setRoute({ id: "goals", mode: "edit" })}
        />
      );
    }

    if (route.id === "assets") {
      if (route.assetId) {
        return <AssetDetail assetId={route.assetId} onBack={() => setRoute({ id: "assets" })} />;
      }
      return <AssetsScreen onOpenAsset={openAsset} onAdd={() => setRoute({ id: "add" })} />;
    }

    if (route.id === "categories") {
      return <CategoriesScreen onOpenAsset={openAsset} onAdd={() => setRoute({ id: "add" })} />;
    }

    if (route.id === "add") {
      return <AddAssetScreen onDone={() => setRoute({ id: "assets" })} />;
    }

    if (route.id === "strata-ai") return <StrataAIScreen />;

    if (route.id === "news") {
      return (
        <NewsScreen
          onAskAI={(item) => {
            const c = window.strataChat.createConv();
            const prompt = `I'm reading this article and want your take.

Title: ${item.title}
Source: ${item.source || ""}
Summary: ${item.summary || item.description || ""}
URL: ${item.url || ""}

Please explain:
1. Why this matters
2. What it could mean for my portfolio
3. Whether I should do anything now`;

            const seeded = {
              id: "m" + Date.now(),
              role: "user",
              content: prompt,
              pending: true,
              ts: new Date().toISOString(),
            };

            window.strataChat.updateConv(c.id, {
              title: item.title?.slice(0, 60) || "News chat",
              messages: [seeded],
            });

            sessionStorage.setItem("strata.ai.autoSend", c.id);
            setRoute({ id: "strata-ai" });
          }}
        />
      );
    }

    if (route.id === "profile") return <ProfileScreen />;
    if (route.id === "settings") return <SettingsScreen />;

    return null;
  };

  return (
    <div className="app">
      <Sidebar route={route} setRoute={setRoute} />
      <main className="main">
        <Topbar route={route} setRoute={setRoute} state={state} setState={setState} />
        <div className="page">
          {renderScreen()}
        </div>
      </main>

      {editMode && <TweaksPanel state={state} setState={setState} />}
      {showSplash && <Splash onDone={() => setShowSplash(false)} />}
      <PasscodeLock onUnlock={() => {}} />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
