import { Link } from 'react-router-dom';
import { ChevronRight, Handshake } from 'lucide-react';
import { formatCurrency } from '@/data/mock-data';
import type { LopendeTransactie, LopendeTransactiesOverzicht } from '@/lib/dashboard/lopendeTransacties';

interface Props {
  overzicht: LopendeTransactiesOverzicht;
}

const korteDatum = (sleutel: string) => {
  const [y, m, d] = sleutel.split('-').map(Number);
  const datum = new Date(y, m - 1, d);
  const ditJaar = y === new Date().getFullYear();
  return datum.toLocaleDateString('nl-NL', ditJaar ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' });
};

const BOD_STATUS: Record<string, string> = {
  ontvangen: 'ontvangen',
  in_behandeling: 'in behandeling',
  tegenvoorstel_gedaan: 'tegenvoorstel gedaan',
  aangepast_bod_gevraagd: 'aangepast bod gevraagd',
  geaccepteerd: 'geaccepteerd',
  afgewezen: 'afgewezen',
  ingetrokken: 'ingetrokken',
  verlopen: 'verlopen',
};

function Regel({ t }: { t: LopendeTransactie }) {
  const actie = t.volgendeActie;
  const actieVerlopen = !!actie?.datum && t.mijlpaal?.soort === 'actie' && t.mijlpaal.verlopen && t.mijlpaal.datum === actie.datum;
  return (
    <div data-testid="lopende-transactie" className="px-4 sm:px-5 py-3">
      <div className="flex items-start justify-between gap-3">
        <Link to={`/objecten/${t.objectId}`} className="min-w-0 group inline-flex items-start gap-1">
          <span className="text-sm font-medium text-foreground break-words group-hover:underline">{t.objectTitel}</span>
          <ChevronRight className="h-3.5 w-3.5 mt-0.5 text-muted-foreground/60 shrink-0" />
        </Link>
        <span data-testid="transactie-fase" className="shrink-0 rounded-md bg-accent/10 px-1.5 py-0.5 text-[11px] font-semibold text-accent">{t.faseLabel}</span>
      </div>
      <p className="text-xs text-muted-foreground mt-0.5">
        {[t.koper, t.objectOnHold ? 'object on hold' : null, t.gewensteLevering ? `levering ${korteDatum(t.gewensteLevering)}` : null]
          .filter(Boolean).join(' · ') || 'Koper niet gekoppeld'}
      </p>
      {t.stilDagen != null && (
        <p data-testid="transactie-stil" className="text-xs font-semibold text-warning mt-0.5">{`Stil sinds ${t.stilDagen} dagen`}</p>
      )}
      <p className="text-xs text-foreground mt-1">
        <span className="text-muted-foreground">Volgende actie: </span>
        {actie ? (
          <span>
            {actie.tekst}
            {actie.datum && <span className={actieVerlopen ? 'text-destructive' : 'text-muted-foreground'}>{` · ${korteDatum(actie.datum)}${actieVerlopen ? ' (verlopen)' : ''}`}</span>}
          </span>
        ) : <span className="text-muted-foreground">niet vastgelegd</span>}
      </p>
      {t.laatsteBod && (
        <p data-testid="transactie-bod" className="text-[11px] text-muted-foreground mt-0.5 tabular-nums">
          {`Laatste bod ${t.laatsteBod.bedrag != null ? formatCurrency(t.laatsteBod.bedrag) : 'zonder bedrag'} · ${korteDatum(t.laatsteBod.datum)}${BOD_STATUS[t.laatsteBod.status] ? ` · ${BOD_STATUS[t.laatsteBod.status]}` : ''}`}
        </p>
      )}
    </div>
  );
}

/**
 * Lopende transacties: maximaal drie trajecten die het verst richting overeenkomst of levering zijn,
 * één per object. Toont voortgang; knelpunten staan in Aandacht nodig.
 */
export default function DashboardLopendeTransacties({ overzicht }: Props) {
  const { items, totaal } = overzicht;
  return (
    <section data-testid="dashboard-lopende-transacties" className="section-card overflow-hidden">
      <header className="section-header">
        <div className="min-w-0">
          <h2 className="section-title flex items-center gap-2"><Handshake className="h-4 w-4 text-accent" />Lopende transacties</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {totaal === 0
              ? 'Vanaf Bieding / prijsvoorstel'
              : totaal > items.length
                ? `${items.length} van ${totaal} · verst gevorderd eerst`
                : `${totaal} ${totaal === 1 ? 'traject' : 'trajecten'} · verst gevorderd eerst`}
          </p>
        </div>
        <Link to="/pipeline" className="section-link inline-flex items-center gap-1">Pipeline <ChevronRight className="h-3 w-3" /></Link>
      </header>
      {items.length === 0 ? (
        <p className="px-4 sm:px-5 py-4 text-sm text-muted-foreground">Geen lopende transacties vanaf Bieding / prijsvoorstel.</p>
      ) : (
        <div className="divide-y divide-border/60">
          {items.map(t => <Regel key={t.objectId} t={t} />)}
        </div>
      )}
    </section>
  );
}
