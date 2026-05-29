import { useRef, useCallback } from 'react';

/**
 * Onderscheidt tap van scroll op touch-devices.
 * Geeft handlers terug die `onTap` alleen triggeren bij een echte tap
 * (movement < ~10px en duur < 500ms). Voorkomt dat scrollen per ongeluk
 * een rij/card opent op mobiel.
 */
export function useTapVsScroll(onTap: (e: React.SyntheticEvent) => void, opts?: { moveThreshold?: number; timeThreshold?: number }) {
  const moveThreshold = opts?.moveThreshold ?? 10;
  const timeThreshold = opts?.timeThreshold ?? 500;
  const start = useRef<{ x: number; y: number; t: number; moved: boolean } | null>(null);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0];
    if (!t) return;
    start.current = { x: t.clientX, y: t.clientY, t: Date.now(), moved: false };
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    const s = start.current;
    if (!s) return;
    const t = e.touches[0];
    if (!t) return;
    if (Math.abs(t.clientX - s.x) > moveThreshold || Math.abs(t.clientY - s.y) > moveThreshold) {
      s.moved = true;
    }
  }, [moveThreshold]);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    const s = start.current;
    start.current = null;
    if (!s || s.moved) return;
    if (Date.now() - s.t > timeThreshold) return;
    onTap(e);
  }, [onTap, timeThreshold]);

  return { onTouchStart, onTouchMove, onTouchEnd };
}
