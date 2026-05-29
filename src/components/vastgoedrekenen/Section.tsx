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
  /** Subnummer (bv. "03.2") subtiel getoond vóór de titel. */
  numberLabel?: string;
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
      : 'border-border/70';
  return (
    <div
      id={id}
      className={`group/section relative rounded-xl border bg-card/95 overflow-hidden transition-all duration-200 ${borderCls} ${open ? 'shadow-[0_2px_10px_-6px_hsl(var(--shadow-color)/0.18),inset_3px_0_0_0_hsl(var(--accent)/0.65)]' : 'hover:border-border'}`}
    >
      <button
        type="button"
        onClick={toggle}
        className={`w-full flex items-center justify-between gap-3 px-4 py-3 transition-colors text-left min-w-0 ${open ? 'bg-accent/[0.04]' : 'hover:bg-muted/40'}`}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <ChevronRight
            className={`h-4 w-4 shrink-0 text-muted-foreground/70 transition-transform duration-200 ${open ? 'rotate-90 text-accent' : ''}`}
          />
          {numberLabel && (
            <span className="shrink-0 text-[10px] font-mono-data tabular-nums text-muted-foreground/80 bg-muted/40 border border-border/60 rounded px-1.5 py-0.5 leading-none">
              {numberLabel}
            </span>
          )}
          <span className="font-semibold text-[13.5px] text-foreground break-words min-w-0 tracking-[-0.005em]">{title}</span>
          {relevance && (
            <span
              className={`hidden sm:inline-flex items-center gap-1 shrink-0 px-1.5 py-0.5 rounded-full border text-[10px] uppercase tracking-wide font-medium ${RELEVANCE_CLS[relevance]}`}
            >
              {relevance === 'aandacht' && <AlertTriangle className="h-3 w-3" />}
              {RELEVANCE_LABEL[relevance]}
            </span>
          )}
          {source && (
            <span className="hidden md:inline text-[10px] text-muted-foreground/70 break-words">
              · {source}
            </span>
          )}
        </div>
        {status && (
          <span className="text-[11.5px] text-muted-foreground text-right shrink-0 max-w-[55%] sm:max-w-[60%] leading-snug whitespace-normal break-words tabular-nums">
            {status}
          </span>
        )}
      </button>
      {open && <div className="px-4 pb-4 pt-2 border-t border-border/50 bg-card">{children}</div>}
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
    <section className="pt-10 pb-3 first:pt-3" aria-label={title}>
      <div className="flex items-center gap-3 min-w-0">
        {stepLabel && (
          <span className="text-[11px] uppercase tracking-[0.22em] text-primary font-mono-data font-semibold tabular-nums">
            {stepLabel}
          </span>
        )}
        {stepLabel && <span className="text-primary/40 select-none" aria-hidden>—</span>}
        <h3 className="text-[13px] sm:text-[14px] font-semibold uppercase tracking-[0.14em] text-primary min-w-0 truncate">
          {title}
        </h3>
        <span className="flex-1 h-px bg-gradient-to-r from-accent/60 via-accent/25 to-transparent ml-2" aria-hidden />
      </div>
      {hint && (
        <p className="mt-2 ml-[2px] text-[12px] leading-relaxed text-muted-foreground/90 break-words max-w-[68ch]">
          {hint}
        </p>
      )}
    </section>
  );
}



