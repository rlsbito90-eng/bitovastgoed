import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

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
  const previous = useRef<{ pathname: string; search: string; hash: string } | null>(null);

  useEffect(() => {
    const prior = previous.current;
    previous.current = { pathname, search, hash };

    // Tab- en quickscanselectie binnen dezelfde objectroute behouden hun positie.
    if (prior && prior.pathname === pathname) return;
    if (isOptOut(prior?.pathname ?? null, pathname)) return;

    // Een deep link regelt zijn eigen gerichte scroll nadat de inhoud is gemount.
    if (hash) return;

    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    const main = document.querySelector("main");
    if (main) main.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [hash, pathname, search]);

  return null;
}
