// V1A — Toggle-knop: voegt signaal toe of verwijdert het uit de centrale
// Off-Market Acquisitieselectie. Pending-state voorkomt dubbelklik.
import { useState } from 'react';
import { ListPlus, ListChecks, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import {
  useIsInAcquisitieSelectie,
  useVoegToeAanAcquisitieSelectie,
  useVerwijderUitAcquisitieSelectie,
} from '@/hooks/useAcquisitieSelectie';

type Variant = 'default' | 'compact' | 'icon';
type LabelMode = 'long' | 'short' | 'remove';

interface Props {
  signaalId: string;
  variant?: Variant;
  /** Tekstvariant.
   *  - 'long'   : "Toevoegen aan acquisitieselectie" / "Uit acquisitieselectie" (desktop detail)
   *  - 'short'  : "Aan selectie" / "Uit selectie" (mobiel, kaartpopup, lijst)
   *  - 'remove' : "Verwijderen" (binnen de Acquisitieselectie-tab)
   *  Default volgt het variant: default→long, compact→short.
   */
  labelMode?: LabelMode;
  /** Eventueel forceren: handig wanneer ouder een eigen statusbron heeft. */
  isInSelectie?: boolean;
  className?: string;
  /** Stop event propagation (lijstrijen, popups). */
  stopPropagation?: boolean;
}

export default function ToevoegenAanAcquisitieSelectieKnop({
  signaalId,
  variant = 'default',
  labelMode,
  isInSelectie,
  className = '',
  stopPropagation = false,
}: Props) {
...
  if (variant === 'icon') {
...
      </button>
    );
  }

  const mode: LabelMode = labelMode ?? (variant === 'compact' ? 'short' : 'long');
  const labelToevoegen =
    mode === 'long' ? 'Toevoegen aan acquisitieselectie'
    : mode === 'remove' ? 'Verwijderen'
    : 'Aan selectie';
  const labelVerwijderen =
    mode === 'long' ? 'Uit acquisitieselectie'
    : mode === 'remove' ? 'Verwijderen'
    : 'Uit selectie';
  const label = pending
    ? (inSelectie ? 'Verwijderen…' : 'Toevoegen…')
    : inSelectie ? labelVerwijderen : labelToevoegen;
  const ariaLabel = inSelectie
    ? 'Verwijder dit signaal uit de acquisitieselectie'
    : 'Voeg dit signaal toe aan de acquisitieselectie';
  const Icon = pending ? Loader2 : inSelectie ? ListChecks : ListPlus;

  return (
    <Button
      type="button"
      size={variant === 'compact' ? 'sm' : 'default'}
      variant={inSelectie ? 'outline' : 'secondary'}
      onClick={handleClick}
      disabled={pending}
      aria-pressed={inSelectie}
      aria-label={ariaLabel}
      data-testid="acquisitie-selectie-toggle"
      data-variant={variant}
      data-in-selectie={inSelectie ? 'true' : 'false'}
      className={className}
    >
      <Icon className={`h-4 w-4 ${pending ? 'animate-spin' : ''}`} />
      {label}
    </Button>
  );
}

