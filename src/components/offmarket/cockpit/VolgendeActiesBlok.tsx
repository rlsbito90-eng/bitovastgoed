// Rechter-cockpitblok "Volgende acties" — toont tot 3 open opvolgingen
// voor het signaal. Bij meer dan 3: "+ N meer opvolgingen" met
// callback naar de tab "Taken & tijdlijn".
//
// Per taak (waar mogelijk) wordt de bijbehorende briefmetadata getoond:
// campagne-stap (Brief 1/2/3) en geadresseerde-naam. Koppeling loopt via
// `gekoppelde_taak_id` op `off_market_brieven`. Voor oude taken zonder
// koppeling: graceful fallback naar alleen titel + datum.
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { formatDeadlineNL } from '@/lib/offMarket/volgendeActie';
import {
  CAMPAGNE_STAP_LABEL, type CampagneStap,
} from '@/lib/offMarket/brieven/groepering';
import type { Taak } from '@/data/mock-data';
import type { OffMarketBrief } from '@/hooks/useOffMarketBrieven';

const OPEN_STATUSSEN = new Set(['open', 'in_uitvoering', 'wacht_op_reactie']);
const MAX_ZICHTBAAR = 3;

export interface BriefMeta {
  geadresseerde: string | null;
  stap: CampagneStap | null;
}

/**
 * Vind de briefmetadata die bij een taak hoort via `gekoppelde_taak_id`.
 * Retourneert `null` wanneer er geen koppeling is.
 */
export function briefMetaVoorTaak(
  taakId: string,
  brieven: OffMarketBrief[],
): BriefMeta | null {
  const brief = brieven.find((b) => b.gekoppelde_taak_id === taakId);
  if (!brief) return null;
  const naam = brief.eigenaar_bedrijfsnaam || brief.eigenaar_naam || null;
  return {
    geadresseerde: naam,
    stap: (brief.campagne_stap ?? null) as CampagneStap | null,
  };
}

interface Props {
  signaalId: string;
  taken: Taak[];
  brieven: OffMarketBrief[];
  /** Callback om naar de "Taken & tijdlijn"-tab te navigeren. */
  onAllesBekijken?: () => void;
}

export default function VolgendeActiesBlok({
  signaalId, taken, brieven, onAllesBekijken,
}: Props) {
  const open = taken
    .filter((t) => t.offMarketSignaalId === signaalId)
    .filter((t) => OPEN_STATUSSEN.has(t.status))
    .filter((t) => !(t as any).softDeletedAt)
    .sort((a, b) => (a.deadline || '9999').localeCompare(b.deadline || '9999'));

  const zichtbaar = open.slice(0, MAX_ZICHTBAAR);
  const meer = Math.max(0, open.length - zichtbaar.length);
  const meervoud = open.length > 1;

  return (
    <div className="section-card glass-card p-4 space-y-2.5" data-testid="volgende-acties-blok">
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
          {meervoud ? 'Volgende acties' : 'Volgende actie'}
        </h3>
        {open.length > 0 && (
          <span className="text-[10px] uppercase tracking-wider text-accent">
            {open.length} open
          </span>
        )}
      </div>

      {open.length === 0 ? (
        <p className="text-xs text-muted-foreground">Geen open taak gepland.</p>
      ) : (
        <ul className="space-y-2" data-testid="volgende-acties-lijst">
          {zichtbaar.map((t) => {
            const meta = briefMetaVoorTaak(t.id, brieven);
            return (
              <li
                key={t.id}
                data-testid="volgende-actie-item"
                className="rounded-md border border-border/60 bg-card/60 hover:bg-card transition-colors"
              >
                <Link
                  to={`/taken/${t.id}`}
                  className="block px-2.5 py-2 space-y-1"
                >
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {meta?.stap && (
                      <span className="inline-flex items-center rounded-full bg-accent/15 text-accent border border-accent/30 px-1.5 py-0.5 text-[10px] font-medium">
                        {CAMPAGNE_STAP_LABEL[meta.stap]}
                      </span>
                    )}
                    {meta?.geadresseerde && (
                      <span className="text-[11px] text-muted-foreground truncate max-w-[180px]">
                        {meta.geadresseerde}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-medium text-foreground leading-tight line-clamp-2">
                    {t.titel}
                  </p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {formatDeadlineNL(t.deadline || null)}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {meer > 0 && (
        <button
          type="button"
          onClick={onAllesBekijken}
          data-testid="volgende-acties-meer"
          className="w-full text-xs text-accent hover:underline text-left px-1 pt-1"
        >
          + {meer} meer {meer === 1 ? 'opvolging' : 'opvolgingen'}
        </button>
      )}

      {open.length === 1 && (
        <Button asChild size="sm" className="w-full mt-1">
          <Link to={`/taken/${open[0].id}`}>Open taak</Link>
        </Button>
      )}
    </div>
  );
}
