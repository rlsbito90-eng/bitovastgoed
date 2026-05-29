import { useState, type ReactNode } from 'react';
import { ChevronRight, AlertTriangle } from 'lucide-react';

export type SectionRelevance = 'leidend' | 'informatief' | 'niet_relevant' | 'aandacht';

const RELEVANCE_LABEL: Record<SectionRelevance, string> = {
  leidend: 'Leidend',
  informatief: 'Informatief',
  niet_relevant: 'Niet relevant',
  aandacht: 'Aandacht',
};

const RELEVANCE_CLS: Record<SectionRelevance, string> = {
  leidend: 'bg-primary/15 text-primary border-primary/30',
  informatief: 'bg-muted text-muted-foreground border-border',
  niet_relevant: 'bg-muted/50 text-muted-foreground/70 border-border',
  aandacht: 'bg-amber-500/15 text-amber-800 dark:text-amber-200 border-amber-500/40',
};

/**
 * Lichte, inklapbare sectie voor de Vastgoedrekenen-module.
 * Gebruikt React-state (geen native <details>) zodat user-toggle blijft bewaard
 * ook al herberekent defaultOpen.
 */
export function Section({
  title,
  status,
  defaultOpen,
  hidden,
  children,
  tone,
  id,
  source,
  relevance,
}: {
  title: string;
  status?: ReactNode;
  defaultOpen?: boolean;
  hidden?: boolean;
  children: ReactNode;
  tone?: 'default' | 'primary';
  id?: string;
  /** Bronlabel zoals "Componenten", "Componentstrategie", "Scenario-level verkoop". */
  source?: string;
  /** Rol van de sectie binnen het huidige scenario. */
  relevance?: SectionRelevance;
}) {
  const [open, setOpen] = useState(!!defaultOpen);
  if (hidden) return null;
  const borderCls =
    relevance === 'aandacht'
      ? 'border-amber-500/50'
      : tone === 'primary' || relevance === 'leidend'
      ? 'border-primary/40'
      : '';
  return (
    <div id={id} className={`rounded-lg border bg-card overflow-hidden ${borderCls}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-left min-w-0"
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <ChevronRight
            className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-90' : ''}`}
          />
          <span className="font-medium text-sm truncate">{title}</span>
          {relevance && (
            <span
              className={`hidden sm:inline-flex items-center gap-1 shrink-0 px-1.5 py-0.5 rounded-full border text-[10px] uppercase tracking-wide ${RELEVANCE_CLS[relevance]}`}
            >
              {relevance === 'aandacht' && <AlertTriangle className="h-3 w-3" />}
              {RELEVANCE_LABEL[relevance]}
            </span>
          )}
          {source && (
            <span className="hidden md:inline text-[10px] text-muted-foreground shrink-0 truncate">
              Bron: {source}
            </span>
          )}
        </div>
        {status && (
          <span className="text-xs text-muted-foreground text-right shrink-0 max-w-[55%] sm:max-w-[60%] leading-snug whitespace-normal break-words">
            {status}
          </span>
        )}
      </button>
      {open && <div className="px-4 pb-4 pt-1 border-t bg-card">{children}</div>}
    </div>
  );
}

/**
 * Visuele groep-heading boven een reeks Sections. Geen wrapper — render
 * direct als sibling tussen Sections, zodat IIFE-blokken niet hoeven te
 * worden herstructureerd.
 */
export function SectionGroup({
  step,
  title,
  hint,
}: {
  step?: number | string;
  title: string;
  hint?: string;
}) {
  return (
    <div className="flex items-baseline gap-2 px-1 pt-3 pb-1 border-b border-border/40">
      {step != null && (
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono-data">
          {typeof step === 'number' ? String(step).padStart(2, '0') : step}
        </span>
      )}
      <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground/80">{title}</h3>
      {hint && <span className="text-[11px] text-muted-foreground truncate">— {hint}</span>}
    </div>
  );
}

