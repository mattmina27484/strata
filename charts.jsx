/* Charts: line chart with gradient fill, sparkline, donut */

function buildPath(points, width, height, padding = 0) {
  if (points.length < 2) return { line: "", area: "", min: 0, max: 0 };
  const vs = points.map(p => (typeof p === "number" ? p : p.v));
  const min = Math.min(...vs);
  const max = Math.max(...vs);
  const range = max - min || 1;
  const w = width - padding * 2;
  const h = height - padding * 2;
  const step = w / (vs.length - 1);

  const pts = vs.map((v, i) => ({
    x: padding + i * step,
    y: padding + h - ((v - min) / range) * h,
  }));

  // smooth catmull-rom
  let d = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }

  const area = d + ` L ${pts[pts.length - 1].x.toFixed(2)} ${height} L ${pts[0].x.toFixed(2)} ${height} Z`;
  return { line: d, area, min, max, pts };
}

function LineChart({ data, height = 340, showAxis = true, compareData = null, positive = true, accent = null }) {
  const ref = React.useRef(null);
  const [w, setW] = React.useState(900);
  const [hover, setHover] = React.useState(null);

  React.useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(entries => {
      setW(entries[0].contentRect.width);
    });
    ro.observe(ref.current);
    setW(ref.current.clientWidth);
    return () => ro.disconnect();
  }, []);

  const padT = 16, padB = 28, padX = 4;
  const chartH = height - padT - padB;
  const vs = data.map(d => d.v);
  const min = Math.min(...vs);
  const max = Math.max(...vs);
  const range = max - min || 1;
  const step = (w - padX * 2) / (data.length - 1);

  const pts = data.map((d, i) => ({
    x: padX + i * step,
    y: padT + chartH - ((d.v - min) / range) * chartH,
    t: d.t,
    v: d.v,
  }));

  // smooth path
  let line = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    line += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  const area = line + ` L ${pts[pts.length-1].x.toFixed(2)} ${padT + chartH} L ${pts[0].x.toFixed(2)} ${padT + chartH} Z`;

  const color = positive ? "var(--up)" : "var(--down)";
  const gid = "g" + React.useId().replace(/[^a-z0-9]/gi, "");

  // y ticks
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(t => ({
    y: padT + chartH - t * chartH,
    v: min + t * range,
  }));

  // x labels (roughly 5)
  const xCount = Math.min(6, data.length);
  const xLabels = [];
  for (let i = 0; i < xCount; i++) {
    const idx = Math.round((i / (xCount - 1)) * (data.length - 1));
    xLabels.push({ x: pts[idx].x, t: data[idx].t });
  }

  const fmtDate = (iso) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-AU', { month: 'short', day: 'numeric' });
  };

  const onMove = (e) => {
    const rect = ref.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const idx = Math.max(0, Math.min(data.length - 1, Math.round((x - padX) / step)));
    setHover({ ...pts[idx], idx });
  };

  return (
    <div className="chart-wrap" ref={ref} style={{ width: "100%", position: "relative" }}>
      <svg
        width={w} height={height}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
        style={{ display: "block", cursor: "crosshair" }}
      >
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.22" />
            <stop offset="60%" stopColor={color} stopOpacity="0.04" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* y grid */}
        {showAxis && yTicks.map((t, i) => (
          <g key={i}>
            <line x1={padX} x2={w - padX} y1={t.y} y2={t.y} stroke="var(--line)" strokeDasharray="2 4" opacity="0.5"/>
            <text x={w - padX - 4} y={t.y - 4} textAnchor="end" fontSize="10" fontFamily="var(--mono)" fill="var(--ink-4)">
              {formatMoney(t.v, { compact: true })}
            </text>
          </g>
        ))}

        {/* area */}
        <path d={area} fill={`url(#${gid})`} />
        <path d={line} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />

        {/* hover */}
        {hover && (
          <g>
            <line x1={hover.x} x2={hover.x} y1={padT} y2={padT+chartH} stroke="var(--ink-4)" strokeDasharray="3 3" opacity="0.6"/>
            <circle cx={hover.x} cy={hover.y} r="5" fill={color} />
            <circle cx={hover.x} cy={hover.y} r="10" fill={color} opacity="0.2" />
          </g>
        )}

        {/* x labels */}
        {showAxis && xLabels.map((l, i) => (
          <text key={i} x={l.x} y={height - 8} textAnchor="middle" fontSize="10" fontFamily="var(--mono)" fill="var(--ink-4)">
            {fmtDate(l.t)}
          </text>
        ))}
      </svg>

      {hover && (
        <div style={{
          position: "absolute",
          left: Math.min(w - 180, Math.max(4, hover.x + 10)),
          top: Math.max(4, hover.y - 50),
          background: "var(--bg-2)",
          border: "1px solid var(--line-2)",
          borderRadius: 10,
          padding: "8px 12px",
          pointerEvents: "none",
          fontSize: 12,
          boxShadow: "var(--shadow-2)",
          minWidth: 150,
        }}>
          <div style={{color: "var(--ink-3)", fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase"}}>
            {fmtDate(hover.t)}
          </div>
          <div style={{fontFamily: "var(--mono)", fontSize: 15, marginTop: 4}}>
            {formatMoney(hover.v)}
          </div>
        </div>
      )}
    </div>
  );
}

function Spark({ data, positive = true, width = 120, height = 28, strokeWidth = 1.4 }) {
  const { line } = React.useMemo(() => buildPath(data, width, height, 2), [data, width, height]);
  const color = positive ? "var(--up)" : "var(--down)";
  return (
    <svg className="spark" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <path d={line} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Donut({ segments, size = 220, thickness = 22, hoverIdx = null, onHover = () => {} }) {
  const total = segments.reduce((s, x) => s + Math.abs(x.value), 0);
  const r = (size - thickness) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;

  let offset = 0;
  const arcs = segments.map((seg, i) => {
    const pct = Math.abs(seg.value) / total;
    const len = circ * pct;
    const arc = (
      <circle
        key={seg.id}
        cx={cx} cy={cy} r={r}
        fill="none"
        stroke={seg.color}
        strokeWidth={hoverIdx === i ? thickness + 4 : thickness}
        strokeDasharray={`${len} ${circ - len}`}
        strokeDashoffset={-offset}
        transform={`rotate(-90 ${cx} ${cy})`}
        style={{ transition: "stroke-width .15s, opacity .15s", opacity: hoverIdx == null || hoverIdx === i ? 1 : 0.35, cursor: "pointer" }}
        onMouseEnter={() => onHover(i)}
        onMouseLeave={() => onHover(null)}
      />
    );
    offset += len;
    return arc;
  });

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ overflow: "visible" }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--bg-3)" strokeWidth={thickness} />
      {arcs}
    </svg>
  );
}

Object.assign(window, { LineChart, Spark, Donut });
