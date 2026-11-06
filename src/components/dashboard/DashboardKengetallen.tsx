import { Link } from 'react-router-dom';
import { formatCurrencyCompact } from '@/data/mock-data';

interface Props {
  /** Verwachte courtage (1 economische fee per object). null = onbekend. */
  courtage: number | null;
  /** Actieve objecten zonder fee in de berekening. null = onbekend. */
  objectenZonderFee: number | null;
  actieveObjecten: number;
  achterstallig: number;
}

/**
 * De drie kengetallen bovenaan het dashboard. Elk cijfer staat maar één keer op het dashboard
 * en linkt naar de lijst erachter. Uitgebreide statistiek hoort bij Rapportage.
 */
export default function DashboardKengetallen({ courtage, objectenZonderFee, actieveObjecten, achterstallig }: Props) {
  const tegel = 'min-w-0 rounded-xl border border-border bg-card px-3 py-2.5 sm:px-4 sm:py-3 transition-colors hover:border-foreground/30';
  const label = 'text-[11px] font-medium text-muted-foreground truncate';
  const waarde = 'font-mono-data text-[17px] sm:text-[20px] font-semibold leading-tight mt-1 truncate';
  const toelichting = 'text-[11px] text-muted-foreground mt-0.5 truncate';
  const heeftCourtage = courtage != null && courtage > 0;

  return (
    <section data-testid="dashboard-kengetallen" aria-label="Kengetallen" className="grid grid-cols-3 gap-2 sm:gap-3">
      <Link to="/rapportage" className={tegel} title="1 economische fee per object">
        <p className={label}>Verwachte courtage</p>
        <p className={`${waarde} text-foreground`}>{heeftCourtage ? formatCurrencyCompact(courtage) : '—'}</p>
        {objectenZonderFee != null && objectenZonderFee > 0 && (
          <p className={toelichting}>{objectenZonderFee} {objectenZonderFee === 1 ? 'object' : 'objecten'} zonder fee</p>
        )}
      </Link>
      <Link to="/objecten" className={tegel}>
        <p className={label}>Actieve objecten</p>
        <p className={`${waarde} text-foreground`}>{actieveObjecten}</p>
      </Link>
      <Link to="/taken" className={tegel}>
        <p className={label}>Achterstallige taken</p>
        <p className={`${waarde} ${achterstallig > 0 ? 'text-destructive' : 'text-foreground'}`}>{achterstallig}</p>
      </Link>
    </section>
  );
}
