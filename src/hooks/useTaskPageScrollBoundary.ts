import { useEffect, type RefObject } from 'react';

/**
 * Dossiers en overzichten hebben het gewone pagina-scrollgebied nodig, maar niet het
 * 'rubber-band' uitrekken van de hele pagina op iOS Safari.
 */
export function isTaskPageScrollRoute(pathname: string): boolean {
  return /^\/taken(?:\/[^/]+)?\/?$/.test(pathname);
}

/** Zelfde stabiele scrollbediening voor relatie-overzicht en relatiedossier. */
export function isRelatiePageScrollRoute(pathname: string): boolean {
  return /^\/relaties(?:\/[^/]+)?\/?$/.test(pathname);
}

/** Identieke iOS-scrollgrenzen voor het objectenoverzicht en alle objectdossiers. */
export function isObjectPageScrollRoute(pathname: string): boolean {
  return /^\/objecten(?:\/[^/]+)?\/?$/.test(pathname);
}

export type TaskPageGesture = {
  totalX: number;
  totalY: number;
  stepY: number;
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
};

/** Alleen verticale pogingen voorbij de boven- of ondergrens blokkeren. */
export function shouldPreventTaskPageBounce({
  totalX, totalY, stepY, scrollTop, scrollHeight, clientHeight,
}: TaskPageGesture): boolean {
  // Horizontale swipe-rails (zoals de Taken-tabs) behouden hun native swipe.
  if (Math.abs(totalY) < 7 || Math.abs(totalY) <= Math.abs(totalX)) return false;
  if (Math.abs(stepY) < 1) return false;
  if (scrollHeight <= clientHeight + 1) return true;
  if (stepY > 0 && scrollTop <= 0) return true;
  if (stepY < 0 && scrollTop + clientHeight >= scrollHeight - 1) return true;
  return false;
}

/**
 * Safari heeft naast overscroll-behavior:none soms een native touchmove
 * boundary nodig bij de eigen scrollcontainer. Actief op Taken en Relaties;
 * normale verticale beweging en horizontaal wisselen van tabs blijven intact.
 */
export function useTaskPageScrollBoundary(
  ref: RefObject<HTMLElement | null>,
  enabled: boolean,
): void {
  useEffect(() => {
    if (!enabled) return;
    const main = ref.current;
    if (!main) return;

    let gesture: { startX: number; startY: number; previousY: number } | null = null;
    const start = (event: TouchEvent) => {
      const point = event.touches.length === 1 ? event.touches[0] : null;
      gesture = point
        ? { startX: point.clientX, startY: point.clientY, previousY: point.clientY }
        : null;
    };
    const move = (event: TouchEvent) => {
      if (!gesture || event.touches.length !== 1 || !event.cancelable) return;
      const point = event.touches[0];
      const block = shouldPreventTaskPageBounce({
        totalX: point.clientX - gesture.startX,
        totalY: point.clientY - gesture.startY,
        stepY: point.clientY - gesture.previousY,
        scrollTop: main.scrollTop,
        scrollHeight: main.scrollHeight,
        clientHeight: main.clientHeight,
      });
      gesture.previousY = point.clientY;
      if (block) event.preventDefault();
    };
    const end = () => { gesture = null; };

    main.addEventListener('touchstart', start, { passive: true });
    main.addEventListener('touchmove', move, { passive: false });
    main.addEventListener('touchend', end, { passive: true });
    main.addEventListener('touchcancel', end, { passive: true });
    return () => {
      main.removeEventListener('touchstart', start);
      main.removeEventListener('touchmove', move);
      main.removeEventListener('touchend', end);
      main.removeEventListener('touchcancel', end);
    };
  }, [ref, enabled]);
}
