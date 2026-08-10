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

export default function MobileTabbarScroller({ activeValue, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeValue !== 'kadaster') {
      sessionStorage.removeItem(KADASTER_SCROLL_KEY);
      return;
    }

    const herstel = () => {
      const raw = sessionStorage.getItem(KADASTER_SCROLL_KEY);
      const y = raw == null ? NaN : Number(raw);
      if (!Number.isFinite(y)) return;
      window.scrollTo({ top: y, left: 0, behavior: 'auto' });
    };

    const onClickCapture = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const button = target?.closest<HTMLButtonElement>('button');
      if (!button) return;
      const label = button.getAttribute('aria-label');
      if (label !== 'Vorige signaal' && label !== 'Volgende signaal') return;

      const y = window.scrollY;
      sessionStorage.setItem(KADASTER_SCROLL_KEY, String(y));
      // De nieuwe signaaldata komt asynchroon binnen. Herstel tijdens die
      // renderfase zodat de gebruiker op dezelfde hoogte in Kadaster blijft.
      [80, 240, 600, 1100].forEach((ms) => window.setTimeout(herstel, ms));
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
