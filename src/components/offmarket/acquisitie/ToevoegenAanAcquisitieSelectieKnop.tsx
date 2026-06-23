// V1A — Toggle-knop: voegt signaal toe of verwijdert het uit de centrale
// Off-Market Acquisitieselectie. Pending-state voorkomt dubbelklik.
import { useState } from 'react';
import { ListPlus, ListChecks, Loader2, Trash2 } from 'lucide-react';
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
  const detected = useIsInAcquisitieSelectie(signaalId);
  const inSelectie = isInSelectie ?? detected;
  const voegToe = useVoegToeAanAcquisitieSelectie();
  const verwijder = useVerwijderUitAcquisitieSelectie();
  const [localPending, setLocalPending] = useState(false);
  const pending = localPending || voegToe.isPending || verwijder.isPending;

  const handleClick = async (e: React.MouseEvent) => {
    if (stopPropagation) e.stopPropagation();
    if (pending) return;
    setLocalPending(true);
    try {
      if (inSelectie) {
        await verwijder.mutateAsync(signaalId);
        toast({ title: 'Verwijderd uit selectie' });
      } else {
        await voegToe.mutateAsync(signaalId);
        toast({ title: 'Toegevoegd aan selectie' });
      }
    } catch (err) {
      toast({
        title: inSelectie ? 'Verwijderen mislukt' : 'Toevoegen mislukt',
        description: err instanceof Error ? err.message : 'Onbekende fout',
        variant: 'destructive',
      });
    } finally {
      setLocalPending(false);
    }
  };

  if (variant === 'icon') {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        aria-pressed={inSelectie}
        aria-label={inSelectie ? 'Verwijder dit signaal uit de acquisitieselectie' : 'Voeg dit signaal toe aan de acquisitieselectie'}
        data-testid="acquisitie-selectie-toggle"
        data-variant="icon"
        data-in-selectie={inSelectie ? 'true' : 'false'}
        className={`inline-flex items-center justify-center h-9 w-9 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 sm:h-8 sm:w-8 rounded-md border transition-colors disabled:opacity-50 ${
          inSelectie
            ? 'border-accent/40 bg-accent/10 text-accent hover:bg-accent/20'
            : 'border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted'
        } ${className}`}
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : inSelectie ? <ListChecks className="h-4 w-4" /> : <ListPlus className="h-4 w-4" />}
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
  const ariaLabel = inSelectie || mode === 'remove'
    ? 'Verwijder dit signaal uit de acquisitieselectie'
    : 'Voeg dit signaal toe aan de acquisitieselectie';
  const Icon = pending
    ? Loader2
    : mode === 'remove'
      ? Trash2
      : inSelectie ? ListChecks : ListPlus;

  return (
    <Button
      type="button"
      size={variant === 'compact' ? 'sm' : 'default'}
      variant={mode === 'remove' ? 'outline' : (inSelectie ? 'outline' : 'secondary')}
      onClick={handleClick}
      disabled={pending}
      aria-pressed={inSelectie}
      aria-label={ariaLabel}
      data-testid="acquisitie-selectie-toggle"
      data-variant={variant}
      data-label-mode={mode}
      data-in-selectie={inSelectie ? 'true' : 'false'}
      className={`min-h-[44px] sm:min-h-0 ${className}`}
    >
      <Icon className={`h-4 w-4 ${pending ? 'animate-spin' : ''}`} />
      {label}
    </Button>
  );
}
