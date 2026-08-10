import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

const SCROLL_RESTORE_PAIRS: Array<[RegExp, RegExp]> = [
  [/^\/off-market$/, /^\/off-market\/[^/]+$/],
];

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
  }, [hash, pathname, search]);

  return null;
}
