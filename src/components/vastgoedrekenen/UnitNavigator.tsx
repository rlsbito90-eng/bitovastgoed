// Mini-navigator: een rij chips waarmee je snel naar een specifieke unit-card scrollt.
// Geen rekenlogica — alleen UX. Werkt voor zowel WWS-, Componenten- als Componentstrategie-units.
import { AlertCircle } from 'lucide-react';

export type NavUnit = {
  id: string;
  /** Hoofdlabel (bv. "92A"). */
  label: string;
  /** Optionele meta zoals "appartement · 85 m²". */
  meta?: string;
  warning?: boolean;
};

type Props = {
  units: NavUnit[];
  anchorPrefix: string; // bv. 'wws-unit', 'componenten-unit' of 'strategy-unit'
};

export default function UnitNavigator({ units, anchorPrefix }: Props) {
  if (units.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-dashed bg-muted/20 px-2 py-1.5">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground mr-1">Spring naar:</span>
      {units.map((u, idx) => (
        <button
          key={u.id}
          type="button"
          onClick={() => {
            const el = document.getElementById(`${anchorPrefix}-${u.id}`);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }}
          title={u.meta ? `${u.label} — ${u.meta}` : u.label}
          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground ${u.warning ? 'border-amber-500/40 text-amber-700 dark:text-amber-300' : 'border-border text-foreground'}`}
        >
          <span className="tabular-nums text-muted-foreground">{String(idx + 1).padStart(2, '0')}</span>
          <span className="truncate max-w-[140px]">{u.label}</span>
          {u.meta && <span className="hidden sm:inline text-muted-foreground/80 truncate max-w-[120px]">· {u.meta}</span>}
          {u.warning && <AlertCircle className="h-3 w-3" />}
        </button>
      ))}
    </div>
  );
}
