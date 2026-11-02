export type MarketDef = { symbol: string; name: string; note?: string };

export const MARKETS: MarketDef[] = [
  { symbol: '1HZ100V', name: 'Volatility 100 (1s) Index' },
  { symbol: '1HZ10V', name: 'Volatility 10 (1s) Index' },
  { symbol: '1HZ15V', name: 'Volatility 15 (1s) Index' },
  { symbol: '1HZ25V', name: 'Volatility 25 (1s) Index' },
  { symbol: '1HZ30V', name: 'Volatility 30 (1s) Index' },
  { symbol: '1HZ50V', name: 'Volatility 50 (1s) Index' },
  { symbol: '1HZ75V', name: 'Volatility 75 (1s) Index' },
  { symbol: '1HZ90V', name: 'Volatility 90 (1s) Index' },
  { symbol: 'R_10', name: 'Volatility 10 Index' },
  { symbol: 'R_100', name: 'Volatility 100 Index' },
  { symbol: 'R_25', name: 'Volatility 25 Index' },
  { symbol: 'R_50', name: 'Volatility 50 Index' },
  { symbol: 'R_75', name: 'Volatility 75 Index' },
  { symbol: 'JD10', name: 'Jump 10 Index' },
  { symbol: 'JD25', name: 'Jump 25 Index' },
  { symbol: 'JD50', name: 'Jump 50 Index' },
  { symbol: 'JD75', name: 'Jump 75 Index' },
  {
    symbol: 'JD100',
    name: 'Jump 100 Index',
    note: 'Payout on Jump 100 is very small — not worth trading.',
  },
];

export const MAX_TICKS = 1000;

type MarketStatus = 'connecting' | 'live' | 'error';

export type MarketState = {
  symbol: string;
  status: MarketStatus;
  error?: string;
  pip: number;
  prices: number[];
  epochs: number[];
  digits: number[];
  lastUpdate: number;
};

export type FeedStatus = {
  connected: boolean;
  state: 'connecting' | 'live' | 'offline';
  endpoint: string;
  error: string;
  refreshing: boolean;
};

type Listener = () => void;

/** New Deriv public market-data socket (no auth needed for ticks). */
const ENDPOINTS = [
  'wss://api.derivws.com/trading/v1/options/ws/public?app_id=1089',
  'wss://ws.derivws.com/websockets/v3?app_id=1089&l=EN',
];

/** Exact last digit using the market's pip size (keeps trailing zeros). */
export function lastDigit(quote: number, pip: number): number {
  const s = quote.toFixed(pip);
  return Number(s[s.length - 1]);
}

class DerivFeed {
  markets: Record<string, MarketState> = {};
  status: FeedStatus = { connected: false, state: 'connecting', endpoint: ENDPOINTS[0], error: '', refreshing: false };
  private pendingRefresh = 0;
  private refreshTimer: number | undefined;
  private ws: WebSocket | null = null;
  private listeners = new Set<Listener>();
  private ping: number | undefined;
  private retryTimer: number | undefined;
  private endpointIndex = 0;
  private attempt = 0;
  private started = false;

  constructor() {
    for (const m of MARKETS) {
      this.markets[m.symbol] = {
        symbol: m.symbol,
        status: 'connecting',
        pip: 2,
        prices: [],
        epochs: [],
        digits: [],
        lastUpdate: 0,
      };
    }
  }

  subscribe = (l: Listener) => {
    this.listeners.add(l);
    if (!this.started) {
      this.started = true;
      this.connect();
    }
    return () => {
      this.listeners.delete(l);
    };
  };

  retryNow = () => {
    this.attempt = 0;
    this.endpointIndex = 0;
    this.setStatus({ state: 'connecting', error: '', connected: false });
    this.connect();
  };

  /** Re-pull the full tick history for every market from scratch. */
  refresh = () => {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.pendingRefresh = MARKETS.length;
      clearTimeout(this.refreshTimer);
      this.setStatus({ refreshing: true });
      // Drop existing tick subscriptions first so we never receive duplicates.
      this.ws.send(JSON.stringify({ forget_all: 'ticks' }));
      this.requestAll(this.ws, 0);
      this.refreshTimer = window.setTimeout(() => this.endRefresh(), 15000);
    } else {
      this.endRefresh();
      this.retryNow();
    }
  };

  private endRefresh() {
    clearTimeout(this.refreshTimer);
    this.refreshTimer = undefined;
    this.pendingRefresh = 0;
    this.setStatus({ refreshing: false });
  }

  private requestAll(ws: WebSocket, reqBase: number) {
    MARKETS.forEach((m, i) => {
      ws.send(
        JSON.stringify({
          ticks_history: m.symbol,
          adjust_start_time: 1,
          count: MAX_TICKS,
          end: 'latest',
          style: 'ticks',
          subscribe: 1,
          req_id: reqBase + i + 1,
        }),
      );
    });
  }

  private emit() {
    this.listeners.forEach((l) => l());
  }

  private setStatus(patch: Partial<FeedStatus>) {
    this.status = { ...this.status, ...patch };
    this.emit();
  }

  private set(symbol: string, patch: Partial<MarketState>) {
    const current = this.markets[symbol];
    if (!current) return;
    this.markets = { ...this.markets, [symbol]: { ...current, ...patch } };
  }

  private connect() {
    clearTimeout(this.retryTimer);
    this.retryTimer = undefined;
    clearInterval(this.ping);
    if (this.ws) {
      this.ws.onopen = this.ws.onmessage = this.ws.onerror = this.ws.onclose = null;
      try {
        this.ws.close();
      } catch {
        /* already closed */
      }
    }
    const endpoint = ENDPOINTS[this.endpointIndex % ENDPOINTS.length];
    this.setStatus({ state: 'connecting', connected: false, endpoint, error: '' });

    let ws: WebSocket;
    try {
      ws = new WebSocket(endpoint);
    } catch {
      this.scheduleReconnect('Could not open a WebSocket connection.');
      return;
    }
    this.ws = ws;

    const openTimer = window.setTimeout(() => {
      if (ws.readyState !== WebSocket.OPEN) {
        ws.close();
        this.scheduleReconnect('Connection timed out.');
      }
    }, 12000);

    ws.onopen = () => {
      clearTimeout(openTimer);
      this.attempt = 0;
      this.endRefresh();
      this.setStatus({ connected: true, state: 'live', error: '' });
      this.requestAll(ws, 0);
      this.ping = window.setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ ping: 1 }));
      }, 25000);
    };

    ws.onmessage = (ev) => {
      try {
        this.handle(JSON.parse(ev.data));
      } catch {
        /* ignore malformed frames */
      }
    };

    ws.onerror = () => {
      clearTimeout(openTimer);
      if (ws.readyState !== WebSocket.OPEN) this.scheduleReconnect('Unable to reach the Deriv feed.');
    };

    ws.onclose = () => {
      clearTimeout(openTimer);
      this.endRefresh();
      this.setStatus({ connected: false, state: 'offline' });
      MARKETS.forEach((m) => this.set(m.symbol, { status: 'connecting' }));
      this.emit();
      this.scheduleReconnect(this.status.error || 'Live connection closed.');
    };
  }

  private scheduleReconnect(reason: string) {
    if (this.retryTimer) return;
    clearInterval(this.ping);
    this.setStatus({ connected: false, state: 'offline', error: reason });
    this.endpointIndex = (this.endpointIndex + 1) % ENDPOINTS.length;
    const delay = Math.min(1000 * 2 ** this.attempt++, 10000);
    this.retryTimer = window.setTimeout(() => {
      this.retryTimer = undefined;
      this.connect();
    }, delay);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private handle(msg: any) {
    if (msg.error) {
      const sym = msg.echo_req?.ticks_history;
      if (sym && this.markets[sym]) {
        this.set(sym, { status: 'error', error: msg.error.message });
        this.emit();
      }
      this.setStatus({ error: msg.error.message });
      return;
    }
    if (msg.msg_type === 'history' && msg.history) {
      const sym: string = msg.echo_req.ticks_history;
      if (!this.markets[sym]) return;
      if (this.pendingRefresh > 0 && --this.pendingRefresh === 0) this.endRefresh();
      const pip: number = Number(msg.pip_size ?? 2);
      const prices: number[] = (msg.history.prices ?? []).map(Number).slice(-MAX_TICKS);
      const epochs: number[] = (msg.history.times ?? []).map(Number).slice(-MAX_TICKS);
      this.set(sym, {
        status: 'live',
        error: undefined,
        pip,
        prices,
        epochs,
        digits: prices.map((p) => lastDigit(p, pip)),
        lastUpdate: Date.now(),
      });
      this.emit();
    } else if (msg.msg_type === 'tick' && msg.tick) {
      const t = msg.tick;
      const m = this.markets[t.symbol];
      if (!m) return;
      const pip = t.pip_size != null ? Number(t.pip_size) : m.pip;
      const epoch = Number(t.epoch);
      if (m.epochs.length && epoch <= m.epochs[m.epochs.length - 1]) return; // drop duplicates
      const quote = Number(t.quote);
      const prices = [...m.prices, quote].slice(-MAX_TICKS);
      const epochs = [...m.epochs, epoch].slice(-MAX_TICKS);
      const digits = [...m.digits, lastDigit(quote, pip)].slice(-MAX_TICKS);
      this.set(t.symbol, { status: 'live', error: undefined, pip, prices, epochs, digits, lastUpdate: Date.now() });
      this.emit();
    }
  }
}

export const feed = new DerivFeed();
