// Linker workflow-rail voor Vastgoedrekenen (sub-fase 4B).
// Toont 9 vaste sectie-items met statuschip, telling en voortgangsbalk.
// Klik scrollt smooth naar de bijbehorende Section (via id).
// Op <lg toont de rail zich als compacte accordion bovenaan.

import { useState } from 'react';
import { ChevronDown, AlertTriangle, AlertOctagon, CheckCircle2, MinusCircle } from 'lucide-react';

export type RailStatus = 'ok' | 'aandacht' | 'blocker' | 'niet_relevant';

export type RailItem = {
  id: string;
  step: number;
  title: string;
  status: RailStatus;
  /** Optionele teller (bijv. units, warnings). */
  count?: number | null;
  /** Korte 1-regelige statushint. */
  hint?: string;
};

const STATUS_CFG: Record<RailStatus, { label: string; icon: typeof CheckCircle2; dot: string; chip: string }> = {
  ok: {
    label: 'OK',
    icon: CheckCircle2,
    dot: 'bg-emerald-500',
    chip: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  },
  aandacht: {
    label: 'Aandacht',
    icon: AlertTriangle,
    dot: 'bg-amber-500',
    chip: 'bg-amber-500/15 text-amber-800 dark:text-amber-200 border-amber-500/40',
  },
  blocker: {
    label: 'Blocker',
    icon: AlertOctagon,
    dot: 'bg-destructive',
    chip: 'bg-destructive/15 text-destructive border-destructive/40',
  },
  niet_relevant: {
    label: 'N.v.t.',
    icon: MinusCircle,
    dot: 'bg-muted-foreground/40',
    chip: 'bg-muted text-muted-foreground border-border',
  },
};

function scrollToId(id: string) {
  if (typeof window === 'undefined') return;
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  // Highlight tijdelijk zodat duidelijk is welke sectie aangesproken werd.
  el.classList.add('ring-2', 'ring-primary/40', 'ring-offset-2', 'ring-offset-background');
  window.setTimeout(() => {
    el.classList.remove('ring-2', 'ring-primary/40', 'ring-offset-2', 'ring-offset-background');
  }, 1400);
}

export function SectionRail({ items }: { items: RailItem[] }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const relevant = items.filter((i) => i.status !== 'niet_relevant');
  const okCount = relevant.filter((i) => i.status === 'ok').length;
  const blockerCount = items.filter((i) => i.status === 'blocker').length;
  const warnCount = items.filter((i) => i.status === 'aandacht').length;
  const pct = relevant.length > 0 ? Math.round((okCount / relevant.length) * 100) : 0;

  return (
    <>
      {/* Mobile / tablet: compacte accordion-header */}
      <div className="lg:hidden rounded-lg border bg-card overflow-hidden">
        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/30"
        >
          <div className="flex-1 min-w-0 text-left">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Werkstroom</p>
            <p className="text-xs text-foreground mt-0.5">
              {okCount}/{relevant.length} compleet
              {blockerCount > 0 && <span className="text-destructive"> · {blockerCount} blocker</span>}
              {warnCount > 0 && <span className="text-amber-600 dark:text-amber-300"> · {warnCount} aandacht</span>}
            </p>
          </div>
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${mobileOpen ? 'rotate-180' : ''}`} />
        </button>
        {mobileOpen && (
          <div className="border-t px-2 py-2 grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            {items.map((it) => (
              <RailButton key={it.id} item={it} compact />
            ))}
          </div>
        )}
      </div>

      {/* Desktop: sticky linker rail */}
      <aside className="hidden lg:block">
        <div className="sticky top-[88px] max-h-[calc(100vh-104px)] overflow-y-auto space-y-2 pr-1">
          <div className="rounded-lg border bg-card overflow-hidden">
            <div className="px-3 py-2.5 border-b bg-muted/30">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Werkstroom</p>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-sm font-semibold font-mono-data tabular-nums">{okCount}</span>
                <span className="text-[11px] text-muted-foreground">/ {relevant.length} compleet</span>
              </div>
              <div className="mt-1.5 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${pct}%` }}
                  aria-label={`${pct}% compleet`}
                />
              </div>
              {(blockerCount > 0 || warnCount > 0) && (
                <p className="mt-1.5 text-[10px] text-muted-foreground">
                  {blockerCount > 0 && <span className="text-destructive">{blockerCount} blocker · </span>}
                  {warnCount > 0 && <span className="text-amber-600 dark:text-amber-300">{warnCount} aandacht</span>}
                </p>
              )}
            </div>
            <ol className="py-1">
              {items.map((it) => (
                <li key={it.id}>
                  <RailButton item={it} />
                </li>
              ))}
            </ol>
          </div>
        </div>
      </aside>
    </>
  );
}

function RailButton({ item, compact }: { item: RailItem; compact?: boolean }) {
  const cfg = STATUS_CFG[item.status];
  const Icon = cfg.icon;
  if (compact) {
    return (
      <button
        type="button"
        onClick={() => scrollToId(item.id)}
        className="flex items-center gap-1.5 rounded-md border bg-card hover:bg-muted/40 px-2 py-1.5 text-left min-w-0"
        title={item.hint ?? item.title}
      >
        <span className={`h-2 w-2 rounded-full shrink-0 ${cfg.dot}`} aria-hidden />
        <span className="text-[11px] font-medium truncate">{item.title}</span>
        {item.count != null && item.count > 0 && (
          <span className="ml-auto text-[10px] tabular-nums text-muted-foreground">{item.count}</span>
        )}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={() => scrollToId(item.id)}
      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/40 text-left group min-w-0"
    >
      <span className="text-[10px] font-mono-data tabular-nums text-muted-foreground w-5 shrink-0">
        {String(item.step).padStart(2, '0')}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-xs font-medium truncate group-hover:text-foreground">{item.title}</span>
        {item.hint && (
          <span className="block text-[10px] text-muted-foreground truncate">{item.hint}</span>
        )}
      </span>
      {item.count != null && item.count > 0 && (
        <span className="text-[10px] tabular-nums text-muted-foreground shrink-0">{item.count}</span>
      )}
      <span
        className={`inline-flex items-center gap-1 shrink-0 px-1.5 py-0.5 rounded-full border text-[9px] uppercase tracking-wide ${cfg.chip}`}
        aria-label={cfg.label}
      >
        <Icon className="h-2.5 w-2.5" />
      </span>
    </button>
  );
}
