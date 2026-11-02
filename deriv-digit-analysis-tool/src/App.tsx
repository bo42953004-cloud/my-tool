import { useEffect, useMemo, useState } from 'react';
import { feed, MARKETS } from './lib/deriv';
import { useAllMarkets, useFeedStatus } from './lib/useMarket';
import { getSignals } from './lib/analysis';
import MarketCard from './components/MarketCard';
import AnalysisTool from './components/AnalysisTool';

const TICK_OPTIONS = [30, 60, 100, 120, 240, 500, 1000];
const LEGEND = [
  { c: 'bg-emerald-600', t: 'Most', tc: 'text-emerald-600 dark:text-emerald-400' },
  { c: 'bg-blue-600', t: '2nd Most', tc: 'text-blue-600 dark:text-blue-400' },
  { c: 'bg-red-600', t: 'Least', tc: 'text-red-600 dark:text-red-400' },
  { c: 'bg-orange-500', t: '2nd Least', tc: 'text-orange-500 dark:text-orange-400' },
  { c: 'bg-violet-600', t: 'Current', tc: 'text-slate-600 dark:text-slate-300' },
];

type Theme = 'light' | 'dark';

function getInitialTheme(): Theme {
  try {
    const saved = localStorage.getItem('dcircle-theme');
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    /* storage unavailable */
  }
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export default function App() {
  const [tab, setTab] = useState<'circle' | 'tool'>('circle');
  const [ticks, setTicks] = useState(120);
  const [scan, setScan] = useState<Record<string, boolean>>({});
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const markets = useAllMarkets();
  const status = useFeedStatus();
  const connected = status.connected;

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    root.style.colorScheme = theme;
    try {
      localStorage.setItem('dcircle-theme', theme);
    } catch {
      /* storage unavailable */
    }
  }, [theme]);

  const scanned = MARKETS.filter((m) => scan[m.symbol]);
  const allOn = scanned.length === MARKETS.length;

  const strong = useMemo(() => {
    const list: { name: string; label: string; value: number }[] = [];
    for (const def of MARKETS) {
      if (!scan[def.symbol]) continue;
      for (const s of getSignals(markets[def.symbol].digits.slice(-ticks)))
        if (s.strength === 'strong') list.push({ name: def.name, label: s.label, value: s.value });
    }
    return list;
  }, [markets, scan, ticks]);

  return (
    <div className="min-h-screen bg-slate-100/70 px-3 py-4 text-slate-800 transition-colors dark:bg-slate-950 dark:text-slate-100 sm:px-6">
      <div className="mx-auto max-w-[1800px]">
        {/* Tabs + theme */}
        <div className="flex flex-wrap items-stretch gap-1.5">
          <div className="grid min-w-[240px] flex-1 grid-cols-2 gap-1.5">
            <button
              onClick={() => setTab('circle')}
              className={`rounded-sm border py-2 text-lg transition ${
                tab === 'circle'
                  ? 'border-[#0f2a6e] bg-[#0f2a6e] text-white shadow dark:border-indigo-600 dark:bg-indigo-600'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              DCIRCLE
            </button>
            <button
              onClick={() => setTab('tool')}
              className={`rounded-sm border py-2 text-lg transition ${
                tab === 'tool'
                  ? 'border-[#0f2a6e] bg-[#0f2a6e] text-white shadow dark:border-indigo-600 dark:bg-indigo-600'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              AnalysisTool
            </button>
          </div>
          <button
            onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            className="flex items-center justify-center gap-2 rounded-sm border border-slate-300 bg-white px-4 py-1 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {theme === 'dark' ? (
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
              </svg>
            ) : (
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
              </svg>
            )}
            <span className="hidden sm:inline">{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
          </button>
        </div>

        {/* Tick selector */}
        <div className="my-4 flex flex-wrap items-center justify-center gap-3">
          <span className="text-xs font-bold tracking-[0.15em] text-slate-600 dark:text-slate-400">NO. OF TICKS</span>
          <div className="flex flex-wrap rounded-lg border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-900">
            {TICK_OPTIONS.map((t) => (
              <button
                key={t}
                onClick={() => setTicks(t)}
                className={`rounded-md px-3 py-0.5 text-sm font-semibold transition ${
                  ticks === t
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <span
            className={`flex items-center gap-1.5 text-xs font-semibold ${
              connected ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
            }`}
          >
            <span className={`h-2 w-2 animate-pulse rounded-full ${connected ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            {connected ? 'Live · Deriv feed' : status.state === 'offline' ? 'Feed disconnected' : 'Connecting to Deriv…'}
          </span>
          <button
            onClick={feed.refresh}
            disabled={status.refreshing}
            title="Reload tick history for all markets"
            className="flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={status.refreshing ? 'animate-spin' : ''}
            >
              <path d="M23 4v6h-6" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
            {status.refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
          {!connected && (
            <button
              onClick={feed.retryNow}
              className="rounded-md border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-200 dark:hover:bg-amber-900/60"
            >
              Retry
            </button>
          )}
        </div>

        {!connected && status.error && (
          <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
            <span>
              <b>Market feed unavailable:</b> {status.error} The tool keeps retrying automatically. Check that your network or browser is not blocking{' '}
              <code className="font-semibold">wss://api.derivws.com</code>.
            </span>
            <button onClick={feed.retryNow} className="rounded-md bg-amber-800 px-2 py-1 font-bold text-white dark:bg-amber-600 dark:text-amber-950">
              Reconnect now
            </button>
          </div>
        )}

        {tab === 'tool' ? (
          <AnalysisTool ticks={ticks} />
        ) : (
          <>
            {/* Legend bar */}
            <div className="mb-4 flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              {LEGEND.map((l) => (
                <span key={l.t} className={`flex items-center gap-1.5 text-sm font-semibold ${l.tc}`}>
                  <span className={`h-5 w-5 rounded-full ${l.c}`} />
                  {l.t}
                </span>
              ))}
              <div className="relative ml-auto flex items-center gap-3">
                <button
                  onClick={() => setOpen((o) => !o)}
                  className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  Signals
                  <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] text-white dark:bg-emerald-500 dark:text-emerald-950">{strong.length} Strong</span>
                  <span>▾</span>
                </button>
                <button
                  onClick={() => {
                    const next: Record<string, boolean> = {};
                    if (!allOn) MARKETS.forEach((m) => (next[m.symbol] = true));
                    setScan(next);
                  }}
                  className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white shadow hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-400"
                >
                  {allOn ? 'Stop All Scans' : `Auto Scan All ${MARKETS.length}`}
                </button>
                {open && (
                  <div className="absolute right-0 top-10 z-20 max-h-96 w-80 overflow-auto rounded-lg border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-900">
                    {scanned.length === 0 ? (
                      <p className="p-2 text-xs text-slate-500 dark:text-slate-400">Start an auto scan on any market to see signals.</p>
                    ) : strong.length === 0 ? (
                      <p className="p-2 text-xs text-slate-500 dark:text-slate-400">No strong signals right now.</p>
                    ) : (
                      strong.map((s, i) => (
                        <div
                          key={i}
                          className="flex justify-between border-b border-slate-100 px-2 py-1.5 text-xs last:border-0 dark:border-slate-800"
                        >
                          <span className="font-semibold text-slate-700 dark:text-slate-200">{s.name}</span>
                          <span className="font-bold text-emerald-600 dark:text-emerald-400">
                            {s.label} {s.value.toFixed(1)}%
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {MARKETS.map((def) => (
                <MarketCard
                  key={def.symbol}
                  def={def}
                  ticks={ticks}
                  scanning={!!scan[def.symbol]}
                  onToggleScan={() => setScan((s) => ({ ...s, [def.symbol]: !s[def.symbol] }))}
                />
              ))}
            </div>
            <p className="mt-6 text-center text-xs text-slate-400 dark:text-slate-500">
              Live data streamed directly from Deriv WebSocket API. Last digit extracted using each market's exact pip size. Statistics are not a
              guarantee of future results.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
