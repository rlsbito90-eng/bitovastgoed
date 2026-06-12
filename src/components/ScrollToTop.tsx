import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

/**
 * Routepatronen die hun eigen scrollherstel doen. Wanneer we tussen deze
 * paren navigeren slaan we de auto-scroll-to-top over zodat de lijst-pagina
 * de eerder opgeslagen scrollpositie kan herstellen.
 */
const SCROLL_RESTORE_PAIRS: Array<[RegExp, RegExp]> = [
  [/^\/off-market$/, /^\/off-market\/[^/]+$/],
];

function isOptOut(prev: string | null, next: string): boolean {
  if (!prev) return false;
  for (const [a, b] of SCROLL_RESTORE_PAIRS) {
    if ((a.test(prev) && b.test(next)) || (b.test(prev) && a.test(next))) return true;
  }
  return false;
}

export default function ScrollToTop() {
  const { pathname, search, hash } = useLocation();
  const prevPath = useRef<string | null>(null);

  useEffect(() => {
    const skip = isOptOut(prevPath.current, pathname);
    prevPath.current = pathname;
    if (skip) return;

    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    const main = document.querySelector("main");
    if (main) main.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [pathname, search, hash]);

  return null;
}
