// V1A — Toggle-knop: voegt een signaal toe aan of haalt het uit de centrale
// Off-Market Acquisitieselectie. Uit selectie is een soft-remove: alleen de
// selectie-relatie wordt gearchiveerd; signaal, eigenaar, brieven en historie
// blijven behouden. Pending-state voorkomt dubbelklik.
import { useState } from 'react';
import { ListPlus, ListChecks, Loader2, ListMinus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  useIsInAcquisitieSelectie,
  useVoegToeAanAcquisitieSelectie,
  useVerwijderUitAcquisitieSelectie,
} from '@/hooks/useAcquisitieSelectie';
import {
  voegSignaalToeAanAcquisitieSelectie,
  verwijderSignaalUitAcquisitieSelectie,
} from '@/lib/offMarket/acquisitie/acquisitieSelectieActions';

type Variant = 'default' | 'compact' | 'icon';
type LabelMode = 'long' | 'short' | 'remove';

interface Props {
  signaalId: string;
  variant?: Variant;
  /** Tekstvariant.
   *  - 'long'   : "Toevoegen aan acquisitieselectie" / "Uit acquisitieselectie"
   *  - 'short'  : "Aan selectie" / "Uit selectie"
   *  - 'remove' : "Uit selectie" binnen de Acquisitieselectie-tab
   *  Default volgt het variant: default→long, compact→short.
   */
  labelMode?: LabelMode;
  /** Eventueel forceren: handig wanneer ouder een eigen statusbron heeft. */
  isInSelectie?: boolean;
  className?: string;
  /** Stop event propagation (lijstrijen, popups). */
  stopPropagation?: boolean;
}

interface ToggleProps extends Omit<Props, 'isInSelectie'> {
  inSelectie: boolean;
  voegToe: (signaalId: string) => Promise<unknown>;
  verwijder: (signaalId: string) => Promise<unknown>;
  externalPending?: boolean;
}

function AcquisitieSelectieToggle({
  signaalId,
  variant = 'default',
  labelMode,
  inSelectie,
  className = '',
  stopPropagation = false,
  voegToe,
  verwijder,
  externalPending = false,
}: ToggleProps) {
  const [localPending, setLocalPending] = useState(false);
  const pending = localPending || externalPending;

  const handleClick = async (e: React.MouseEvent) => {
    if (stopPropagation) e.stopPropagation();
    if (pending) return;

    if (inSelectie) {
      const bevestigd = window.confirm(
        'Dit signaal uit de acquisitieselectie halen?\n\nHet oorspronkelijke signaal, de eigenaar, brieven en historie blijven behouden.',
      );
      if (!bevestigd) return;
    }

    setLocalPending(true);
    try {
      if (inSelectie) {
        await verwijder(signaalId);
        toast.success('Uit acquisitieselectie gehaald', {
          description: 'Het oorspronkelijke signaal en de historie zijn behouden.',
        });
      } else {
        await voegToe(signaalId);
        toast.success('Toegevoegd aan selectie');
      }
    } catch (err) {
      toast.error(inSelectie ? 'Uit selectie halen mislukt' : 'Toevoegen mislukt', {
        description: err instanceof Error ? err.message : 'Onbekende fout',
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
        aria-label={inSelectie ? 'Haal dit signaal uit de acquisitieselectie' : 'Voeg dit signaal toe aan de acquisitieselectie'}
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
  const labelToevoegen = mode === 'long' ? 'Toevoegen aan acquisitieselectie' : 'Aan selectie';
  const labelVerwijderen = mode === 'long' ? 'Uit acquisitieselectie' : 'Uit selectie';
  const label = pending
    ? (inSelectie ? 'Uit selectie halen…' : 'Toevoegen…')
    : inSelectie ? labelVerwijderen : labelToevoegen;
  const ariaLabel = inSelectie || mode === 'remove'
    ? 'Haal dit signaal uit de acquisitieselectie'
    : 'Voeg dit signaal toe aan de acquisitieselectie';
  const Icon = pending
    ? Loader2
    : mode === 'remove'
      ? ListMinus
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

function ZelfDetecterendeToggle(props: Omit<Props, 'isInSelectie'>) {
  const detected = useIsInAcquisitieSelectie(props.signaalId);
  const voegToeMutation = useVoegToeAanAcquisitieSelectie();
  const verwijderMutation = useVerwijderUitAcquisitieSelectie();
  return (
    <AcquisitieSelectieToggle
      {...props}
      inSelectie={detected}
      voegToe={voegToeMutation.mutateAsync}
      verwijder={verwijderMutation.mutateAsync}
      externalPending={voegToeMutation.isPending || verwijderMutation.isPending}
    />
  );
}

function GecontroleerdeToggle({ isInSelectie, ...props }: Props & { isInSelectie: boolean }) {
  return (
    <AcquisitieSelectieToggle
      {...props}
      inSelectie={isInSelectie}
      voegToe={voegSignaalToeAanAcquisitieSelectie}
      verwijder={verwijderSignaalUitAcquisitieSelectie}
    />
  );
}

export default function ToevoegenAanAcquisitieSelectieKnop({ isInSelectie, ...props }: Props) {
  // Grote lijsten leveren de selectiestatus centraal aan. In die gecontroleerde
  // modus gebruiken we imperatieve acties: geen useMutation/MutationObserver per rij.
  // Zonder override blijft de zelf-detecterende hookvariant ongewijzigd beschikbaar.
  if (isInSelectie !== undefined) {
    return <GecontroleerdeToggle {...props} isInSelectie={isInSelectie} />;
  }

  return <ZelfDetecterendeToggle {...props} />;
}
