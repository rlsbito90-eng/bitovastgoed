import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useDataStore } from '@/hooks/useDataStore';
import {
  formatCurrency, formatCurrencyCompact,
  type ObjectVastgoed,
} from '@/data/mock-data';
import { TrendingUp, ExternalLink, Info } from 'lucide-react';

interface Props {
  object: ObjectVastgoed;
}

function mediaan(getallen: number[]): number | undefined {
  if (getallen.length === 0) return undefined;
  const sorted = [...getallen].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * Alleen-lezen weergave van de marktwaarde-indicatie op deal-detail.
 * Haalt referentie-data uit het GEKOPPELDE OBJECT (niet de deal zelf).
 *
 * Reden: vanaf batch 8a horen referenties bij het object, niet bij de deal.
 * Maar de deal-pagina kan wel een snapshot tonen, met een link naar het
 * object voor wie er meer wil.
 */
export default function DealMarktwaardeReadOnly({ object }: Props) {
  const store = useDataStore();
  const gekoppeld = store.getReferentiesVoorObject(object.id);
  const objectM2 = object.oppervlakteVvo ?? object.oppervlakte;

  const marktwaarde = useMemo(() => {
    if (!objectM2 || objectM2 <= 0) return null;
    const perM2 = gekoppeld
      .map(r => r.prijsPerM2)
      .filter((v): v is number => v != null && !Number.isNaN(v));
    if (perM2.length < 2) return null;
    const med = mediaan(perM2);
    if (med == null) return null;
    return {
      mediaan: med * objectM2,
      ondergrens: Math.min(...perM2) * objectM2,
      bovengrens: Math.max(...perM2) * objectM2,
      aantal: perM2.length,
    };
  }, [objectM2, gekoppeld]);

  // Alleen tonen als er data is
  if (!marktwaarde) return null;

  return (
    <section className="section-card p-5 sm:p-6 space-y-3">
      <div className="row-with-action">
        <h2 className="section-title flex items-center gap-2 row-flex">
          <TrendingUp className="h-4 w-4 text-accent shrink-0" />
          <span>Marktwaarde-indicatie</span>
        </h2>
        <Link
          to={`/objecten/${object.id}`}
          className="row-action text-xs text-accent hover:text-accent/80 transition-colors flex items-center gap-1"
        >
          <span>Bewerken op object</span>
          <ExternalLink className="h-3 w-3" />
        </Link>
      </div>

      <p className="text-xs text-muted-foreground">
        Snapshot van de referentieanalyse op het gekoppelde object.
      </p>

      <div className="p-4 rounded-md border-2 border-accent/40 bg-accent/[0.06]">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Indicatieve marktwaarde (mediaan)</p>
        <p className="text-2xl sm:text-3xl font-semibold font-mono-data text-accent mt-1 break-all">
          {formatCurrency(Math.round(marktwaarde.mediaan))}
        </p>
        <p className="text-[11px] text-muted-foreground mt-1">
          Op basis van {marktwaarde.aantal} referentie{marktwaarde.aantal === 1 ? '' : 's'}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        <div className="p-2.5 sm:p-3 rounded-md border border-border min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Ondergrens</p>
          <p className="text-sm sm:text-base font-semibold font-mono-data mt-0.5 truncate">
            {formatCurrency(Math.round(marktwaarde.ondergrens))}
          </p>
        </div>
        <div className="p-2.5 sm:p-3 rounded-md border border-border min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Bovengrens</p>
          <p className="text-sm sm:text-base font-semibold font-mono-data mt-0.5 truncate">
            {formatCurrencyCompact(Math.round(marktwaarde.bovengrens))}
          </p>
        </div>
      </div>

      <div className="flex items-start gap-2 p-2.5 rounded-md bg-muted/30 text-[11px] text-muted-foreground">
        <Info className="h-3 w-3 shrink-0 mt-0.5" />
        <span>
          Deze indicatie is afkomstig van het gekoppelde object. Bewerk de referenties via de objectpagina.
        </span>
      </div>
    </section>
  );
}
