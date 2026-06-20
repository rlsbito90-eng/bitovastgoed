import { useEffect, useRef } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useAiBacklogCount, useAiBacklogVerwerken } from '@/hooks/useAiBacklog';

export default function AiAchterstandPanel() {
  const { data: count = 0, isLoading } = useAiBacklogCount();
  const { start, isRunning, progress, result, error } = useAiBacklogVerwerken();
  const eindgemeldRef = useRef(false);

  useEffect(() => {
    if (isRunning) {
      eindgemeldRef.current = false;
      return;
    }
    if (result && !eindgemeldRef.current) {
      eindgemeldRef.current = true;
      toast.success(
        `AI-achterstand verwerkt: ${result.geslaagd} geslaagd · ${result.mislukt} mislukt · ${result.totaal} totaal`,
        {
          description:
            result.mislukt > 0 && result.fouten[0]
              ? `Eerste fout: ${result.fouten[0].error}`
              : undefined,
        },
      );
    }
    if (error && !eindgemeldRef.current) {
      eindgemeldRef.current = true;
      toast.error(`AI-achterstand mislukt: ${error.message}`);
    }
  }, [isRunning, result, error]);

  const disabled = isRunning || (count === 0 && !isLoading);

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="text-sm">
          <div className="text-foreground font-medium flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-primary" />
            AI-achterstand
          </div>
          <div className="text-muted-foreground mt-0.5">
            {isLoading
              ? 'Achterstand wordt geladen…'
              : count === 0
                ? 'Geen signalen zonder AI-score.'
                : `${count} signaal${count === 1 ? '' : 'en'} zonder AI-score.`}
          </div>
        </div>
        <Button
          type="button"
          onClick={start}
          disabled={disabled}
          data-testid="ai-achterstand-start"
        >
          {isRunning && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
          {isRunning ? 'Verwerken…' : 'AI-achterstand verwerken'}
        </Button>
      </div>

      {progress && (
        <div
          className="rounded-md border border-border bg-card/60 px-3 py-2 text-xs text-muted-foreground"
          data-testid="ai-achterstand-voortgang"
        >
          <span className="text-foreground font-medium">Voortgang:</span>{' '}
          {progress.verwerkt} verwerkt · {progress.geslaagd} geslaagd ·{' '}
          {progress.mislukt} mislukt · {progress.resterend} resterend
        </div>
      )}
    </div>
  );
}
