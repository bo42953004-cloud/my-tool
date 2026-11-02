export type DigitStats = {
  counts: number[];
  pct: number[];
  total: number;
  most: number;
  second: number;
  least: number;
  secondLeast: number;
  current: number | null;
};

export function digitStats(digits: number[]): DigitStats {
  const counts = new Array(10).fill(0);
  digits.forEach((d) => counts[d]++);
  const total = digits.length;
  const pct = counts.map((c) => (total ? (c / total) * 100 : 0));
  const order = counts.map((c, i) => ({ c, i })).sort((a, b) => b.c - a.c || a.i - b.i);
  return {
    counts,
    pct,
    total,
    most: order[0].i,
    second: order[1].i,
    least: order[9].i,
    secondLeast: order[8].i,
    current: total ? digits[total - 1] : null,
  };
}

export type Signal = {
  type: string;
  label: string;
  value: number;
  strength: 'strong' | 'moderate';
};

/** Detect statistical edges vs theoretical distribution. */
export function getSignals(digits: number[]): Signal[] {
  const n = digits.length;
  if (n < 20) return [];
  const s = digitStats(digits);
  const out: Signal[] = [];
  const push = (type: string, label: string, value: number, base: number, mod: number, strong: number) => {
    const diff = value - base;
    if (diff >= strong) out.push({ type, label, value, strength: 'strong' });
    else if (diff >= mod) out.push({ type, label, value, strength: 'moderate' });
  };
  const even = (digits.filter((d) => d % 2 === 0).length / n) * 100;
  push('EVEN', 'Even', even, 50, 5, 8);
  push('ODD', 'Odd', 100 - even, 50, 5, 8);
  const over4 = (digits.filter((d) => d > 4).length / n) * 100;
  push('OVER', 'Over 4', over4, 50, 5, 8);
  push('UNDER', 'Under 5', 100 - over4, 50, 5, 8);
  const over1 = (digits.filter((d) => d > 1).length / n) * 100;
  push('OVER', 'Over 1', over1, 80, 4, 7);
  const under8 = (digits.filter((d) => d < 8).length / n) * 100;
  push('UNDER', 'Under 8', under8, 80, 4, 7);
  push('MATCH', `Matches ${s.most}`, s.pct[s.most], 10, 3, 5);
  const diffPct = 100 - s.pct[s.least];
  push('DIFFER', `Differs ${s.least}`, diffPct, 90, 3, 5);
  return out.sort((a, b) => (a.strength === b.strength ? 0 : a.strength === 'strong' ? -1 : 1));
}
