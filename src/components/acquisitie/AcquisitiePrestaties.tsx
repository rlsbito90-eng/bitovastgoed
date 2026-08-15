import { useMemo } from 'react';
import { Info } from 'lucide-react';
import { useAcquisitieTrackingPrestaties } from '@/hooks/useAcquisitieTrackingPrestaties';
import AcquisitieJaarDoelen from '@/components/acquisitie/AcquisitieJaarDoelen';

const bronLabel: Record<string, string> = {
  off_market_radar: 'Off-Market Radar',
  vastgoedkansen: 'Vastgoedkansen',
};

function fmtMaand(value: string) {
  const date = new Date(`${value}T12:00:00`);
  return new Intl.DateTimeFormat('nl-NL', { month: 'long', year: 'numeric' }).format(date);
}

function fmtEuro(value: number) {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(value);
}

export default function AcquisitiePrestaties() {
  const jaar = new Date().getFullYear();
  const { cohort, maandKpis, jaarActuals, isLoading, error } = useAcquisitieTrackingPrestaties(jaar);

  const laatsteCohort = cohort[0] ?? null;
  const laatsteKadasterMaand = useMemo(
    () => maandKpis.find(rij => rij.kadaster_aanvragen > 0 || rij.kadaster_leveringen > 0) ?? null,
    [maandKpis],
  );

  if (isLoading) {
    return <section className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">Acquisitieprestaties laden…</section>;
  }

  if (error) {
    return (
      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-semibold">Acquisitieprestaties</h2>
        <p className="mt-1 text-sm text-muted-foreground">De meetlaag kon niet worden geladen. De operationele funnel blijft beschikbaar.</p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-border bg-card p-4 space-y-4" data-testid="acquisitie-prestaties">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">Acquisitieprestaties</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Respons wordt toegerekend aan de maand waarin de brief is verzonden, ook als de reactie later binnenkomt.
          </p>
        </div>
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <Info className="h-3.5 w-3.5" /> Automatisch uit geregistreerde acquisitie-events
        </span>
      </div>

      {laatsteCohort ? (
        <div>
          <div className="mb-2 text-xs font-medium text-muted-foreground">
            Laatste verzendcohort · {fmtMaand(laatsteCohort.verzendmaand)} · {bronLabel[laatsteCohort.acquisitie_bron] ?? laatsteCohort.acquisitie_bron}
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <Metric label="Verzonden brieven" value={String(laatsteCohort.verzonden_brieven)} />
            <Metric label="Reacties" value={String(laatsteCohort.reacties)} detail={`${laatsteCohort.responspercentage}% respons`} />
            <Metric label="Positieve reacties" value={String(laatsteCohort.positieve_reacties)} detail={`${laatsteCohort.positieve_responspercentage}% van verzonden`} />
            <Metric label="Retourpost" value={String(laatsteCohort.retourpost)} />
            <Metric
              label="Gem. reactietijd"
              value={laatsteCohort.gemiddelde_dagen_tot_reactie == null ? '—' : `${laatsteCohort.gemiddelde_dagen_tot_reactie} d`}
            />
          </div>
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
          Nog geen verzendcohort beschikbaar. Actuals en jaardoelen worden zichtbaar zodra acquisitie-events zijn geregistreerd.
        </div>
      )}

      {laatsteKadasterMaand && (
        <div className="border-t border-border pt-3">
          <div className="mb-2 text-xs font-medium text-muted-foreground">
            Kadaster · {fmtMaand(laatsteKadasterMaand.maand)} · {bronLabel[laatsteKadasterMaand.acquisitie_bron] ?? laatsteKadasterMaand.acquisitie_bron}
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Metric label="Aanvragen" value={String(laatsteKadasterMaand.kadaster_aanvragen)} />
            <Metric label="Leveringen" value={String(laatsteKadasterMaand.kadaster_leveringen)} />
            <Metric
              label="Werkelijke kosten"
              value={laatsteKadasterMaand.kadaster_werkelijke_kosten > 0 ? fmtEuro(laatsteKadasterMaand.kadaster_werkelijke_kosten) : '—'}
            />
            <Metric
              label="Kosten beste bron"
              value={laatsteKadasterMaand.kadaster_kosten_beste_beschikbaar > 0 ? fmtEuro(laatsteKadasterMaand.kadaster_kosten_beste_beschikbaar) : '—'}
              detail="Werkelijk, anders geraamd"
            />
          </div>
        </div>
      )}

      <AcquisitieJaarDoelen jaar={jaar} actuals={jaarActuals} />
    </section>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-md border border-border bg-muted/20 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold font-mono-data">{value}</div>
      {detail && <div className="mt-1 text-[11px] text-muted-foreground">{detail}</div>}
    </div>
  );
}
