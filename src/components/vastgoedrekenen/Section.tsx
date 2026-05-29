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
  open: openProp,
  onOpenChange,
  hidden,
  children,
  tone,
  id,
  source,
  relevance,
  numberLabel,
}: {
  title: string;
  status?: ReactNode;
  defaultOpen?: boolean;
  /** Controlled open-state (optioneel). Wanneer gezet wordt interne state genegeerd. */
  open?: boolean;
  onOpenChange?: (next: boolean) => void;
  hidden?: boolean;
  children: ReactNode;
  tone?: 'default' | 'primary';
  id?: string;
  /** Bronlabel zoals "Componenten", "Componentstrategie", "Scenario-level verkoop". */
  source?: string;
  /** Rol van de sectie binnen het huidige scenario. */
  relevance?: SectionRelevance;
}) {
  const [innerOpen, setInnerOpen] = useState(!!defaultOpen);
  const isControlled = openProp !== undefined;
  const open = isControlled ? !!openProp : innerOpen;
  const toggle = () => {
    if (isControlled) onOpenChange?.(!open);
    else { setInnerOpen((v) => !v); onOpenChange?.(!open); }
  };
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
        onClick={toggle}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-left min-w-0"
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <ChevronRight
            className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-90' : ''}`}
          />
          <span className="font-medium text-sm break-words min-w-0">{title}</span>
          {relevance && (
            <span
              className={`hidden sm:inline-flex items-center gap-1 shrink-0 px-1.5 py-0.5 rounded-full border text-[10px] uppercase tracking-wide ${RELEVANCE_CLS[relevance]}`}
            >
              {relevance === 'aandacht' && <AlertTriangle className="h-3 w-3" />}
              {RELEVANCE_LABEL[relevance]}
            </span>
          )}
          {source && (
            <span className="hidden md:inline text-[10px] text-muted-foreground break-words">
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
  const stepLabel = step != null
    ? (typeof step === 'number' ? String(step).padStart(2, '0') : step)
    : null;
  return (
    <div className="pt-8 pb-2 first:pt-2">
      <div className="flex items-baseline gap-3 border-b border-primary/30">
        {stepLabel && (
          <span className="text-[11px] uppercase tracking-[0.18em] text-primary/80 font-mono-data font-semibold">
            {stepLabel}
          </span>
        )}
        <h3 className="text-sm sm:text-[15px] font-semibold uppercase tracking-[0.08em] text-foreground pb-1.5 flex-1 min-w-0">
          {title}
        </h3>
        {/* dunne gouden accent-streep onder de divider */}
      </div>
      <div className="h-[2px] w-12 bg-accent/70 -mt-px" aria-hidden />
      {hint && <p className="mt-2 text-xs text-muted-foreground break-words">{hint}</p>}
    </div>
  );
}


