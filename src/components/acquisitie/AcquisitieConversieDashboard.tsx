import { BarChart3, FlaskConical, Info } from 'lucide-react';
import { useAcquisitieConversieDashboard } from '@/hooks/useAcquisitieConversieDashboard';
import type { ConversieRij } from '@/lib/acquisitie/conversieDashboard';

const pct = (value: number) => `${new Intl.NumberFormat('nl-NL', { maximumFractionDigits: 1 }).format(value)}%`;

function ConversieTabel({ titel, toelichting, rijen }: { titel: string; toelichting: string; rijen: ConversieRij[] }) {
  return (
    <div className="rounded-md border border-border overflow-hidden">
      <div className="border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold text-foreground">{titel}</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">{toelichting}</p>
      </div>
      {rijen.length === 0 ? (
        <div className="px-4 py-5 text-sm text-muted-foreground">Nog onvoldoende verzenddata.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-muted/20 text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Groep</th>
                <th className="px-3 py-2 text-right font-medium">Verzonden</th>
                <th className="px-3 py-2 text-right font-medium">Reacties</th>
                <th className="px-3 py-2 text-right font-medium">Respons</th>
                <th className="px-4 py-2 text-right font-medium">Positief</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rijen.map(rij => (
                <tr key={rij.sleutel}>
                  <td className="px-4 py-2.5 font-medium text-foreground">{rij.label}</td>
                  <td className="px-3 py-2.5 text-right font-mono-data">{rij.verzonden}</td>
                  <td className="px-3 py-2.5 text-right font-mono-data">{rij.reacties}</td>
                  <td className="px-3 py-2.5 text-right font-mono-data">{pct(rij.responspercentage)}</td>
                  <td className="px-4 py-2.5 text-right font-mono-data">
                    {rij.positieveReacties} <span className="text-muted-foreground">· {pct(rij.positieveResponspercentage)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function AcquisitieConversieDashboard() {
  const jaar = new Date().getFullYear();
  const { model, isLoading, error } = useAcquisitieConversieDashboard(jaar);

  if (isLoading) {
    return <section className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">Conversiedashboard laden…</section>;
  }

  if (error) {
    return (
      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-semibold">Conversie & experimenten</h2>
        <p className="mt-1 text-sm text-muted-foreground">De conversiedata kon niet worden geladen. De bestaande acquisitiemeetlaag blijft beschikbaar.</p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-border bg-card p-4 space-y-4" data-testid="acquisitie-conversie-dashboard">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">Conversie & experimenten</h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Eén centraal overzicht. Reacties worden toegerekend aan de communicatie waarop is gereageerd, niet aan het inkomende antwoordkanaal.
          </p>
        </div>
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Info className="h-3.5 w-3.5" /> Cohortbasis · {jaar}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Verzonden" value={String(model.totaal.verzonden)} detail="Unieke communicaties" />
        <Metric label="Reacties" value={String(model.totaal.reacties)} detail={`${pct(model.totaal.responspercentage)} respons`} />
        <Metric label="Positieve reacties" value={String(model.totaal.positieveReacties)} detail={`${pct(model.totaal.positieveResponspercentage)} van verzonden`} />
        <Metric
          label="Attributiecontrole"
          value={model.reactiesZonderVerzending === 0 ? '100%' : `${model.reactiesZonderVerzending} los`}
          detail={model.reactiesZonderVerzending === 0 ? 'Alle reacties koppelbaar' : 'Reacties zonder gevonden verzending'}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ConversieTabel
          titel="Per contactkanaal"
          toelichting="Respons is gekoppeld aan het kanaal van de oorspronkelijke verzending."
          rijen={model.perKanaal}
        />
        <ConversieTabel
          titel="Per touchpoint"
          toelichting="Hier worden Brief 1, E-mail 1 en toekomstige opvolgstappen naast elkaar vergelijkbaar."
          rijen={model.perTouchpoint}
        />
      </div>

      <ConversieTabel
        titel="Ontwikkeling per verzendcohort"
        toelichting="Reacties die later binnenkomen blijven bij de maand van de oorspronkelijke verzending staan."
        rijen={model.perMaand}
      />

      <div className="rounded-md border border-dashed border-border bg-muted/10 p-4 flex gap-3">
        <FlaskConical className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <div>
          <div className="text-sm font-medium text-foreground">A/B-testlaag voorbereid</div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Het dashboard is nu de centrale analyseplek. Tekstvariant A/B is nog niet als afzonderlijk meetveld gemodelleerd; daarom toont de app bewust nog geen schijnwinnaar. De volgende tranche koppelt iedere verzending aan een vaste variant en hypothese, waarna dezelfde tabel automatisch per variant kan vergelijken.
          </p>
        </div>
      </div>
    </section>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-md border border-border bg-muted/20 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold font-mono-data text-foreground">{value}</div>
      <div className="mt-1 text-[11px] text-muted-foreground">{detail}</div>
    </div>
  );
}
