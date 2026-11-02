import { useMemo } from 'react';
import type { MarketDef } from '../lib/deriv';
import { useMarket } from '../lib/useMarket';
import { digitStats, getSignals } from '../lib/analysis';
import DigitCircle from './DigitCircle';
import PriceTicker from './PriceTicker';
import Comparison from './Comparison';

export default function MarketCard({
  def,
  ticks,
  scanning,
  onToggleScan,
}: {
  def: MarketDef;
  ticks: number;
  scanning: boolean;
  onToggleScan: () => void;
}) {
  const m = useMarket(def.symbol);
  const digits = useMemo(() => m.digits.slice(-ticks), [m.digits, ticks]);
  const prices = useMemo(() => m.prices.slice(-Math.max(ticks, 2)), [m.prices, ticks]);
  const st = useMemo(() => digitStats(digits), [digits]);
  const signals = useMemo(() => (scanning ? getSignals(digits) : []), [digits, scanning]);
  const rankOf = (d: number) =>
    !st.total ? null : d === st.most ? 'most' : d === st.second ? 'second' : d === st.least ? 'least' : d === st.secondLeast ? 'secondLeast' : null;
  const hasStrong = signals.some((s) => s.strength === 'strong');

  return (
    <div
      className={`rounded-xl border bg-white p-4 shadow-sm transition-colors dark:bg-slate-900 ${
        scanning
          ? hasStrong
            ? 'border-emerald-400 ring-2 ring-emerald-200 dark:border-emerald-600 dark:ring-emerald-900/60'
            : 'border-indigo-300 ring-1 ring-indigo-100 dark:border-indigo-700 dark:ring-indigo-900/60'
          : 'border-slate-200 dark:border-slate-800'
      }`}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-[15px] font-bold text-slate-800 dark:text-slate-100">{def.name}</h3>
          <div className="mt-0.5 flex flex-wrap items-center gap-2">
            <span
              className={`h-2 w-2 rounded-full ${
                m.status === 'live' ? 'animate-pulse bg-emerald-500' : m.status === 'error' ? 'bg-red-500' : 'bg-amber-400'
              }`}
            />
            {m.status === 'error' ? (
              <span className="text-xs text-red-500 dark:text-red-400">{m.error}</span>
            ) : (
              <PriceTicker m={m} />
            )}
            <span className="text-[10px] text-slate-400 dark:text-slate-500">{st.total} ticks</span>
          </div>
        </div>
        <button
          onClick={onToggleScan}
          className={`shrink-0 rounded-md border px-2.5 py-1 text-[11px] font-semibold transition ${
            scanning
              ? 'border-indigo-600 bg-indigo-600 text-white hover:bg-indigo-700'
              : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          {scanning ? 'Stop Scan' : 'Start Auto Scan'}
        </button>
      </div>

      {def.note && (
        <div className="mb-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 dark:border-amber-700/70 dark:bg-amber-950/40 dark:text-amber-200">
          ⚠ Note: {def.note}
        </div>
      )}

      {m.status === 'connecting' && !st.total ? (
        <div className="grid grid-cols-5 justify-items-center gap-y-1 py-1">
          {Array.from({ length: 10 }, (_, d) => (
            <div key={d} className="flex flex-col items-center">
              <div className="grid h-14 w-14 animate-pulse place-items-center rounded-full border-2 border-slate-200 bg-slate-100 text-lg font-bold text-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-600 sm:h-[60px] sm:w-[60px]">
                {d}
              </div>
              <div className="mt-1 h-2 w-8 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
            </div>
          ))}
        </div>
      ) : m.status === 'error' && !st.total ? (
        <div className="grid h-[150px] place-items-center rounded-lg bg-red-50 text-center text-xs text-red-600 dark:bg-red-950/40 dark:text-red-300">
          <div>
            <p className="font-semibold">Could not load ticks</p>
            <p className="mt-1 max-w-[220px]">{m.error}</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-5 justify-items-center gap-y-1">
          {Array.from({ length: 10 }, (_, d) => (
            <DigitCircle key={d} digit={d} pct={st.pct[d]} rank={rankOf(d)} current={st.current === d} />
          ))}
        </div>
      )}

      <div className="mt-2 flex gap-1 overflow-hidden">
        {m.digits.slice(-20).map((d, i, arr) => (
          <span
            key={m.epochs[m.epochs.length - arr.length + i]}
            className={`grid h-5 w-5 shrink-0 place-items-center rounded text-[10px] font-bold ${
              i === arr.length - 1
                ? 'bg-violet-600 text-white dark:bg-violet-500'
                : d % 2 === 0
                  ? 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300'
                  : 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
            }`}
          >
            {d}
          </span>
        ))}
      </div>

      {st.total > 0 && (
        <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-800">
          <Comparison digits={digits} prices={prices} />
        </div>
      )}

      {scanning && (
        <div className="mt-3 border-t border-slate-100 pt-2 dark:border-slate-800">
          {signals.length === 0 ? (
            <p className="text-xs text-slate-400 dark:text-slate-500">Scanning… no edge detected yet.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {signals.map((s) => (
                <span
                  key={s.label}
                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    s.strength === 'strong'
                      ? 'bg-emerald-600 text-white dark:bg-emerald-500 dark:text-emerald-950'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200'
                  }`}
                >
                  {s.label} {s.value.toFixed(1)}%
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
