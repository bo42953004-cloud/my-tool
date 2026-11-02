import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

type VLine = { id: number; kind: 'v'; epoch: number };
type HLine = { id: number; kind: 'h'; price: number };
type Trend = {
  id: number;
  kind: 'trend';
  a: { epoch: number; price: number };
  b: { epoch: number; price: number } | null;
};
type Drawing = VLine | HLine | Trend;

type Tool = 'cursor' | 'v' | 'h' | 'trend';

/** Sensitivity presets: fraction of the visible price range needed to confirm a swing. */
const SENSITIVITY = [
  { label: 'Fast', value: 0.04 },
  { label: 'Normal', value: 0.07 },
  { label: 'Smooth', value: 0.12 },
];

const TOOLS: { id: Tool; label: string; hint: string; icon: React.ReactNode }[] = [
  {
    id: 'cursor',
    label: 'Cursor',
    hint: 'Inspect prices without drawing',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M4 4l7 17 2.5-7.5L21 11z" />
      </svg>
    ),
  },
  {
    id: 'v',
    label: 'Vertical',
    hint: 'Click to drop a vertical time marker',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M12 3v18M8 6h8M8 18h8" />
      </svg>
    ),
  },
  {
    id: 'h',
    label: 'Horizontal',
    hint: 'Click to draw a horizontal price level',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M3 12h18M6 8v8M18 8v8" />
      </svg>
    ),
  },
  {
    id: 'trend',
    label: 'Trend',
    hint: 'Click twice to join two points',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M4 20L20 4M3 17h3M18 7h3" />
      </svg>
    ),
  },
];

type Swing = { index: number; price: number; kind: 'high' | 'low'; tag: string; bull: boolean | null };

/**
 * Fractal pivot detection over a symmetric window.
 * `threshold` is a price distance, so noise smaller than it is ignored and the
 * remaining pivots alternate between highs and lows in time order.
 */
export function findSwings(pts: number[], threshold: number): Swing[] {
  if (pts.length < 3 || threshold <= 0) return [];
  const out: Swing[] = [];
  // 0 = no swing confirmed yet; track both extremes until price breaks away by `threshold`
  let dir: 0 | 1 | -1 = 0;
  let extIdx = 0;
  let extVal = pts[0];
  let oppIdx = 0;
  let oppVal = pts[0];
  for (let i = 1; i < pts.length && dir === 0; i++) {
    const v = pts[i];
    if (v > extVal) {
      extVal = v;
      extIdx = i;
    }
    if (v < oppVal) {
      oppVal = v;
      oppIdx = i;
    }
    if (extVal - v >= threshold) {
      out.push({ index: extIdx, price: extVal, kind: 'high', tag: '', bull: null });
      dir = -1;
      extVal = v;
      extIdx = i;
    } else if (v - oppVal >= threshold) {
      out.push({ index: oppIdx, price: oppVal, kind: 'low', tag: '', bull: null });
      dir = 1;
      extVal = v;
      extIdx = i;
    }
  }
  // a pivot is locked in once price pulls back from the running extreme by `threshold`
  for (let i = 1; i < pts.length; i++) {
    if (dir === 0) continue;
    const v = pts[i];
    if (dir === 1) {
      if (v > extVal) {
        extVal = v;
        extIdx = i;
      } else if (extVal - v >= threshold) {
        out.push({ index: extIdx, price: extVal, kind: 'high', tag: '', bull: null });
        dir = -1;
        extVal = v;
        extIdx = i;
      }
    } else {
      if (v < extVal) {
        extVal = v;
        extIdx = i;
      } else if (v - extVal >= threshold) {
        out.push({ index: extIdx, price: extVal, kind: 'low', tag: '', bull: null });
        dir = 1;
        extVal = v;
        extIdx = i;
      }
    }
  }
  // attach the still-forming extreme so a one-way move still shows its swing
  if (dir !== 0 && (out.length === 0 || out[out.length - 1].index !== extIdx)) {
    out.push({ index: extIdx, price: extVal, kind: dir === 1 ? 'high' : 'low', tag: '', bull: null });
  }
  let prevHigh: number | null = null;
  let prevLow: number | null = null;
  const TOL = 1e-9;
  for (const s of out) {
    if (s.kind === 'high') {
      if (prevHigh === null) s.tag = 'H';
      else if (Math.abs(s.price - prevHigh) < TOL) s.tag = 'EQH';
      else if (s.price > prevHigh) s.tag = 'HH';
      else s.tag = 'LH';
      s.bull = s.tag === 'HH' ? true : s.tag === 'LH' ? false : null;
      prevHigh = s.price;
    } else {
      if (prevLow === null) s.tag = 'L';
      else if (Math.abs(s.price - prevLow) < TOL) s.tag = 'EQL';
      else if (s.price < prevLow) s.tag = 'LL';
      else s.tag = 'HL';
      s.bull = s.tag === 'HL' ? true : s.tag === 'LL' ? false : null;
      prevLow = s.price;
    }
  }
  return out;
}

const UP = 'text-emerald-600 dark:text-emerald-400';
const DOWN = 'text-red-600 dark:text-red-400';
const RANGE = 'text-amber-600 dark:text-amber-400';
const NEUTRAL = 'text-slate-500 dark:text-slate-400';

/** Read the latest confirmed swing high against the latest confirmed swing low. */
function structureLabel(swings: Swing[]): { text: string; cls: string } {
  const highs = swings.filter((s) => s.kind === 'high' && s.tag !== 'H');
  const lows = swings.filter((s) => s.kind === 'low' && s.tag !== 'L');
  const h = highs[highs.length - 1]?.tag;
  const l = lows[lows.length - 1]?.tag;
  const allHighs = swings.filter((s) => s.kind === 'high');
  const allLows = swings.filter((s) => s.kind === 'low');
  if (!allHighs.length || !allLows.length) return { text: 'Collecting ticks… no confirmed swing yet', cls: NEUTRAL };
  // one swing each way means the market has moved in one leg without pulling back
  if (!h || !l)
    return swings[swings.length - 1].kind === 'high'
      ? { text: 'Pushing higher — no confirmed pullback yet (bias up)', cls: UP }
      : { text: 'Pushing lower — no confirmed rally yet (bias down)', cls: DOWN };
  if (h === 'HH' && l === 'HL') return { text: 'Higher highs + higher lows — uptrend', cls: UP };
  if (h === 'LH' && l === 'LL') return { text: 'Lower highs + lower lows — downtrend', cls: DOWN };
  if (h === 'HH' && l === 'LL') return { text: 'Higher highs + lower lows — expanding range', cls: RANGE };
  if (h === 'LH' && l === 'HL') return { text: 'Lower highs + higher lows — contracting range', cls: RANGE };
  if (h === 'EQH' && l === 'EQL') return { text: 'Equal highs + equal lows — flat range', cls: RANGE };
  if (h === 'HH' || h === 'HL') return { text: `Higher ${h === 'HH' ? 'highs' : 'lows'} only — bias up, other side unclear`, cls: UP };
  if (h === 'LH' || l === 'LL') return { text: `Lower ${h === 'LH' ? 'highs' : 'lows'} only — bias down, other side unclear`, cls: DOWN };
  return { text: 'Mixed structure — no clean read', cls: NEUTRAL };
}

export default function TickChart({
  prices,
  epochs,
  pip,
}: {
  prices: number[];
  epochs: number[];
  pip: number;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 720, h: 300 });
  const [tool, setTool] = useState<Tool>('cursor');
  const [showStructure, setShowStructure] = useState(true);
  const [sens, setSens] = useState(0.07);
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [hover, setHover] = useState<{ x: number; y: number; i: number } | null>(null);

  const pts = useMemo(() => prices.slice(-200), [prices]);
  const eps = useMemo(() => epochs.slice(-200), [epochs]);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: 300 });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const PAD = { top: 16, right: 62, bottom: 24, left: 10 };
  const W = Math.max(size.w, 320);
  const H = size.h;
  const plotW = Math.max(W - PAD.left - PAD.right, 10);
  const plotH = Math.max(H - PAD.top - PAD.bottom, 10);

  const domain = useMemo(() => {
    if (pts.length < 2) return { min: 0, max: 1 };
    let min = Math.min(...pts);
    let max = Math.max(...pts);
    if (max - min < 1e-9) {
      min -= 1;
      max += 1;
    }
    const pad = (max - min) * 0.08;
    return { min: min - pad, max: max + pad };
  }, [pts]);

  const xAt = useCallback((i: number) => PAD.left + (pts.length > 1 ? (i / (pts.length - 1)) * plotW : 0), [pts.length, plotW]);
  const yAt = useCallback((p: number) => PAD.top + (1 - (p - domain.min) / (domain.max - domain.min)) * plotH, [domain, plotH]);
  const indexAtX = useCallback((x: number) => Math.round(((x - PAD.left) / plotW) * (pts.length - 1)), [plotW, pts.length]);
  const priceAtY = useCallback((y: number) => domain.max - ((y - PAD.top) / plotH) * (domain.max - domain.min), [domain, plotH]);

  const epochIndex = useMemo(() => {
    const map = new Map<number, number>();
    eps.forEach((e, i) => map.set(e, i));
    return map;
  }, [eps]);

  const swings = useMemo(() => {
    if (!showStructure || pts.length < 5) return [];
    // a perfectly flat window has no meaningful swing structure
    const lo = Math.min(...pts);
    const hi = Math.max(...pts);
    if (hi - lo < 1e-9) return [];
    return findSwings(pts, (hi - lo) * sens);
  }, [pts, sens, showStructure]);
  const structure = useMemo(() => structureLabel(swings), [swings]);

  const path = useMemo(() => {
    if (pts.length < 2) return '';
    return pts.map((p, i) => `${xAt(i).toFixed(1)},${yAt(p).toFixed(1)}`).join(' ');
  }, [pts, xAt, yAt]);

  const areaPath = useMemo(() => {
    if (pts.length < 2) return '';
    return `M ${xAt(0).toFixed(1)},${(PAD.top + plotH).toFixed(1)} L ${path.replace(/ /g, ' L ')} L ${xAt(pts.length - 1).toFixed(1)},${(
      PAD.top + plotH
    ).toFixed(1)} Z`;
  }, [pts.length, path, xAt, plotH]);

  const fmt = useCallback((p: number) => p.toFixed(pip), [pip]);
  const timeOf = useCallback((e: number) => new Date(e * 1000).toLocaleTimeString([], { hour12: false }), []);

  const toLocal = useCallback((e: React.PointerEvent | React.MouseEvent) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, []);

  const inPlot = (x: number, y: number) => x >= PAD.left - 4 && x <= PAD.left + plotW + 4 && y >= PAD.top - 4 && y <= PAD.top + plotH + 4;

  const onMove = (e: React.PointerEvent) => {
    const l = toLocal(e);
    if (!l) return;
    const i = Math.min(Math.max(indexAtX(l.x), 0), pts.length - 1);
    setHover(inPlot(l.x, l.y) ? { x: l.x, y: l.y, i } : null);
  };

  const onClick = (e: React.MouseEvent) => {
    const l = toLocal(e);
    if (!l || !inPlot(l.x, l.y)) return;
    const epoch = eps[Math.min(Math.max(indexAtX(l.x), 0), pts.length - 1)];
    const price = Number(priceAtY(l.y).toFixed(pip));
    if (tool === 'v') {
      if (epoch == null) return;
      setDrawings((d) => [...d, { id: Date.now(), kind: 'v', epoch }]);
    } else if (tool === 'h') {
      setDrawings((d) => [...d, { id: Date.now(), kind: 'h', price }]);
    } else if (tool === 'trend') {
      const point = { epoch, price };
      setDrawings((d) => {
        const pending = d.find((x) => x.kind === 'trend' && x.b === null) as Trend | undefined;
        if (!pending) return [...d, { id: Date.now(), kind: 'trend', a: point, b: null }];
        return d.map((x) => (x.id === pending.id ? { ...x, b: point } : x));
      });
    }
  };

  useEffect(() => {
    if (tool !== 'trend') return;
    const esc = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') setDrawings((d) => d.filter((x) => !(x.kind === 'trend' && x.b === null)));
    };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [tool]);

  const hoverPrice = hover && pts.length ? pts[hover.i] : null;
  const hoverEpoch = hover && eps.length ? eps[hover.i] : null;

  const gridCount = 4;
  const grid = useMemo(
    () =>
      Array.from({ length: gridCount + 1 }, (_, k) => {
        const p = domain.min + ((domain.max - domain.min) * k) / gridCount;
        return { p, y: yAt(p) };
      }),
    [domain, yAt],
  );

  const cursor = tool === 'cursor' ? 'crosshair' : tool === 'trend' ? 'crosshair' : 'copy';

  if (pts.length < 2)
    return (
      <div ref={wrapRef} className="grid h-[300px] place-items-center text-sm text-slate-400 dark:text-slate-500">
        Waiting for ticks…
      </div>
    );

  return (
    <div ref={wrapRef} className="w-full">
      {/* Toolbar */}
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              setTool(t.id);
              setDrawings((d) => d.filter((x) => !(x.kind === 'trend' && x.b === null)));
            }}
            title={t.hint}
            className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-semibold transition ${
              tool === t.id
                ? 'border-indigo-600 bg-indigo-600 text-white dark:border-indigo-500 dark:bg-indigo-500'
                : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
        <span className="mx-1 h-5 w-px bg-slate-200 dark:bg-slate-700" />
        <button
          onClick={() => setShowStructure((s) => !s)}
          title="Mark higher highs and higher lows on the chart"
          className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-semibold transition ${
            showStructure
              ? 'border-emerald-600 bg-emerald-600 text-white dark:border-emerald-500 dark:bg-emerald-500'
              : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
          }`}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M3 17l5-6 4 3 6-8" />
            <path d="M14 6h4v4" />
          </svg>
          HH / LL
        </button>
        <div className="flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-1 py-0.5 dark:border-slate-700 dark:bg-slate-800">
          <span className="pl-1 text-[10px] font-semibold text-slate-500 dark:text-slate-400">Swings</span>
          {SENSITIVITY.map((o) => (
            <button
              key={o.value}
              onClick={() => setSens(o.value)}
              title={`Confirm a swing after a ${Math.round(o.value * 100)}% reversal of the visible range`}
              className={`rounded px-1.5 text-[11px] font-bold transition ${
                sens === o.value
                  ? 'bg-slate-700 text-white dark:bg-slate-600'
                  : 'text-slate-600 hover:bg-slate-200/70 dark:text-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setDrawings([])}
          className="ml-auto rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
        >
          Clear ({drawings.length})
        </button>
      </div>

      <div className="relative">
        <svg ref={svgRef} width={W} height={H} className="block touch-none select-none" onPointerMove={onMove} onPointerLeave={() => setHover(null)} onClick={onClick} style={{ cursor }}>
          {/* plot background */}
          <rect x={PAD.left} y={PAD.top} width={plotW} height={plotH} className="fill-slate-50/70 dark:fill-slate-950/60" />

          {/* grid + price axis */}
          {grid.map((g, i) => (
            <g key={i}>
              <line x1={PAD.left} x2={PAD.left + plotW} y1={g.y} y2={g.y} className="stroke-slate-200 dark:stroke-slate-800" strokeWidth="1" />
              <text x={PAD.left + plotW + 6} y={g.y + 3.5} className="fill-slate-400 dark:fill-slate-500" fontSize="9.5" fontFamily="ui-monospace, monospace">
                {fmt(g.p)}
              </text>
            </g>
          ))}

          {/* area + price line */}
          <path d={areaPath} className="fill-indigo-500/10 dark:fill-indigo-400/10" />
          <polyline points={path} fill="none" className="stroke-indigo-500 dark:stroke-indigo-400" strokeWidth="1.6" vectorEffect="non-scaling-stroke" />

          {/* structure: trendlines linking swing highs and swing lows */}
          {showStructure &&
            ([
              { kind: 'high' as const, cls: 'stroke-emerald-500/60 dark:stroke-emerald-400/50' },
              { kind: 'low' as const, cls: 'stroke-rose-500/60 dark:stroke-rose-400/50' },
            ]).map(({ kind, cls }) => {
              const sw = swings.filter((s) => s.kind === kind);
              const d = sw.map((s) => `${xAt(s.index).toFixed(1)},${yAt(s.price).toFixed(1)}`).join(' ');
              return sw.length > 1 ? <polyline key={kind} points={d} fill="none" className={cls} strokeWidth="1" strokeDasharray="4 3" /> : null;
            })}

          {/* structure labels */}
          {showStructure &&
            swings.map((s, i) => (
              <text
                key={`${s.kind}-${s.index}-${i}`}
                x={xAt(s.index)}
                y={s.kind === 'high' ? yAt(s.price) - 6 : yAt(s.price) + 14}
                textAnchor="middle"
                fontSize="9"
                fontWeight="700"
                className={
                  s.tag === 'HH' || s.tag === 'HL'
                    ? 'fill-emerald-600 dark:fill-emerald-400'
                    : s.tag === 'LH' || s.tag === 'LL'
                      ? 'fill-red-600 dark:fill-red-400'
                      : 'fill-amber-600 dark:fill-amber-400'
                }
              >
                {s.tag === 'H' || s.tag === 'L' ? '' : s.tag}
              </text>
            ))}

          {/* drawings */}
          {drawings.map((d) => {
            if (d.kind === 'v') {
              const i = epochIndex.get(d.epoch);
              if (i === undefined) return null;
              const x = xAt(i);
              return (
                <g key={d.id}>
                  <line x1={x} x2={x} y1={PAD.top} y2={PAD.top + plotH} className="stroke-violet-500 dark:stroke-violet-400" strokeWidth="1.2" strokeDasharray="5 4" />
                  <rect x={x - 26} y={PAD.top + plotH + 3} width="52" height="14" rx="2" className="fill-violet-600 dark:fill-violet-500" />
                  <text x={x} y={PAD.top + plotH + 13} textAnchor="middle" fontSize="9" fontWeight="700" fill="#fff" fontFamily="ui-monospace, monospace">
                    {timeOf(d.epoch)}
                  </text>
                </g>
              );
            }
            if (d.kind === 'h') {
              const y = yAt(d.price);
              return (
                <g key={d.id}>
                  <line x1={PAD.left} x2={PAD.left + plotW} y1={y} y2={y} className="stroke-amber-500 dark:stroke-amber-400" strokeWidth="1.2" strokeDasharray="5 4" />
                  <rect x={PAD.left + plotW + 2} y={y - 7} width={PAD.right - 6} height="14" rx="2" className="fill-amber-500 dark:fill-amber-400" />
                  <text x={PAD.left + plotW + 6} y={y + 3.5} fontSize="9" fontWeight="700" className="fill-amber-950 dark:fill-amber-950" fontFamily="ui-monospace, monospace">
                    {fmt(d.price)}
                  </text>
                </g>
              );
            }
            const ax = d.a.epoch != null ? xAt(epochIndex.get(d.a.epoch) ?? 0) : 0;
            const ay = yAt(d.a.price);
            const bi = d.b ? epochIndex.get(d.b.epoch) : undefined;
            const bx = d.b && bi !== undefined ? xAt(bi) : hover ? hover.x : ax;
            const by = d.b ? yAt(d.b.price) : hover ? hover.y : ay;
            return (
              <g key={d.id}>
                <line x1={ax} x2={bx} y1={ay} y2={by} className="stroke-sky-500 dark:stroke-sky-400" strokeWidth="1.4" strokeDasharray={d.b ? undefined : '4 3'} />
                <circle cx={ax} cy={ay} r="3" className="fill-sky-500 dark:fill-sky-400" />
                {d.b && <circle cx={bx} cy={by} r="3" className="fill-sky-500 dark:fill-sky-400" />}
                {d.b && (
                  <text x={(ax + bx) / 2} y={(ay + by) / 2 - 6} textAnchor="middle" fontSize="9" fontWeight="700" className="fill-sky-600 dark:fill-sky-400" fontFamily="ui-monospace, monospace">
                    {fmt(d.b.price - d.a.price)}
                  </text>
                )}
              </g>
            );
          })}

          {/* crosshair */}
          {hover && (
            <g>
              <line x1={hover.x} x2={hover.x} y1={PAD.top} y2={PAD.top + plotH} className="stroke-slate-400/70 dark:stroke-slate-500/70" strokeWidth="1" strokeDasharray="3 3" />
              <line x1={PAD.left} x2={PAD.left + plotW} y1={hover.y} y2={hover.y} className="stroke-slate-400/70 dark:stroke-slate-500/70" strokeWidth="1" strokeDasharray="3 3" />
              <circle cx={xAt(hover.i)} cy={yAt(pts[hover.i])} r="3" className="fill-violet-600 dark:fill-violet-400" />
            </g>
          )}

          {/* time axis */}
          {[0, Math.floor((pts.length - 1) / 2), pts.length - 1].map((i) =>
            eps[i] == null ? null : (
              <text key={i} x={Math.min(Math.max(xAt(i), 18), PAD.left + plotW - 18)} y={H - 7} textAnchor="middle" fontSize="9.5" className="fill-slate-400 dark:fill-slate-500" fontFamily="ui-monospace, monospace">
                {timeOf(eps[i])}
              </text>
            ),
          )}
        </svg>

        {/* readout */}
        <div className="pointer-events-none absolute left-2 top-2 flex flex-wrap gap-2 rounded-md border border-slate-200 bg-white/85 px-2 py-1 text-[10px] font-semibold text-slate-600 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-900/85 dark:text-slate-300">
          {hoverPrice != null ? (
            <>
              <span className="font-mono">
                {fmt(hoverPrice)}
                <span className="text-violet-600 dark:text-violet-400">·{String(hoverPrice).slice(-1)}</span>
              </span>
              {hoverEpoch != null && <span className="font-mono text-slate-400 dark:text-slate-500">{timeOf(hoverEpoch)}</span>}
              <span className="text-slate-400 dark:text-slate-500">tick {hover!.i + 1}/{pts.length}</span>
            </>
          ) : (
            <>
              <span>H {fmt(domain.max)}</span>
              <span>L {fmt(domain.min)}</span>
              <span className="text-slate-400 dark:text-slate-500">{tool === 'cursor' ? 'hover to inspect' : `click to draw ${tool}`}</span>
            </>
          )}
        </div>
      </div>

      {/* legend + structure read-out */}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px]">
        {[
          { t: 'HH higher high', c: 'text-emerald-600 dark:text-emerald-400' },
          { t: 'HL higher low', c: 'text-emerald-600 dark:text-emerald-400' },
          { t: 'LH lower high', c: 'text-red-600 dark:text-red-400' },
          { t: 'LL lower low', c: 'text-red-600 dark:text-red-400' },
          { t: 'EQ equal', c: 'text-amber-600 dark:text-amber-400' },
        ].map((l) => (
          <span key={l.t} className={`font-bold ${l.c}`}>
            {l.t}
          </span>
        ))}
        <span className={`ml-auto text-[11px] font-bold ${structure.cls}`}>{structure.text}</span>
      </div>
      {drawings.some((d) => d.kind === 'v' && !epochIndex.has(d.epoch)) && (
        <p className="mt-1 text-[10px] text-slate-400 dark:text-slate-500">Some vertical markers have scrolled out of the last 200 ticks shown.</p>
      )}
    </div>
  );
}
