// Fase 1 — Hoofdwerkbakken (Actie/Wachten/Afgehandeld/Alles) met
// een tweede, taakgerichte proceslaag die alleen zichtbaar is binnen Actie.
import type { ActieSubfilter, WerkbakView } from '@/lib/offMarket/acquisitie/werkbak';
import { ACTIE_SUBFILTER_LABEL, WERKBAK_LABEL } from '@/lib/offMarket/acquisitie/werkbak';

const HOOFD_VOLGORDE: WerkbakView[] = ['actie', 'wachten', 'afgehandeld', 'alles'];
const SUB_VOLGORDE: ActieSubfilter[] = [
  'alle', 'onderzoeken', 'brief_voorbereiden', 'printen_posten', 'opvolgen',
];

export interface AcquisitieWerkbakChipsProps {
  werkbak: WerkbakView;
  subfilter: ActieSubfilter;
  onWerkbakChange: (v: WerkbakView) => void;
  onSubfilterChange: (v: ActieSubfilter) => void;
  counts: {
    werkbak: Record<WerkbakView, number>;
    subfilter: Record<ActieSubfilter, number>;
  };
}

export default function AcquisitieWerkbakChips({
  werkbak, subfilter, onWerkbakChange, onSubfilterChange, counts,
}: AcquisitieWerkbakChipsProps) {
  return (
    <div className="flex min-w-0 flex-col gap-2.5" data-testid="acquisitie-werkbak-chips">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Werkbak
        </span>
        <div
          role="tablist"
          aria-label="Werkbak"
          data-testid="acquisitie-werkbak-hoofd"
          className="flex flex-wrap gap-1.5"
        >
          {HOOFD_VOLGORDE.map(id => {
            const actief = werkbak === id;
            const aantal = counts.werkbak[id] ?? 0;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={actief}
                data-testid={`acquisitie-werkbak-${id}`}
                onClick={() => onWerkbakChange(id)}
                className={`inline-flex min-h-8 items-center gap-1.5 rounded-md border px-3 py-1 text-xs font-medium transition-colors ${
                  actief
                    ? 'border-accent bg-accent/10 text-accent shadow-sm'
                    : 'border-border bg-card text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                }`}
              >
                <span>{WERKBAK_LABEL[id]}</span>
                <span
                  className={`rounded px-1.5 py-0.5 font-mono-data text-[10px] leading-none ${
                    actief ? 'bg-accent/15 text-accent' : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {aantal}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {werkbak === 'actie' && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Actiestap
          </span>
          <div
            role="tablist"
            aria-label="Actiestap"
            data-testid="acquisitie-werkbak-sub"
            className="flex flex-wrap gap-1.5"
          >
            {SUB_VOLGORDE.map(id => {
              const actief = subfilter === id;
              const aantal = counts.subfilter[id] ?? 0;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={actief}
                  data-testid={`acquisitie-subfilter-${id}`}
                  onClick={() => onSubfilterChange(id)}
                  className={`inline-flex min-h-7 items-center gap-1 rounded-md border px-2.5 py-0.5 text-[11px] transition-colors ${
                    actief
                      ? 'border-foreground/40 bg-foreground/5 font-medium text-foreground'
                      : 'border-border/60 bg-card text-muted-foreground hover:bg-muted/40 hover:text-foreground'
                  }`}
                >
                  <span>{ACTIE_SUBFILTER_LABEL[id]}</span>
                  <span className="font-mono-data text-[10px] opacity-80">{aantal}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
