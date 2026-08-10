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
const KADASTER_PAGING_KEY = 'bito:offmarket:kadaster-paging';

function scrollNaarKadasterOphalen() {
  const scroll = () => {
    const kaart = document.querySelector<HTMLElement>('[data-testid="signaal-kadaster-kaart"]');
    if (!kaart) return;
    const knop = Array.from(kaart.querySelectorAll<HTMLButtonElement>('button')).find((button) =>
      (button.textContent ?? '').includes('Kadastergegevens ophalen'),
    );
    if (!knop) return;

    // Eerst de browser zelf alle relevante scrollcontainers laten positioneren.
    knop.scrollIntoView({ behavior: 'auto', block: 'center', inline: 'nearest' });

    // Daarna de dichtstbijzijnde expliciete scrollcontainer corrigeren. Dit is
    // nodig in Focus/embedded layouts waar window.scrollY niet leidend is.
    let parent = knop.parentElement;
    while (parent) {
      const style = window.getComputedStyle(parent);
      const overflowY = style.overflowY;
      if ((overflowY === 'auto' || overflowY === 'scroll') && parent.scrollHeight > parent.clientHeight) {
        const knopRect = knop.getBoundingClientRect();
        const parentRect = parent.getBoundingClientRect();
        const delta = knopRect.top - parentRect.top - (parent.clientHeight - knopRect.height) / 2;
        parent.scrollTop += delta;
        break;
      }
      parent = parent.parentElement;
    }
  };

  // De gekozen BAG-kaart en collapsible lijst veranderen nog kort van hoogte.
  // Herpositioneer daarom door de volledige renderfase heen.
  [0, 80, 220, 500, 900, 1400].forEach((ms) => window.setTimeout(scroll, ms));
}

export default function MobileTabbarScroller({ activeValue, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  // Handmatige BAG-adreskeuze: altijd naar de betaalde Kadasteractie springen.
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

    // React Router opent een nieuw signaal standaard op Overzicht. Wanneer de
    // navigatie vanuit Kadaster kwam, activeer Kadaster eerst opnieuw voordat
    // we de bewaarde hoogte herstellen.
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
      if (!paging) sessionStorage.removeItem(KADASTER_SCROLL_KEY);
      return;
    }

    const herstel = () => {
      const raw = sessionStorage.getItem(KADASTER_SCROLL_KEY);
      const y = raw == null ? NaN : Number(raw);
      if (!Number.isFinite(y)) return;
      window.scrollTo(0, y);
    };

    // Op de nieuwe route renderen header, queries en Kadasterkaart niet exact
    // tegelijk. Herstel daarom gedurende die korte renderfase meerdere keren.
    if (paging) {
      const timers = [0, 80, 220, 500, 900, 1400].map((ms) => window.setTimeout(herstel, ms));
      const klaar = window.setTimeout(() => sessionStorage.removeItem(KADASTER_PAGING_KEY), 1550);
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

      sessionStorage.setItem(KADASTER_SCROLL_KEY, String(window.scrollY));
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
