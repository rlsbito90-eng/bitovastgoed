import { useEffect, useState } from 'react';

/**
 * Detecteert touch-only devices (geen hover, grove pointer).
 * Anders dan useIsMobile (alleen breedte) — vangt ook tablets in touch-mode.
 */
export function useIsTouch(): boolean {
  const [touch, setTouch] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia('(hover: none) and (pointer: coarse)');
    setTouch(mql.matches);
    const handler = (e: MediaQueryListEvent) => setTouch(e.matches);
    if (mql.addEventListener) mql.addEventListener('change', handler);
    else mql.addListener(handler);
    return () => {
      if (mql.removeEventListener) mql.removeEventListener('change', handler);
      else mql.removeListener(handler);
    };
  }, []);

  return touch;
}
