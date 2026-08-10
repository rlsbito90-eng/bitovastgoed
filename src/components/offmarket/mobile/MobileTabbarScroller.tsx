// Mobiele tabbar-wrapper voor Off-Market signaaldetail.
// Op mobiel zijn de zes dossier-tabs een vast 3 x 2 raster. Geen horizontale
// scroll, edge-mask of scrollIntoView: die konden de actieve Kadaster-tab buiten
// de glass-container laten tekenen.
import { useEffect, useRef } from 'react';

interface Props {
  activeValue: string;
  children: React.ReactNode;
}

const KADASTER_SCROLL_KEY = 'bito:offmarket:kadaster-scroll-y';
const KADASTER_MAIN_SCROLL_KEY = 'bito:offmarket:kadaster-main-scroll-y';
const KADASTER_PAGING_KEY = 'bito:offmarket:kadaster-paging';

function zetScrollpositie(windowY: number, mainY: number) {
  window.scrollTo({ top: windowY, left: 0, behavior: 'auto' });
  const main = document.querySelector<HTMLElement>('main');
  if (main && main.scrollHeight > main.clientHeight) {
    main.scrollTo({ top: mainY, left: 0, behavior: 'auto' });
  }
}

function scrollNaarKadasterOphalen() {
  const scroll = () => {
    const kaart = document.querySelector<HTMLElement>('[data-testid="signaal-kadaster-kaart"]');
    if (!kaart) return;
    const knop = Array.from(kaart.querySelectorAll<HTMLButtonElement>('button')).find((button) =>
      (button.textContent ?? '').includes('Kadastergegevens ophalen'),
    );
    if (!knop) return;

    // Gebruik bewust geen scrollIntoView: op iOS kan dat meerdere ancestors
    // tegelijk verschuiven en na een rerender bovenaan eindigen.
    const rect = knop.getBoundingClientRect();
    const gewensteTop = Math.max(0, window.scrollY + rect.top - window.innerHeight * 0.42);
    window.scrollTo({ top: gewensteTop, left: 0, behavior: 'auto' });

    const main = document.querySelector<HTMLElement>('main');
    if (main && main.scrollHeight > main.clientHeight) {
      const mainRect = main.getBoundingClientRect();
      const knopRect = knop.getBoundingClientRect();
      const delta = knopRect.top - mainRect.top - main.clientHeight * 0.42;
      main.scrollTop = Math.max(0, main.scrollTop + delta);
    }
  };

  // De BAG-lijst verandert na een keuze nog kort van hoogte. Deze absolute
  // correctie convergeert zonder de browser zelf ancestors te laten kiezen.
  [0, 80, 220, 500, 900].forEach((ms) => window.setTimeout(scroll, ms));
}

export default function MobileTabbarScroller({ activeValue, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  // Handmatige BAG-adreskeuze: naar de betaalde Kadasteractie springen.
  useEffect(() => {
    const onAdresKlik = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const button = target?.closest<HTMLButtonElement>('button');
      if (!button) return;
      if ((button.textContent ?? '').trim() !== 'Gebruik dit adres') return;
      scrollNaarKadasterOphalen();
    };
    document.addEventListener('click', onAdresKlik, true);
    return () => document.removeEventListener('click', onAdresKlik, true);
  }, []);

  useEffect(() => {
    const paging = sessionStorage.getItem(KADASTER_PAGING_KEY) === '1';

    // Als een router/remount de tab toch terugzet, zet Kadaster terug voordat
    // de bewaarde positie wordt hersteld.
    if (paging && activeValue !== 'kadaster') {
      const activeerKadaster = () => {
        const root = ref.current;
        if (!root) return;
        const tabs = Array.from(root.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
        const kadaster = tabs.find((tab) => (tab.textContent ?? '').trim().includes('Kadaster'));
        kadaster?.click();
      };
      const timers = [0, 60, 180].map((ms) => window.setTimeout(activeerKadaster, ms));
      return () => timers.forEach((timer) => window.clearTimeout(timer));
    }

    if (activeValue !== 'kadaster') {
      if (!paging) {
        sessionStorage.removeItem(KADASTER_SCROLL_KEY);
        sessionStorage.removeItem(KADASTER_MAIN_SCROLL_KEY);
      }
      return;
    }

    if (paging) {
      const windowY = Number(sessionStorage.getItem(KADASTER_SCROLL_KEY));
      const mainY = Number(sessionStorage.getItem(KADASTER_MAIN_SCROLL_KEY));
      const herstel = () => {
        if (!Number.isFinite(windowY)) return;
        zetScrollpositie(windowY, Number.isFinite(mainY) ? mainY : 0);
      };
      const timers = [0, 50, 120, 260, 500, 900, 1400].map((ms) => window.setTimeout(herstel, ms));
      const klaar = window.setTimeout(() => {
        sessionStorage.removeItem(KADASTER_PAGING_KEY);
      }, 1550);
      return () => {
        timers.forEach((timer) => window.clearTimeout(timer));
        window.clearTimeout(klaar);
      };
    }

    const onClickCapture = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const button = target?.closest<HTMLButtonElement>('button');
      if (!button) return;
      const label = button.getAttribute('aria-label');
      if (label !== 'Vorige signaal' && label !== 'Volgende signaal') return;

      const main = document.querySelector<HTMLElement>('main');
      sessionStorage.setItem(KADASTER_SCROLL_KEY, String(window.scrollY));
      sessionStorage.setItem(KADASTER_MAIN_SCROLL_KEY, String(main?.scrollTop ?? 0));
      sessionStorage.setItem(KADASTER_PAGING_KEY, '1');
    };

    document.addEventListener('click', onClickCapture, true);
    return () => document.removeEventListener('click', onClickCapture, true);
  }, [activeValue]);

  return (
    <div
      ref={ref}
      data-testid="mobile-tabbar-scroller"
      className="relative w-full min-w-0 max-w-full overflow-hidden"
    >
      <div className="w-full min-w-0 max-w-full overflow-hidden">
        {children}
      </div>
    </div>
  );
}
