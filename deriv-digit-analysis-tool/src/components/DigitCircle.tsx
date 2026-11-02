type Rank = 'most' | 'second' | 'least' | 'secondLeast' | null;

const FILL: Record<string, string> = {
  most: 'bg-gradient-to-b from-emerald-500 to-emerald-700 text-white border-emerald-600 dark:from-emerald-500 dark:to-emerald-700 dark:border-emerald-500',
  second: 'bg-gradient-to-b from-blue-500 to-blue-700 text-white border-blue-600 dark:from-blue-500 dark:to-blue-700 dark:border-blue-500',
  least: 'bg-gradient-to-b from-red-500 to-red-700 text-white border-red-600 dark:from-red-500 dark:to-red-700 dark:border-red-500',
  secondLeast: 'bg-gradient-to-b from-amber-400 to-orange-600 text-white border-orange-500 dark:from-amber-400 dark:to-orange-600 dark:border-orange-500',
};

export default function DigitCircle({
  digit,
  pct,
  rank,
  current,
}: {
  digit: number;
  pct: number;
  rank: Rank;
  current: boolean;
}) {
  const fill = rank ? FILL[rank] : 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700';
  return (
    <div className="relative flex flex-col items-center">
      <div
        className={`flex h-14 w-14 flex-col items-center justify-center rounded-full border-2 shadow-sm transition-all duration-200 sm:h-[60px] sm:w-[60px] ${fill} ${
          current ? 'scale-105 ring-[3px] ring-violet-600 ring-offset-2 ring-offset-white dark:ring-violet-400 dark:ring-offset-slate-900' : ''
        }`}
      >
        <span className="text-lg font-bold leading-none">{digit}</span>
        <span className={`mt-1 text-[10px] font-semibold leading-none ${rank ? 'text-white/90' : 'text-slate-500 dark:text-slate-400'}`}>
          {pct.toFixed(1)}%
        </span>
      </div>
      <div
        className={`mt-0.5 h-0 w-0 border-x-[6px] border-b-[7px] border-x-transparent ${
          current ? 'border-b-violet-600 dark:border-b-violet-400' : 'border-b-transparent'
        }`}
      />
    </div>
  );
}
