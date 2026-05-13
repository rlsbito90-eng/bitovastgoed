import { useEffect, useRef } from "react";

interface Options {
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  /**
   * Alleen swipes die starten binnen deze horizontale band openen het menu.
   * We beginnen pas vanaf EDGE_GUARD om de native iOS back-swipe niet te kapen.
   */
  edgeGuardPx?: number;
  edgeMaxPx?: number;
  minDistancePx?: number;
}

const isInteractive = (target: EventTarget | null): boolean => {
  if (!(target instanceof Element)) return false;
  return !!target.closest(
    'input, textarea, select, button, a, [role="slider"], [role="dialog"], [data-no-swipe], [contenteditable="true"], .no-swipe',
  );
};

const hasOpenDialog = (): boolean => {
  if (typeof document === "undefined") return false;
  return !!document.querySelector('[role="dialog"][data-state="open"], [data-radix-popper-content-wrapper]');
};

export function useSwipeMenu({
  isOpen,
  onOpen,
  onClose,
  edgeGuardPx = 20,
  edgeMaxPx = 80,
  minDistancePx = 60,
}: Options) {
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const tracking = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Alleen op touch-capable / smalle viewports
    const mql = window.matchMedia("(max-width: 1023px)");
    if (!mql.matches) return;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      if (hasOpenDialog()) return;
      const t = e.touches[0];

      if (isOpen) {
        // Sluiten: swipe overal binnen de drawer/overlay registreren
        startX.current = t.clientX;
        startY.current = t.clientY;
        tracking.current = true;
        return;
      }

      // Openen: alleen vanaf veilige edge-zone (niet vanaf 0 → laat iOS back-swipe met rust)
      if (t.clientX < edgeGuardPx || t.clientX > edgeMaxPx) return;
      if (isInteractive(e.target)) return;
      startX.current = t.clientX;
      startY.current = t.clientY;
      tracking.current = true;
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (!tracking.current || startX.current == null || startY.current == null) {
        tracking.current = false;
        return;
      }
      const t = e.changedTouches[0];
      const dx = t.clientX - startX.current;
      const dy = t.clientY - startY.current;
      tracking.current = false;
      startX.current = null;
      startY.current = null;

      if (Math.abs(dy) > Math.abs(dx)) return; // vooral verticaal → negeer
      if (Math.abs(dx) < minDistancePx) return;

      if (!isOpen && dx > 0) onOpen();
      else if (isOpen && dx < 0) onClose();
    };

    const onTouchCancel = () => {
      tracking.current = false;
      startX.current = null;
      startY.current = null;
    };

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("touchcancel", onTouchCancel, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchCancel);
    };
  }, [isOpen, onOpen, onClose, edgeGuardPx, edgeMaxPx, minDistancePx]);
}
