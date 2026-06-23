// V1B — Filter-chips voor de acquisitieselectie-lijst.
import type { SelectieFilter } from '@/lib/offMarket/acquisitie/readiness';

interface ChipDef { id: SelectieFilter; label: string; }

const CHIPS: ChipDef[] = [
  { id: 'alles', label: 'Alles' },
  { id: 'geblokkeerd', label: 'Geblokkeerd' },
  { id: 'brief_voorbereiden', label: 'Brief voorbereiden' },
  { id: 'printklaar', label: 'Printklaar' },
  { id: 'opvolging', label: 'Opvolging' },
];

export default function AcquisitieFilterChips({
  value, onChange, counts,
}: {
  value: SelectieFilter;
  onChange: (v: SelectieFilter) => void;
  counts?: Partial<Record<SelectieFilter, number>>;
}) {
  return (
    <div
      role="tablist"
      aria-label="Filter acquisitieselectie"
      data-testid="acquisitie-filter-chips"
      className="flex flex-wrap gap-1.5"
    >
      {CHIPS.map(c => {
        const actief = value === c.id;
        const aantal = counts?.[c.id];
        return (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={actief}
            data-testid={`acquisitie-filter-${c.id}`}
            onClick={() => onChange(c.id)}
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors ${
              actief
                ? 'border-accent bg-accent/10 text-accent'
                : 'border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            <span>{c.label}</span>
            {typeof aantal === 'number' && (
              <span className="font-mono-data text-[10px] opacity-80">{aantal}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
