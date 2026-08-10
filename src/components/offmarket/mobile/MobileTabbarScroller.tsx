// Mobiele tabbar-wrapper voor Off-Market signaaldetail.
// Op mobiel zijn de zes dossier-tabs een vast 3 x 2 raster. Geen horizontale
// scroll, edge-mask of scrollIntoView: die konden de actieve Kadaster-tab buiten
// de glass-container laten tekenen.
import { useRef } from 'react';

interface Props {
  activeValue: string;
  children: React.ReactNode;
}

export default function MobileTabbarScroller({ activeValue: _activeValue, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);

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
