import { useEffect, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';

import { cn } from '@/lib/utils';
import {
  isRijselectieToets,
  magRijselectieWisselen,
} from '@/lib/offMarket/acquisitie/selecteerbareRij';
import { activeerStickySelectieIndicator } from '@/lib/offMarket/acquisitie/stickySelectieIndicator';

interface SelecteerbareDossierRijProps {
  geselecteerd: boolean;
  onToggle: () => void;
  children: ReactNode;
  className?: string;
  testId?: string;
  signaalId?: string;
  fase?: string;
  werkbak?: string;
  actieCategorie?: string | null;
}

/**
 * Toegankelijke rijcontainer voor de acquisitieselectie.
 * Vrije ruimte wisselt de selectie; interactieve bediening en tekstselectie niet.
 */
export default function SelecteerbareDossierRij({
  geselecteerd,
  onToggle,
  children,
  className,
  testId = 'acquisitie-selectie-rij',
  signaalId,
  fase,
  werkbak,
  actieCategorie,
}: SelecteerbareDossierRijProps) {
  useEffect(() => activeerStickySelectieIndicator(), []);

  const onClick = (event: MouseEvent<HTMLLIElement>) => {
    const huidigeTekstselectie = window.getSelection()?.toString() ?? '';
    if (!magRijselectieWisselen({ target: event.target, huidigeTekstselectie })) return;
    onToggle();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLLIElement>) => {
    if (!isRijselectieToets(event.key)) return;
    if (!magRijselectieWisselen({ target: event.target })) return;
    event.preventDefault();
    onToggle();
  };

  return (
    <li
      tabIndex={0}
      role="checkbox"
      aria-checked={geselecteerd}
      data-testid={testId}
      data-signaal-id={signaalId}
      data-fase={fase}
      data-werkbak={werkbak}
      data-actie-categorie={actieCategorie ?? ''}
      data-selected={geselecteerd ? 'true' : 'false'}
      onClick={onClick}
      onKeyDown={onKeyDown}
      className={cn(
        'cursor-pointer p-3 outline-none transition-colors sm:p-4',
        'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
        geselecteerd
          ? 'bg-accent/10 ring-1 ring-inset ring-accent/40'
          : 'hover:bg-muted/30',
        className,
      )}
    >
      {children}
    </li>
  );
}
