import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BellRing, CalendarPlus, ChevronDown, ChevronRight, PauseCircle } from 'lucide-react';
import type { AandachtBod, AandachtItem, AandachtOverzicht, AandachtSignaal } from '@/lib/dashboard/aandacht';
import { formatCurrency } from '@/data/mock-data';

export const AANDACHT_MAX_ZICHTBAAR = 5;

interface Props {
  overzicht: AandachtOverzicht;
  /** Opent het plannen van een opvolging (plandatum) voor dit object, vooraf ingevuld met de vervolgstap. */
  onPlanOpvolging?: (item: AandachtItem) => void;
  /** Laadstatus van de biedingen; zonder biedingen is het overzicht nog niet betrouwbaar. */
  status?: 'laden' | 'fout' | 'klaar';
}

const SIGNAAL_KLEUR: Record<AandachtSignaal, string> = {
  open_bieding: 'text-accent',
  geen_activiteit: 'text-warning',
  geen_kandidaat: 'text-muted-foreground',
  on_hold: 'text-muted-foreground',
};

/** Vervolgstap zonder de toevoeging "(gepland …)", "(achterstallig …)" of "(deadline verstreken …)", met hoofdletter. */
export function taakTitelVoor(item: AandachtItem): string {
  const kaal = item.volgendeActie.replace(/ \((gepland|achterstallig|deadline verstreken)[^)]*\)$/, '');
  return kaal.charAt(0).toUpperCase() + kaal.slice(1);
}

const korteDatum = (sleutel: string) => {
  const [y, m, d] = sleutel.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
};

/** Bekende gegevens van het bod op één regel; onbekende velden worden weggelaten. */
export function bodRegel(bod: AandachtBod): string | null {
  const delen: string[] = [];
  if (bod.bedrag != null) delen.push(formatCurrency(bod.bedrag));
  if (bod.partij) delen.push(bod.partij);
  if (bod.bieddatum) delen.push(`bod ${korteDatum(bod.bieddatum)}`);
  if (bod.geldigTot) delen.push(`geldig tot ${korteDatum(bod.geldigTot)}`);
  return delen.length > 0 ? delen.join(' · ') : null;
}

function Regel({ item, onPlanOpvolging }: { item: AandachtItem; onPlanOpvolging?: Props['onPlanOpvolging'] }) {
  const [extraOpen, setExtraOpen] = useState(false);
  const bod = item.bod ? bodRegel(item.bod) : null;
  return (
    <div data-testid="aandacht-regel" className="flex items-start gap-3 px-4 sm:px-5 py-3">
      <div className="min-w-0 flex-1">
        <Link to={`/objecten/${item.objectId}`} className="block text-sm font-medium text-foreground truncate hover:underline">{item.titel}</Link>
        <p className={`text-xs font-semibold mt-0.5 ${SIGNAAL_KLEUR[item.signaal]}`}>
          <span>{item.label}</span>
          {item.extraSignalen > 0 && (
            <button
              type="button"
              onClick={() => setExtraOpen(v => !v)}
              aria-expanded={extraOpen}
              aria-label={`${item.extraSignalen} ${item.extraSignalen === 1 ? 'ander signaal' : 'andere signalen'}: ${item.overigeSignalen.join(', ')}`}
              title={`Ook: ${item.overigeSignalen.join(', ')}`}
              className="group/extra ml-0.5 -my-3 inline-flex items-center justify-center align-middle min-w-[32px] px-1 bg-transparent"
            >
              {/* Ruim tikvlak (mobiel), compact label. */}
              <span className="rounded-full bg-muted px-1.5 py-px text-[10px] font-semibold leading-4 text-muted-foreground group-hover/extra:bg-muted/70">{`+${item.extraSignalen}`}</span>
            </button>
          )}
        </p>
        {extraOpen && item.extraSignalen > 0 && (
          <p data-testid="aandacht-extra" className="text-xs text-muted-foreground mt-0.5">{`Ook: ${item.overigeSignalen.join(', ')}`}</p>
        )}
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.toelichting}</p>
        {bod && <p data-testid="aandacht-bod" className="text-xs text-foreground mt-0.5 tabular-nums break-words">{bod}</p>}
        <p className="text-xs text-foreground mt-1">
          <span className="text-muted-foreground">Volgende actie: </span>
          <span>{item.volgendeActie}</span>
        </p>
      </div>
      {onPlanOpvolging && (
        <button
          type="button"
          onClick={() => onPlanOpvolging(item)}
          className="shrink-0 inline-flex items-center gap-1 rounded-md border border-border px-2 py-1.5 text-xs font-medium text-foreground hover:bg-muted min-h-[32px]"
          aria-label={`Opvolging plannen voor ${item.titel}`}
        >
          <CalendarPlus className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Plannen</span>
        </button>
      )}
    </div>
  );
}

/**
 * Aandacht nodig: per object één regel met het belangrijkste signaal en een concrete vervolgstap.
 * Objecten die on hold staan, staan apart en ingeklapt.
 */
export default function DashboardAandacht({ overzicht, onPlanOpvolging, status = 'klaar' }: Props) {
  const [alles, setAlles] = useState(false);
  const [onHoldOpen, setOnHoldOpen] = useState(false);
  const { items, onHold } = overzicht;
  const zichtbaar = alles ? items : items.slice(0, AANDACHT_MAX_ZICHTBAAR);

  return (
    <section data-testid="dashboard-aandacht" className="section-card overflow-hidden">
      <header className="section-header">
        <div className="min-w-0">
          <h2 className="section-title flex items-center gap-2"><BellRing className="h-4 w-4 text-accent" />Aandacht nodig</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {status === 'laden'
              ? 'Biedingen laden…'
              : items.length === 0 ? 'Geen objecten die nu aandacht vragen' : `${items.length} ${items.length === 1 ? 'object' : 'objecten'}`}
          </p>
        </div>
        <Link to="/objecten" className="section-link inline-flex items-center gap-1">Objecten <ChevronRight className="h-3 w-3" /></Link>
      </header>

      {status === 'fout' && (
        <p data-testid="aandacht-fout" className="px-4 sm:px-5 py-2 text-xs text-destructive border-b border-border/60">
          Biedingen konden niet worden geladen; open biedingen ontbreken in dit overzicht.
        </p>
      )}

      {status !== 'laden' && items.length > 0 && (
        <div className="divide-y divide-border/60">
          {zichtbaar.map(item => <Regel key={item.objectId} item={item} onPlanOpvolging={onPlanOpvolging} />)}
        </div>
      )}
      {status !== 'laden' && items.length > AANDACHT_MAX_ZICHTBAAR && (
        <button
          type="button"
          onClick={() => setAlles(v => !v)}
          className="block w-full text-left px-4 sm:px-5 py-2.5 text-xs font-medium text-accent hover:underline border-t border-border/60"
        >
          {alles ? 'Toon minder' : `Toon alle (${items.length})`}
        </button>
      )}

      {status !== 'laden' && onHold.length > 0 && (
        <div className="border-t border-border/60">
          <button
            type="button"
            onClick={() => setOnHoldOpen(v => !v)}
            aria-expanded={onHoldOpen}
            className="flex w-full items-center justify-between gap-2 px-4 sm:px-5 py-2.5 text-xs font-semibold text-muted-foreground hover:bg-muted/50"
          >
            <span className="inline-flex items-center gap-1.5"><PauseCircle className="h-3.5 w-3.5" />{`On hold (${onHold.length})`}</span>
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${onHoldOpen ? 'rotate-180' : ''}`} />
          </button>
          {onHoldOpen && (
            <div data-testid="aandacht-on-hold" className="divide-y divide-border/60">
              {onHold.map(item => <Regel key={item.objectId} item={item} onPlanOpvolging={onPlanOpvolging} />)}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
