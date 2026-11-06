import { Link } from 'react-router-dom';
import { Building2 } from 'lucide-react';
import { formatCurrencyCompact } from '@/data/mock-data';

interface Props {
  /** Som van vraagprijzen van niet-gearchiveerde objecten. */
  aanbodvolume: number;
  beschikbaar: number;
  /** Verwachte courtage (1 economische fee per object). null = onbekend. */
  courtage: number | null;
  /** Actieve objecten zonder fee in de berekening. null = onbekend. */
  objectenZonderFee: number | null;
  actieveObjecten: number;
  achterstallig: number;
}

/**
 * Bovenste blok van het dashboard: het actief aanbodvolume als hoofdcijfer, met daaronder de drie
 * afgesproken kengetallen. Elk cijfer staat maar één keer op het dashboard en linkt naar de lijst
 * erachter. Uitgebreide statistiek hoort bij Rapportage.
 */
export default function DashboardKengetallen({
  aanbodvolume, beschikbaar, courtage, objectenZonderFee, actieveObjecten, achterstallig,
}: Props) {
  const cel = 'min-w-0 rounded-lg -m-1.5 p-1.5 transition-colors hover:bg-foreground/5';
  const label = 'text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.08em] truncate';
  const waarde = 'font-mono-data text-[16px] sm:text-[18px] font-semibold leading-none mt-1.5 truncate';
  const toelichting = 'text-[11px] text-muted-foreground mt-1 leading-none truncate';
  const heeftCourtage = courtage != null && courtage > 0;

  return (
    <section data-testid="dashboard-kengetallen" aria-label="Kengetallen" className="kpi-hero">
      <Link to="/objecten" className="relative z-[1] flex items-start justify-between gap-4 group">
        <div className="min-w-0">
          <p className="kpi-label">Actief aanbodvolume</p>
          <p className="kpi-hero-value mt-2">{formatCurrencyCompact(aanbodvolume)}</p>
          <p className="text-[12px] text-muted-foreground mt-2 tracking-tight">{beschikbaar} direct beschikbaar</p>
        </div>
        <span className="hidden sm:flex h-12 w-12 rounded-2xl bg-primary text-primary-foreground items-center justify-center shrink-0 shadow-md ring-1 ring-primary/20 transition-transform group-hover:scale-105">
          <Building2 className="h-5 w-5" strokeWidth={2.25} />
        </span>
      </Link>

      <div className="relative z-[1] mt-4 pt-3.5 border-t border-border/50 grid grid-cols-3 gap-3 sm:gap-5">
        <Link to="/rapportage" className={cel} title="1 economische fee per object">
          <p className={label}>Verwachte courtage</p>
          <p className={`${waarde} text-foreground`}>{heeftCourtage ? formatCurrencyCompact(courtage) : '—'}</p>
          {objectenZonderFee != null && objectenZonderFee > 0 && (
            <p className={toelichting}>{objectenZonderFee} {objectenZonderFee === 1 ? 'object' : 'objecten'} zonder fee</p>
          )}
        </Link>
        <Link to="/objecten" className={cel}>
          <p className={label}>Actieve objecten</p>
          <p className={`${waarde} text-foreground`}>{actieveObjecten}</p>
        </Link>
        <Link to="/taken" className={cel}>
          <p className={label}>Achterstallige taken</p>
          <p className={`${waarde} ${achterstallig > 0 ? 'text-destructive' : 'text-foreground'}`}>{achterstallig}</p>
        </Link>
      </div>
    </section>
  );
}
