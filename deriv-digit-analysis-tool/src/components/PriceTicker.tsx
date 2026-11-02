import type { MarketState } from '../lib/deriv';

export default function PriceTicker({ m, big = false }: { m: MarketState; big?: boolean }) {
  const n = m.prices.length;
  if (!n) return <span className="text-xs text-slate-400 dark:text-slate-500">—</span>;
  const q = m.prices[n - 1];
  const prev = n > 1 ? m.prices[n - 2] : q;
  const dir = q > prev ? 'up' : q < prev ? 'down' : 'flat';
  const s = q.toFixed(m.pip);
  const color =
    dir === 'up'
      ? 'text-emerald-600 dark:text-emerald-400'
      : dir === 'down'
        ? 'text-red-600 dark:text-red-400'
        : 'text-slate-500 dark:text-slate-400';
  return (
    <span
      key={m.epochs[n - 1]}
      className={`tick-flash inline-flex items-center gap-1 font-mono tabular-nums ${big ? 'text-3xl font-bold' : 'text-xs font-semibold'} ${color}`}
    >
      {dir === 'up' ? '▲' : dir === 'down' ? '▼' : '■'}
      <span className="text-slate-700 dark:text-slate-100">{s.slice(0, -1)}</span>
      <span className={`${color} underline decoration-2 underline-offset-2`}>{s.slice(-1)}</span>
    </span>
  );
}
