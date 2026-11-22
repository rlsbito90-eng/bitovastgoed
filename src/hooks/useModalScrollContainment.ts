import { useEffect, type RefObject } from 'react';

export type ModalTouchGesture = {
  totalX: number;
  totalY: number;
  stepY: number;
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
};

/** Stops iOS sideways movement and edge rubber-banding without blocking normal list scrolling. */
export function shouldBlockModalTouch({
  totalX, totalY, stepY, scrollTop, scrollHeight, clientHeight,
}: ModalTouchGesture): boolean {
  if (Math.abs(totalX) > 6 && Math.abs(totalX) > Math.abs(totalY)) return true;
  if (Math.abs(totalY) < 3) return false;
  if (scrollHeight <= clientHeight + 1) return true;
  if (stepY > 0 && scrollTop <= 0) return true;
  if (stepY < 0 && scrollTop + clientHeight >= scrollHeight - 1) return true;
  return false;
}

/**
 * Scroll ownership for fixed mobile dialogs:
 * only the center scroll region may move, and never in the horizontal axis.
 * Keep this scoped to a dialog rather than changing all page scroll behavior.
 */
export function useModalScrollContainment(
  ref: RefObject<HTMLElement | null>, active: boolean,
): void {
  useEffect(() => {
    if (!active) return;
    const region = ref.current;
    if (!region) return;

    region.scrollTop = 0;
    region.scrollLeft = 0;
    let gesture: { startX: number; startY: number; previousY: number } | null = null;

    const onTouchStart = (event: TouchEvent) => {
      const point = event.touches.length === 1 ? event.touches[0] : null;
      gesture = point
        ? { startX: point.clientX, startY: point.clientY, previousY: point.clientY }
        : null;
    };
    const onTouchMove = (event: TouchEvent) => {
      if (!gesture || event.touches.length !== 1 || !event.cancelable) return;
      const point = event.touches[0];
      const block = shouldBlockModalTouch({
        totalX: point.clientX - gesture.startX,
        totalY: point.clientY - gesture.startY,
        stepY: point.clientY - gesture.previousY,
        scrollTop: region.scrollTop,
        scrollHeight: region.scrollHeight,
        clientHeight: region.clientHeight,
      });
      gesture.previousY = point.clientY;
      if (block) event.preventDefault();
    };
    const onTouchEnd = () => { gesture = null; };
    const onScroll = () => {
      if (region.scrollLeft !== 0) region.scrollLeft = 0;
    };

    region.addEventListener('touchstart', onTouchStart, { passive: true });
    region.addEventListener('touchmove', onTouchMove, { passive: false });
    region.addEventListener('touchend', onTouchEnd, { passive: true });
    region.addEventListener('touchcancel', onTouchEnd, { passive: true });
    region.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      region.removeEventListener('touchstart', onTouchStart);
      region.removeEventListener('touchmove', onTouchMove);
      region.removeEventListener('touchend', onTouchEnd);
      region.removeEventListener('touchcancel', onTouchEnd);
      region.removeEventListener('scroll', onScroll);
    };
  }, [active, ref]);
}
