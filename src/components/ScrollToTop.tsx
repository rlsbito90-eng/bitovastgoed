import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

const SCROLL_RESTORE_PAIRS: Array<[RegExp, RegExp]> = [
  [/^\/off-market$/, /^\/off-market\/[^/]+$/],
];

const KADASTER_PAGING_KEY = "bito:offmarket:kadaster-paging-v2";

type KadasterPagingState = {
  relativeTop: number;
  createdAt: number;
};

function isOptOut(prev: string | null, next: string): boolean {
  if (!prev) return false;
  for (const [a, b] of SCROLL_RESTORE_PAIRS) {
    if ((a.test(prev) && b.test(next)) || (b.test(prev) && a.test(next))) return true;
  }
  return false;
}

function getMain(): HTMLElement | null {
  return document.querySelector<HTMLElement>("main");
}

function isKadasterTabActief(): boolean {
  const tabs = document.querySelector<HTMLElement>('[data-testid="signaal-mobile-tabs"]');
  if (!tabs) return false;
  return Array.from(tabs.querySelectorAll<HTMLElement>('[data-state="active"]')).some((el) =>
    (el.textContent ?? "").toLowerCase().includes("kadaster"),
  );
}

function findKadasterTabTrigger(): HTMLElement | null {
  const tabs = document.querySelector<HTMLElement>('[data-testid="signaal-mobile-tabs"]');
  if (!tabs) return null;
  return Array.from(tabs.querySelectorAll<HTMLElement>("button")).find((el) =>
    (el.textContent ?? "").trim().toLowerCase() === "kadaster",
  ) ?? null;
}

function scrollMainNaarElement(el: HTMLElement, blockOffset = 20) {
  const main = getMain();
  if (!main) return;
  const mainRect = main.getBoundingClientRect();
  const elRect = el.getBoundingClientRect();
  const top = Math.max(0, main.scrollTop + elRect.top - mainRect.top - blockOffset);
  main.scrollTo({ top, left: 0, behavior: "auto" });
}

function leesPagingState(): KadasterPagingState | null {
  try {
    const raw = sessionStorage.getItem(KADASTER_PAGING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as KadasterPagingState;
    if (!Number.isFinite(parsed.relativeTop) || Date.now() - parsed.createdAt > 10_000) {
      sessionStorage.removeItem(KADASTER_PAGING_KEY);
      return null;
    }
    return parsed;
  } catch {
    sessionStorage.removeItem(KADASTER_PAGING_KEY);
    return null;
  }
}

function bewaarKadasterPositie() {
  const main = getMain();
  const kaart = document.querySelector<HTMLElement>('[data-testid="signaal-kadaster-kaart"]');
  if (!main || !kaart) return;
  const mainRect = main.getBoundingClientRect();
  const kaartRect = kaart.getBoundingClientRect();
  const kaartTopInMain = main.scrollTop + kaartRect.top - mainRect.top;
  const state: KadasterPagingState = {
    relativeTop: main.scrollTop - kaartTopInMain,
    createdAt: Date.now(),
  };
  sessionStorage.setItem(KADASTER_PAGING_KEY, JSON.stringify(state));
}

function herstelKadasterPositie() {
  const state = leesPagingState();
  if (!state) return;
  const main = getMain();
  if (!main) return;

  let stopped = false;
  let frame = 0;
  const stop = () => { stopped = true; };
  main.addEventListener("touchstart", stop, { once: true, passive: true });
  main.addEventListener("wheel", stop, { once: true, passive: true });

  const restore = () => {
    if (stopped || frame++ > 45) {
      sessionStorage.removeItem(KADASTER_PAGING_KEY);
      return;
    }

    let kaart = document.querySelector<HTMLElement>('[data-testid="signaal-kadaster-kaart"]');
    if (!kaart) {
      const trigger = findKadasterTabTrigger();
      if (trigger && trigger.getAttribute("data-state") !== "active") trigger.click();
      requestAnimationFrame(restore);
      return;
    }

    const mainRect = main.getBoundingClientRect();
    const kaartRect = kaart.getBoundingClientRect();
    const kaartTopInMain = main.scrollTop + kaartRect.top - mainRect.top;
    const desired = Math.max(0, kaartTopInMain + state.relativeTop);
    if (Math.abs(main.scrollTop - desired) > 2) {
      main.scrollTo({ top: desired, left: 0, behavior: "auto" });
    }

    // Blijf kort stabiliseren terwijl async kaarten boven/onder renderen.
    if (frame < 24) requestAnimationFrame(restore);
    else sessionStorage.removeItem(KADASTER_PAGING_KEY);
  };

  requestAnimationFrame(restore);
}

function patchKadasterAdresScroll() {
  const kaart = document.querySelector<HTMLElement>('[data-testid="signaal-kadaster-kaart"]');
  if (!kaart) return;
  const knop = Array.from(kaart.querySelectorAll<HTMLButtonElement>("button")).find((b) =>
    (b.textContent ?? "").includes("Kadastergegevens ophalen"),
  );
  if (!knop) return;

  // BagAdresLookup roept na een handmatige keuze meerdere keren scrollIntoView
  // aan. Op iOS kan dat zowel window als <main> bewegen. Voor alleen deze knop
  // sturen we die aanroep daarom naar de echte app-scrollcontainer.
  knop.scrollIntoView = (() => {
    scrollMainNaarElement(knop, 24);
  }) as typeof knop.scrollIntoView;
}

export default function ScrollToTop() {
  const location = useLocation();
  const { pathname, search, hash } = location;
  const previous = useRef<{ pathname: string; search: string; hash: string } | null>(null);

  useEffect(() => {
    const onClickCapture = (event: MouseEvent) => {
      const button = (event.target as HTMLElement | null)?.closest("button");
      if (!button) return;

      const aria = button.getAttribute("aria-label") ?? "";
      if ((aria === "Vorige signaal" || aria === "Volgende signaal") && isKadasterTabActief()) {
        bewaarKadasterPositie();
        return;
      }

      if ((button.textContent ?? "").trim().startsWith("Gebruik dit adres")) {
        patchKadasterAdresScroll();
      }
    };

    document.addEventListener("click", onClickCapture, true);
    return () => document.removeEventListener("click", onClickCapture, true);
  }, []);

  useEffect(() => {
    const prior = previous.current;
    previous.current = { pathname, search, hash };

    const paging = leesPagingState();
    if (paging && /^\/off-market\/[^/]+$/.test(pathname)) {
      // Deze routewissel heeft een expliciete Kadaster-scrollintentie. Laat de
      // globale top-reset volledig met rust en herstel relatief aan de kaart.
      herstelKadasterPositie();
      return;
    }

    // Tab- en quickscanselectie binnen dezelfde objectroute behouden hun positie.
    if (prior && prior.pathname === pathname) return;
    if (isOptOut(prior?.pathname ?? null, pathname)) return;

    // Een deep link regelt zijn eigen gerichte scroll nadat de inhoud is gemount.
    if (hash) return;

    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    const main = getMain();
    if (main) main.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [hash, pathname, search]);

  return null;
}
