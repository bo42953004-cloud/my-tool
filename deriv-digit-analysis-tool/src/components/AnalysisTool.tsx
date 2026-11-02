import { useMemo, useState } from 'react';
import { MARKETS } from '../lib/deriv';
import { useMarket } from '../lib/useMarket';
import { digitStats } from '../lib/analysis';
import PriceTicker from './PriceTicker';
import TickChart from './TickChart';

function Bar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs font-semibold text-slate-600 dark:text-slate-300">
        <span>{label}</span>
        <span>{value.toFixed(1)}%</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div className={`h-full rounded-full ${color} transition-all duration-300`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

export default function AnalysisTool({ ticks }: { ticks: number }) {
  const [symbol, setSymbol] = useState('1HZ100V');
  const [barrier, setBarrier] = useState(4);
  const def = MARKETS.find((x) => x.symbol === symbol)!;
  const m = useMarket(symbol);
  const digits = useMemo(() => m.digits.slice(-ticks), [m.digits, ticks]);
  const prices = useMemo(() => m.prices.slice(-ticks), [m.prices, ticks]);
  const st = useMemo(() => digitStats(digits), [digits]);
  const n = digits.length || 1;
  const even = (digits.filter((d) => d % 2 === 0).length / n) * 100;
  const over = (digits.filter((d) => d > barrier).length / n) * 100;
  const under = (digits.filter((d) => d < barrier).length / n) * 100;
  let rise = 0, fall = 0;
  for (let i = 1; i < prices.length; i++) {
    if (prices[i] > prices[i - 1]) rise++;
    else if (prices[i] < prices[i - 1]) fall++;
  }
  const moves = Math.max(prices.length - 1, 1);

  // streak of same parity
  let streak = 0;
  if (digits.length) {
    const p = digits[digits.length - 1] % 2;
    for (let i = digits.length - 1; i >= 0 && digits[i] % 2 === p; i--) streak++;
  }

  const maxPct = Math.max(...st.pct, 1);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 p-4">
        <select
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        >
          {MARKETS.map((x) => (
            <option key={x.symbol} value={x.symbol}>{x.name}</option>
          ))}
        </select>
        <PriceTicker m={m} big />
        <span className="ml-auto text-sm text-slate-500 dark:text-slate-400">Analysing last {digits.length} ticks</span>
      </div>

      {def.note && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">⚠ Note: {def.note}</div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 p-4 lg:col-span-2">
          <h4 className="mb-2 text-sm font-bold text-slate-700 dark:text-slate-200">Tick Movement (last 200)</h4>
          <TickChart prices={m.prices} epochs={m.epochs} pip={m.pip} />
        </div>
        <div className="space-y-4 rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 p-4">
          <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200">Even / Odd</h4>
          <Bar label="Even" value={even} color="bg-sky-500" />
          <Bar label="Odd" value={100 - even} color="bg-rose-500" />
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Current streak: <b>{streak}</b> × {digits.length && digits[digits.length - 1] % 2 === 0 ? 'Even' : 'Odd'}
          </p>
          <h4 className="pt-2 text-sm font-bold text-slate-700 dark:text-slate-200">Rise / Fall</h4>
          <Bar label="Rise" value={(rise / moves) * 100} color="bg-emerald-500" />
          <Bar label="Fall" value={(fall / moves) * 100} color="bg-red-500" />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 p-4 lg:col-span-2">
          <h4 className="mb-3 text-sm font-bold text-slate-700 dark:text-slate-200">Digit Distribution</h4>
          <div className="flex h-48 items-end gap-2">
            {st.pct.map((p, d) => (
              <div key={d} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">{p.toFixed(1)}</span>
                <div
                  className={`w-full rounded-t transition-all duration-300 ${
                    d === st.most ? 'bg-emerald-500' : d === st.second ? 'bg-blue-500' : d === st.least ? 'bg-red-500' : d === st.secondLeast ? 'bg-orange-500' : 'bg-slate-300 dark:bg-slate-600'
                  } ${st.current === d ? 'outline-3 outline-violet-600' : ''}`}
                  style={{ height: `${(p / maxPct) * 140}px` }}
                />
                <span className="text-sm font-bold">{d}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-4 rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 p-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200">Over / Under</h4>
            <div className="flex gap-1">
              {Array.from({ length: 10 }, (_, d) => (
                <button
                  key={d}
                  onClick={() => setBarrier(d)}
                  className={`h-6 w-6 rounded text-xs font-bold ${barrier === d ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
          <Bar label={`Over ${barrier}`} value={over} color="bg-emerald-500" />
          <Bar label={`Under ${barrier}`} value={under} color="bg-orange-500" />
          <Bar label={`Matches ${barrier}`} value={st.pct[barrier]} color="bg-violet-500" />
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 p-4">
        <h4 className="mb-2 text-sm font-bold text-slate-700 dark:text-slate-200">Last 60 Digits</h4>
        <div className="flex flex-wrap gap-1.5">
          {m.digits.slice(-60).map((d, i, a) => (
            <span
              key={m.epochs[m.epochs.length - a.length + i]}
              className={`grid h-8 w-8 place-items-center rounded-full text-sm font-bold ${
                i === a.length - 1 ? 'bg-violet-600 text-white ring-2 ring-violet-300' : d % 2 === 0 ? 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300' : 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
              }`}
            >
              {d}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
