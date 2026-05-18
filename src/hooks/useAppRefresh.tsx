import { useCallback, useEffect, useRef, useState } from 'react';
import { useDataStore } from '@/hooks/useDataStore';
import { useAcquisitie } from '@/hooks/useAcquisitie';

/**
 * App-brede refresh: combineert de twee data-providers en voorkomt
 * dubbele/parallelle refreshes.
 */
export function useAppRefresh() {
  const { refresh: refreshData } = useDataStore();
  const { refresh: refreshAcq } = useAcquisitie();
  const [refreshing, setRefreshing] = useState(false);
  const lopendRef = useRef<Promise<void> | null>(null);

  const refresh = useCallback(async () => {
    if (lopendRef.current) return lopendRef.current;
    setRefreshing(true);
    const p = (async () => {
      try {
        await Promise.all([refreshData(), refreshAcq()]);
      } finally {
        setRefreshing(false);
        lopendRef.current = null;
      }
    })();
    lopendRef.current = p;
    return p;
  }, [refreshData, refreshAcq]);

  return { refresh, refreshing };
}

/**
 * Ververst automatisch bij focus/visibility change.
 * Throttle: niet vaker dan elke `minIntervalMs` ms.
 */
export function useAutoRefreshOnFocus(minIntervalMs = 30_000) {
  const { refresh } = useAppRefresh();
  const laatsteRef = useRef<number>(Date.now());

  useEffect(() => {
    const probeer = () => {
      const nu = Date.now();
      if (nu - laatsteRef.current < minIntervalMs) return;
      laatsteRef.current = nu;
      refresh();
    };
    const onVis = () => {
      if (document.visibilityState === 'visible') probeer();
    };
    window.addEventListener('focus', probeer);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('focus', probeer);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [refresh, minIntervalMs]);
}
