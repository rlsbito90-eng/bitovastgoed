// src/components/MatchUitleg.tsx
//
// "Waarom deze match?" — compacte uitleg per match.
//
// Toont:
//   - kop met score + betrouwbaarheidsindicatie
//   - badges voor type / subcategorieën / dealtypes (uit object)
//   - lijst met positieve factoren
//   - lijst met ontbrekende data
//   - lijst met mismatch-factoren
//   - melding wanneer legacy fallback gebruikt is
//
// Werkt defensief: nieuwe taxonomie-velden of factoren mogen leeg/undefined
// zijn, dan valt het component netjes terug op alleen wat beschikbaar is.

import {
  Check, AlertCircle, MinusCircle, Sparkles, Info,
} from 'lucide-react';
import type { MatchResult, MatchFactor, ObjectVastgoed } from '@/data/mock-data';
import {
  PropertyTypeBadge, SubtypeBadges, DealtypeBadges,
} from '@/components/TaxonomieBadges';

interface MatchUitlegProps {
  match: MatchResult;
  /** Object waarop de match is berekend — voor de classificatie-badges. */
  object?: ObjectVastgoed;
  /** Default tonen we de gehele uitleg. Met `compact` blijft het korter. */
  compact?: boolean;
}

const BETROUWBAARHEID_CONFIG = {
  hoog: {
    label: 'Hoge matchkwaliteit',
    cls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
  },
  middel: {
    label: 'Gemiddelde matchkwaliteit',
    cls: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
  },
  laag: {
    label: 'Lage matchkwaliteit',
    cls: 'bg-muted text-muted-foreground border-border',
  },
} as const;

function FactorRij({ factor }: { factor: MatchFactor }) {
  const Icon =
    factor.aard === 'positief' ? Check :
    factor.aard === 'fallback' ? Info :
    factor.aard === 'mismatch' ? MinusCircle : AlertCircle;
  const tone =
    factor.aard === 'positief' ? 'text-emerald-600 dark:text-emerald-400' :
    factor.aard === 'fallback' ? 'text-sky-600 dark:text-sky-400' :
    factor.aard === 'mismatch' ? 'text-rose-600 dark:text-rose-400' :
    'text-muted-foreground';

  return (
    <li className="flex items-start gap-2 text-xs">
      <Icon className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${tone}`} />
      <span className="flex-1 text-foreground/90">{factor.label}</span>
      {typeof factor.punten === 'number' && typeof factor.max === 'number' && (
        <span className="text-[10px] font-mono-data text-muted-foreground shrink-0">
          {factor.punten}/{factor.max}
        </span>
      )}
    </li>
  );
}

export default function MatchUitleg({ match, object, compact = false }: MatchUitlegProps) {
  const conf = BETROUWBAARHEID_CONFIG[match.betrouwbaarheid];
  const positief = match.factoren.filter(f => f.aard === 'positief' || f.aard === 'fallback');
  const ontbrekend = match.factoren.filter(f => f.aard === 'ontbrekend');
  const mismatch = match.factoren.filter(f => f.aard === 'mismatch');

  return (
    <div className="space-y-3 rounded-md border border-border/70 bg-muted/30 p-3">
      {/* Header */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-accent" />
          <span className="text-xs font-semibold text-foreground">Waarom deze match?</span>
        </div>
        <span className={`ml-auto inline-flex items-center text-[10px] font-medium border rounded-full px-2 py-0.5 ${conf.cls}`}>
          {conf.label}
        </span>
        <span className="text-[11px] font-mono-data font-semibold text-foreground">
          {match.score}%
        </span>
      </div>

      {/* Classificatie-badges van het object (als beschikbaar) */}
      {object && (
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <PropertyTypeBadge
              id={object.propertyTypeId}
              fallbackAssetClass={object.type}
              variant="compact"
              showEmpty={false}
            />
            <SubtypeBadges
              ids={object.propertySubtypeIds}
              variant="compact"
              max={4}
              showEmpty={false}
            />
            <DealtypeBadges
              ids={object.dealTypeIds}
              variant="compact"
              max={4}
              showEmpty={false}
            />
          </div>
        </div>
      )}

      {/* Positieve factoren */}
      {positief.length > 0 && (
        <ul className="space-y-1">
          {positief.slice(0, compact ? 3 : 12).map((f, i) => (
            <FactorRij key={`p-${i}`} factor={f} />
          ))}
        </ul>
      )}

      {/* Ontbrekende data */}
      {!compact && ontbrekend.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
            Ontbrekende data
          </p>
          <ul className="space-y-1">
            {ontbrekend.slice(0, 6).map((f, i) => (
              <FactorRij key={`o-${i}`} factor={f} />
            ))}
          </ul>
        </div>
      )}

      {/* Mismatches */}
      {mismatch.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
            Mismatch
          </p>
          <ul className="space-y-1">
            {mismatch.slice(0, 6).map((f, i) => (
              <FactorRij key={`m-${i}`} factor={f} />
            ))}
          </ul>
        </div>
      )}

      {/* Legacy fallback melding */}
      {match.gebruikteFallback && (
        <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground italic">
          <Info className="h-3 w-3 mt-0.5 shrink-0" />
          <span>Score is deels gebaseerd op de oude classificatie omdat de nieuwe taxonomie nog niet volledig is ingevuld.</span>
        </p>
      )}
    </div>
  );
}
