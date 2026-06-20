import { useEffect, useRef } from 'react';
import { Building2, Loader2, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useBagBacklogCount, useBagBacklogVerwerken } from '@/hooks/useBagBacklog';

export default function BagAchterstandPanel() {
  const { data: count = 0, isLoading } = useBagBacklogCount();
  const { start, isRunning, progress, result, error } = useBagBacklogVerwerken();
  const eindgemeldRef = useRef(false);

  useEffect(() => {
    if (isRunning) {
      eindgemeldRef.current = false;
      return;
    }
    if (result && !eindgemeldRef.current) {
      eindgemeldRef.current = true;
      toast.success(
        `BAG-achterstand verwerkt: ${result.verrijkt} verrijkt · ${result.meerdere_matches} meerdere matches · ${result.geen_match} geen match · ${result.fout} fout · ${result.overgeslagen} overgeslagen`,
        {
          description:
            result.fout > 0 && result.fouten[0]
              ? `Eerste fout: ${result.fouten[0].error}`
              : undefined,
        },
      );
    }
    if (error && !eindgemeldRef.current) {
      eindgemeldRef.current = true;
      toast.error(`BAG-achterstand mislukt: ${error.message}`);
    }
  }, [isRunning, result, error]);

  const disabled = isRunning || (count === 0 && !isLoading);

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="text-sm">
          <div className="text-foreground font-medium flex items-center gap-1.5">
            <Building2 className="h-4 w-4 text-primary" />
            BAG-achterstand
          </div>
          <div className="text-muted-foreground mt-0.5">
            {isLoading
              ? 'Achterstand wordt geladen…'
              : count === 0
                ? 'Geen geschikte signalen zonder BAG-precheck.'
                : `${count} geschikt signaal${count === 1 ? '' : 'en'} zonder BAG-precheck.`}
          </div>
        </div>
        <Button
          type="button"
          onClick={start}
          disabled={disabled}
          data-testid="bag-achterstand-start"
        >
          {isRunning && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
          {isRunning ? 'Verwerken…' : 'BAG-achterstand verwerken'}
        </Button>
      </div>

      <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2">
        <ShieldAlert className="h-4 w-4 mt-px shrink-0" />
        <span>Gratis BAG-precheck via PDOK. Geen Kadaster-aanvraag.</span>
      </div>

      {progress && (
        <div
          className="rounded-md border border-border bg-card/60 px-3 py-2 text-xs text-muted-foreground"
          data-testid="bag-achterstand-voortgang"
        >
          <span className="text-foreground font-medium">Voortgang:</span>{' '}
          {progress.verwerkt} verwerkt · {progress.verrijkt} verrijkt ·{' '}
          {progress.meerdere_matches} meerdere matches · {progress.geen_match} geen match ·{' '}
          {progress.fout} fout · {progress.overgeslagen} overgeslagen ·{' '}
          {progress.resterend} resterend
        </div>
      )}
    </div>
  );
}
