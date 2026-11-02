import { useSyncExternalStore } from 'react';
import { feed } from './deriv';

export function useMarket(symbol: string) {
  return useSyncExternalStore(feed.subscribe, () => feed.markets[symbol]);
}

export function useAllMarkets() {
  return useSyncExternalStore(feed.subscribe, () => feed.markets);
}

export function useFeedStatus() {
  return useSyncExternalStore(feed.subscribe, () => feed.status);
}
