import { Link } from 'react-router-dom';
import { formatCurrencyCompact } from '@/data/mock-data';
import type { Aanbodvolume } from '@/lib/dashboard/aanbodvolume';

interface Props {
  /** Actief aanbodvolume, zonder dubbeltellingen (berekenAanbodvolume). */
  aanbodvolume: Aanbodvolume;
  /** Verwachte courtage (1 economische fee per object). null = onbekend. */
  courtage: number | null;
  /** Actieve objecten zonder fee in de berekening. null = onbekend. */
  objectenZonderFee: number | null;
  actieveObjecten: number;
  achterstallig: number;
}

const meervoud = (n: number, enkel: string, meer: string) => `${n} ${n === 1 ? enkel : meer}`;

/**
 * Compacte KPI-rij bovenaan het dashboard: vier kengetallen, elk klikbaar naar de lijst erachter.
 * Desktop: vier naast elkaar. Mobiel: 2×2. Deze cijfers komen elders op het dashboard niet terug.
 */
export default function DashboardKengetallen({ aanbodvolume, courtage, objectenZonderFee, actieveObjecten, achterstallig }: Props) {
  const kaart = 'kpi-card min-w-0 !gap-0 lg:!p-5';
  const label = 'text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.08em] leading-tight truncate';
  const waarde = 'font-mono-data text-[18px] sm:text-[22px] font-semibold leading-none mt-2 truncate';
  const toelichting = 'text-[11px] text-muted-foreground mt-1.5 leading-tight truncate';
  const heeftCourtage = courtage != null && courtage > 0;
  const heeftAanbod = aanbodvolume.totaal > 0;

  return (
    <section data-testid="dashboard-kengetallen" aria-label="Kengetallen" className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 lg:gap-4">
      <Link to="/objecten" className={kaart} title="Som van bekende vraagprijzen van actieve objecten; portefeuilles niet dubbel geteld">
        <p className={label}>Actief aanbodvolume</p>
        <p className={`${waarde} text-foreground`}>{heeftAanbod ? formatCurrencyCompact(aanbodvolume.totaal) : '—'}</p>
        {aanbodvolume.zonderVraagprijs > 0 && (
          <p className={toelichting}>{meervoud(aanbodvolume.zonderVraagprijs, 'object', 'objecten')} zonder vraagprijs</p>
        )}
      </Link>
      <Link to="/rapportage" className={kaart} title="1 economische fee per object">
        <p className={label}>Verwachte courtage</p>
        <p className={`${waarde} text-foreground`}>{heeftCourtage ? formatCurrencyCompact(courtage) : '—'}</p>
        {objectenZonderFee != null && objectenZonderFee > 0 && (
          <p className={toelichting}>{meervoud(objectenZonderFee, 'object', 'objecten')} zonder fee</p>
        )}
      </Link>
      <Link to="/objecten" className={kaart}>
        <p className={label}>Actieve objecten</p>
        <p className={`${waarde} text-foreground`}>{actieveObjecten}</p>
      </Link>
      <Link to="/taken" className={kaart}>
        <p className={label}>Achterstallige taken</p>
        <p className={`${waarde} ${achterstallig > 0 ? 'text-destructive' : 'text-foreground'}`}>{achterstallig}</p>
      </Link>
    </section>
  );
}
