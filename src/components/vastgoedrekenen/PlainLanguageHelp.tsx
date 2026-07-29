import { useEffect, useId, useState, type ReactNode } from 'react';
import { BookOpen, ChevronDown, ChevronRight } from 'lucide-react';
import type { ViewMode } from '@/lib/vastgoedrekenen/types';

const VIEW_MODE_STORAGE_KEY = 'vr.viewMode';

type Props = {
  title?: string;
  what: ReactNode;
  why?: ReactNode;
  action?: ReactNode;
  example?: ReactNode;
  warning?: ReactNode;
  viewMode?: ViewMode;
  className?: string;
};

function readStoredViewMode(): ViewMode {
  if (typeof window === 'undefined') return 'begeleid';
  const stored = window.localStorage.getItem(VIEW_MODE_STORAGE_KEY);
  return stored === 'compact' || stored === 'expert' || stored === 'begeleid'
    ? stored
    : 'begeleid';
}

function HelpPart({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-foreground/70">{label}</p>
      <div className="text-xs leading-relaxed text-muted-foreground">{children}</div>
    </div>
  );
}

/**
 * Herbruikbare uitleg bij moeilijke onderdelen van Vastgoedrekenen.
 *
 * - Begeleid: standaard open.
 * - Compact: standaard dicht, maar zichtbaar als inklapbare uitleg.
 * - Expert: rustig weergegeven en standaard dicht; uitleg blijft altijd bereikbaar.
 *
 * De teksten moeten in gewone taal zijn en vakbegrippen direct vertalen.
 */
export default function PlainLanguageHelp({
  title = 'Uitleg in gewone taal',
  what,
  why,
  action,
  example,
  warning,
  viewMode,
  className,
}: Props) {
  const effectiveMode = viewMode ?? readStoredViewMode();
  const [open, setOpen] = useState(effectiveMode === 'begeleid');
  const contentId = useId();

  useEffect(() => {
    setOpen(effectiveMode === 'begeleid');
  }, [effectiveMode]);

  const subdued = effectiveMode === 'expert';

  return (
    <section
      className={`rounded-md border ${
        subdued ? 'bg-muted/10' : 'border-blue-500/25 bg-blue-500/5'
      } ${className ?? ''}`}
      aria-label={title}
    >
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left"
        aria-expanded={open}
        aria-controls={contentId}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="flex min-w-0 items-center gap-2">
          <BookOpen className="h-4 w-4 shrink-0 text-blue-700 dark:text-blue-300" />
          <span className="text-xs font-semibold text-foreground">{title}</span>
          {effectiveMode === 'begeleid' && (
            <span className="hidden rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] text-blue-800 sm:inline dark:text-blue-200">
              standaard zichtbaar
            </span>
          )}
        </span>
        {open
          ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
      </button>

      {open && (
        <div id={contentId} className="border-t px-3 py-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <HelpPart label="Wat betekent dit?">{what}</HelpPart>
            {why && <HelpPart label="Waarom is dit belangrijk?">{why}</HelpPart>}
            {action && <HelpPart label="Wat moet je hier doen?">{action}</HelpPart>}
            {example && <HelpPart label="Voorbeeld">{example}</HelpPart>}
          </div>
          {warning && (
            <div className="mt-3 rounded-md border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-xs leading-relaxed text-amber-900 dark:text-amber-200">
              <span className="font-semibold">Let op: </span>{warning}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
