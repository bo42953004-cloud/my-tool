import { useMemo } from 'react';

const pct = (part: number, total: number) => (total > 0 ? (part / total) * 100 : 0);

function Row({
  title,
  leftLabel,
  rightLabel,
  leftPct,
  rightPct,
  neutralLabel,
  neutralPct,
  leftCount,
  rightCount,
  leading,
}: {
  title: string;
  leftLabel: string;
  rightLabel: string;
  leftPct: number;
  rightPct: number;
  neutralLabel?: string;
  neutralPct?: number;
  leftCount: number;
  rightCount: number;
  leading: 'left' | 'right' | 'even';
}) {
  return (
    <div title={`${title}: ${leftLabel} ${leftCount} · ${rightLabel} ${rightCount}`}>
      <div className="mb-1 flex items-baseline justify-between gap-2 text-[11px]">
        <span className="flex items-center gap-1.5 font-semibold text-slate-600 dark:text-slate-300">
          <span className={`h-1.5 w-1.5 rounded-full ${leading === 'left' ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`} />
          {leftLabel}
          <b className={`tabular-nums ${leading === 'left' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-200'}`}>
            {leftPct.toFixed(1)}%
          </b>
        </span>
        <span className="flex items-center gap-1.5 font-semibold text-slate-600 dark:text-slate-300">
          <b className={`tabular-nums ${leading === 'right' ? 'text-rose-600 dark:text-rose-400' : 'text-slate-700 dark:text-slate-200'}`}>
            {rightPct.toFixed(1)}%
          </b>
          {rightLabel}
          <span className={`h-1.5 w-1.5 rounded-full ${leading === 'right' ? 'bg-rose-500' : 'bg-slate-300 dark:bg-slate-600'}`} />
        </span>
      </div>
      <div className="relative flex h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div className="h-full bg-emerald-500 transition-all duration-500 dark:bg-emerald-400" style={{ width: `${leftPct}%` }} />
        <div className="h-full bg-rose-500 transition-all duration-500 dark:bg-rose-400" style={{ width: `${rightPct}%` }} />
        <div className="absolute inset-y-0 left-1/2 w-[2px] -translate-x-1/2 bg-white dark:bg-slate-900" />
      </div>
      {neutralLabel !== undefined && neutralPct !== undefined && (
        <p className="mt-0.5 text-[10px] font-medium text-slate-400 dark:text-slate-500">
          {neutralLabel} {(neutralPct ?? 0).toFixed(1)}%
        </p>
      )}
    </div>
  );
}

export default function Comparison({ digits, prices }: { digits: number[]; prices: number[] }) {
  const stats = useMemo(() => {
    const n = digits.length;
    const even = digits.filter((d) => d % 2 === 0).length;
    const over5 = digits.filter((d) => d > 5).length;
    const under4 = digits.filter((d) => d < 4).length;
    const neutral = n - over5 - under4;
    let rise = 0;
    let fall = 0;
    const window = prices.slice(-Math.max(n, 2));
    for (let i = 1; i < window.length; i++) {
      if (window[i] > window[i - 1]) rise++;
      else if (window[i] < window[i - 1]) fall++;
    }
    const moves = Math.max(window.length - 1, 1);
    const flat = Math.max(window.length - 1 - rise - fall, 0);
    return { n, even, odd: n - even, over5, under4, neutral, rise, fall, flat, moves };
  }, [digits, prices]);

  const evenPct = pct(stats.even, stats.n);
  const overPct = pct(stats.over5, stats.n);
  const risePct = pct(stats.rise, stats.moves);
  const leader = (a: number, b: number): 'left' | 'right' | 'even' => (a === b ? 'even' : a > b ? 'left' : 'right');

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">50/50 Market Comparison</h4>
        <span className="text-[10px] text-slate-400 dark:text-slate-500">past {stats.n} ticks</span>
      </div>
      <div className="space-y-2">
        <Row
          title="Even vs Odd digits"
          leftLabel="Even"
          rightLabel="Odd"
          leftPct={evenPct}
          rightPct={100 - evenPct}
          leftCount={stats.even}
          rightCount={stats.odd}
          leading={leader(stats.even, stats.odd)}
        />
        <Row
          title="Over 5 vs Under 4 digits"
          leftLabel="Over 5"
          rightLabel="Under 4"
          leftPct={overPct}
          rightPct={pct(stats.under4, stats.n)}
          neutralLabel="Neutral 4 & 5"
          neutralPct={pct(stats.neutral, stats.n)}
          leftCount={stats.over5}
          rightCount={stats.under4}
          leading={leader(stats.over5, stats.under4)}
        />
        <Row
          title="Rise vs Fall tick movement"
          leftLabel="▲ Rise"
          rightLabel="Fall ▼"
          leftPct={risePct}
          rightPct={pct(stats.fall, stats.moves)}
          neutralLabel="Flat ticks"
          neutralPct={pct(stats.flat, stats.moves)}
          leftCount={stats.rise}
          rightCount={stats.fall}
          leading={leader(stats.rise, stats.fall)}
        />
      </div>
    </div>
  );
}
