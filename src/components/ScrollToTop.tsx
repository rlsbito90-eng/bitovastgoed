import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

const SCROLL_RESTORE_PAIRS: Array<[RegExp, RegExp]> = [
  [/^\/off-market$/, /^\/off-market\/[^/]+$/],
];

// Bewaar alleen de positie van werkoverzichten wanneer een detail wordt geopend.
const CRM_LIST_ROUTES = new Set(["/relaties", "/objecten", "/taken", "/deals", "/vastgoedkansen"]);
const crmScrollPositions = new Map<string, number>();

function isCrmListReturn(previous: string | null, next: string): boolean {
  return Boolean(previous && CRM_LIST_ROUTES.has(next) && previous.startsWith(`${next}/`)
    && previous.split("/").length === next.split("/").length + 1);
}

function herstelCrmLijstPositie(path: string): void {
  const desired = crmScrollPositions.get(path) ?? 0;
  if (desired <= 12) return;
  const main = getMain();
  if (!main) return;

  let cancelled = false;
  let frame = 0;
  let attempts = 0;
  const cleanup = () => {
    cancelled = true;
    window.cancelAnimationFrame(frame);
    main.removeEventListener("wheel", cleanup);
    main.removeEventListener("touchstart", cleanup);
    main.removeEventListener("pointerdown", cleanup);
  };
  main.addEventListener("wheel", cleanup, { passive: true, once: true });
  main.addEventListener("touchstart", cleanup, { passive: true, once: true });
  main.addEventListener("pointerdown", cleanup, { passive: true, once: true });

  const restore = () => {
    if (cancelled) return;
    if (main.scrollHeight - main.clientHeight >= desired - 4) {
      main.scrollTo({ top: desired, behavior: "auto" });
      if (Math.abs(main.scrollTop - desired) <= 4) {
        cleanup();
        return;
      }
    }
    if (++attempts >= 180) {
      cleanup();
      return;
    }
    frame = window.requestAnimationFrame(restore);
  };
  frame = window.requestAnimationFrame(restore);
}

const KADASTER_PAGING_KEY = "bito:offmarket:kadaster-paging-v3";

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

function isVisible(el: HTMLElement): boolean {
  return el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden";
}

function getVisibleTabsRoot(): HTMLElement | null {
  const roots = Array.from(document.querySelectorAll<HTMLElement>(
    '[data-testid="signaal-mobile-tabs"], [data-testid="signaal-desktop-tabs"]',
  ));
  return roots.find(isVisible) ?? null;
}

function isKadasterTabActief(): boolean {
  const root = getVisibleTabsRoot();
  if (!root) return false;
  return Array.from(root.querySelectorAll<HTMLElement>('[data-state="active"]')).some((el) =>
    (el.textContent ?? "").toLowerCase().includes("kadaster"),
  );
}

function findVisibleKadasterTabTrigger(): HTMLElement | null {
  const root = getVisibleTabsRoot();
  if (!root) return null;
  return Array.from(root.querySelectorAll<HTMLElement>("button")).find((el) =>
    (el.textContent ?? "").trim().toLowerCase().includes("kadaster"),
  ) ?? null;
}

function scrollMainNaarElement(el: HTMLElement, blockOffset = 24, behavior: ScrollBehavior = "auto") {
  const main = getMain();
  if (!main) return;
  const mainRect = main.getBoundingClientRect();
  const elRect = el.getBoundingClientRect();
  const top = Math.max(0, main.scrollTop + elRect.top - mainRect.top - blockOffset);
  main.scrollTo({ top, left: 0, behavior });
}

function leesPagingState(): KadasterPagingState | null {
  try {
    const raw = sessionStorage.getItem(KADASTER_PAGING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as KadasterPagingState;
    if (!Number.isFinite(parsed.relativeTop) || Date.now() - parsed.createdAt > 60_000) {
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

  let cancelled = false;
  let stableFrames = 0;
  let observer: MutationObserver | null = null;
  let raf = 0;

  const cleanup = () => {
    cancelled = true;
    if (raf) cancelAnimationFrame(raf);
    observer?.disconnect();
    main.removeEventListener("touchstart", cancelByUser);
    main.removeEventListener("wheel", cancelByUser);
  };

  const finish = () => {
    sessionStorage.removeItem(KADASTER_PAGING_KEY);
    cleanup();
  };

  const cancelByUser = () => finish();
  main.addEventListener("touchstart", cancelByUser, { once: true, passive: true });
  main.addEventListener("wheel", cancelByUser, { once: true, passive: true });

  const restore = () => {
    if (cancelled) return;

    let kaart = document.querySelector<HTMLElement>('[data-testid="signaal-kadaster-kaart"]');
    if (!kaart) {
      const trigger = findVisibleKadasterTabTrigger();
      if (trigger && trigger.getAttribute("data-state") !== "active") trigger.click();
      stableFrames = 0;
      raf = requestAnimationFrame(restore);
      return;
    }

    const mainRect = main.getBoundingClientRect();
    const kaartRect = kaart.getBoundingClientRect();
    const kaartTopInMain = main.scrollTop + kaartRect.top - mainRect.top;
    const desired = Math.max(0, kaartTopInMain + state.relativeTop);
    const delta = Math.abs(main.scrollTop - desired);

    if (delta > 2) {
      main.scrollTo({ top: desired, left: 0, behavior: "auto" });
      stableFrames = 0;
    } else {
      stableFrames += 1;
    }

    // Pas opruimen nadat de positie meerdere opeenvolgende frames stabiel is.
    // Geen vaste frame-timeout: langzamere signaallading mag de intentie niet verliezen.
    if (stableFrames >= 4) {
      finish();
      return;
    }

    raf = requestAnimationFrame(restore);
  };

  // Als React de relevante subtree vervangt, opnieuw proberen zonder de intentie kwijt te raken.
  observer = new MutationObserver(() => {
    stableFrames = 0;
    if (!cancelled && !raf) raf = requestAnimationFrame(restore);
  });
  observer.observe(main, { childList: true, subtree: true });

  raf = requestAnimationFrame(restore);
}

let kadasterAdresScrollTot = 0;
let prototypeGepatcht = false;

function activeerKadasterAdresScroll() {
  kadasterAdresScrollTot = Date.now() + 1_500;
}

function installeerKadasterScrollIntoViewGuard() {
  if (prototypeGepatcht || typeof HTMLElement === "undefined") return () => {};
  prototypeGepatcht = true;

  const origineel = HTMLElement.prototype.scrollIntoView;
  HTMLElement.prototype.scrollIntoView = function scrollIntoViewGuard(arg?: boolean | ScrollIntoViewOptions) {
    const el = this as HTMLElement;
    const kaart = el.closest?.('[data-testid="signaal-kadaster-kaart"]');
    if (kaart && Date.now() <= kadasterAdresScrollTot) {
      const doel = (el.textContent ?? "").includes("Kadastergegevens ophalen")
        ? el
        : kaart.querySelector<HTMLElement>('[data-testid="kadaster-ophalen-anchor"]')
          ?? Array.from(kaart.querySelectorAll<HTMLButtonElement>("button")).find((b) =>
            (b.textContent ?? "").includes("Kadastergegevens ophalen"),
          )
          ?? el;
      scrollMainNaarElement(doel as HTMLElement, 88, "smooth");
      return;
    }
    return origineel.call(this, arg as never);
  };

  return () => {
    HTMLElement.prototype.scrollIntoView = origineel;
    prototypeGepatcht = false;
  };
}

export default function ScrollToTop() {
  const { pathname, search, hash } = useLocation();
  const previous = useRef<{ pathname: string; search: string; hash: string } | null>(null);

  useEffect(() => installeerKadasterScrollIntoViewGuard(), []);

  useEffect(() => {
    if (!CRM_LIST_ROUTES.has(pathname)) return;
    // Capture werkt ook wanneer de lijst pas na lazy loading in <main> verschijnt.
    const save = (event: Event) => {
      const main = getMain();
      if (main && event.target === main) crmScrollPositions.set(pathname, main.scrollTop);
    };
    document.addEventListener("scroll", save, true);
    return () => document.removeEventListener("scroll", save, true);
  }, [pathname]);

  useEffect(() => {
    const onClickCapture = (event: MouseEvent) => {
      const button = (event.target as HTMLElement | null)?.closest("button");
      if (!button) return;

      const aria = button.getAttribute("aria-label") ?? "";
      const isPaging = aria === "Vorige signaal" || aria === "Volgende signaal"
        || (button.textContent ?? "").trim() === "Vorige"
        || (button.textContent ?? "").trim().startsWith("Volgende");

      if (isPaging && isKadasterTabActief()) {
        bewaarKadasterPositie();
        return;
      }

      if ((button.textContent ?? "").trim().startsWith("Gebruik dit adres")) {
        activeerKadasterAdresScroll();
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
      herstelKadasterPositie();
      return;
    }

    if (prior && prior.pathname === pathname) return;
    if (isOptOut(prior?.pathname ?? null, pathname)) return;
    if (hash) return;

    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    const main = getMain();
    if (main) main.scrollTo({ top: 0, left: 0, behavior: "auto" });

    if (isCrmListReturn(prior?.pathname ?? null, pathname)) {
      herstelCrmLijstPositie(pathname);
    }
  }, [hash, pathname, search]);

  return null;
}
