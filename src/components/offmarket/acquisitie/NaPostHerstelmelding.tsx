import { AlertTriangle, CheckCircle2, RotateCcw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { AcquisitieNaPostActiebediening } from '@/lib/offMarket/acquisitie/acquisitieNaPostActiebediening';
import type { AcquisitieNaPostActiestatus } from '@/lib/offMarket/acquisitie/acquisitieNaPostActiestatus';

export interface NaPostHerstelmeldingProps {
  status: AcquisitieNaPostActiestatus;
  bediening: AcquisitieNaPostActiebediening;
  bezig?: boolean;
  onHerstel: (actie: AcquisitieNaPostActiebediening) => void;
}

/**
 * Presentatielaag voor één na-postherstelactie. De component toont uitsluitend
 * privacyveilige projectietekst en geeft het declaratieve actiecontract terug
 * aan de aanroeper; hij voert zelf geen repository- of productiewrite uit.
 */
export default function NaPostHerstelmelding({
  status,
  bediening,
  bezig = false,
  onHerstel,
}: NaPostHerstelmeldingProps) {
  if (!bediening.zichtbaar || bediening.variant === 'verborgen') return null;

  const auditAlleen = bediening.actie === 'audit_herstellen';
  const Icon = auditAlleen ? CheckCircle2 : AlertTriangle;

  return (
    <section
      className={`rounded-lg border p-4 ${
        auditAlleen
          ? 'border-border bg-muted/30'
          : 'border-destructive/30 bg-destructive/5'
      }`}
      aria-live="polite"
      data-testid="na-post-herstelmelding"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <Icon
            className={`mt-0.5 h-5 w-5 shrink-0 ${
              auditAlleen ? 'text-muted-foreground' : 'text-destructive'
            }`}
            aria-hidden="true"
          />
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">{status.titel}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{status.toelichting}</p>
            {status.aantalMislukt > 1 && (
              <p className="mt-1 text-xs text-muted-foreground">
                {status.aantalMislukt} handelingen vereisen herstel.
              </p>
            )}
          </div>
        </div>

        <Button
          type="button"
          variant={bediening.variant === 'secundair' ? 'outline' : 'default'}
          size="sm"
          disabled={bezig || bediening.uitgeschakeld}
          onClick={() => onHerstel(bediening)}
          className="shrink-0"
        >
          <RotateCcw className={`mr-1.5 h-4 w-4 ${bezig ? 'animate-spin' : ''}`} aria-hidden="true" />
          {bezig ? 'Bezig…' : bediening.label}
        </Button>
      </div>
    </section>
  );
}
