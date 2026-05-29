// Linker workflow-rail voor Vastgoedrekenen.
// Toont hoofdstukken (level "chapter") + ingesprongen sub-onderdelen (level "sub")
// met statuschip, telling en voortgang. Klik scrollt naar de bijbehorende Section.

import { useState } from 'react';
import { ChevronDown, AlertTriangle, AlertOctagon, CheckCircle2, MinusCircle } from 'lucide-react';

export type RailStatus = 'ok' | 'aandacht' | 'blocker' | 'niet_relevant';

export type RailItem = {
  id: string;
  /** "01" voor hoofdstuk, "01.1" voor sub-sectie. */
  number: string;
  /** Visueel niveau: hoofdstuk-header of ingesprongen sub-onderdeel. */
  level: 'chapter' | 'sub';
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
  el.classList.add('ring-2', 'ring-primary/40', 'ring-offset-2', 'ring-offset-background');
  window.setTimeout(() => {
    el.classList.remove('ring-2', 'ring-primary/40', 'ring-offset-2', 'ring-offset-background');
  }, 1400);
}

export function SectionRail({ items }: { items: RailItem[] }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const subs = items.filter((i) => i.level === 'sub');
  const relevant = subs.filter((i) => i.status !== 'niet_relevant');
  const okCount = relevant.filter((i) => i.status === 'ok').length;
  const blockerCount = subs.filter((i) => i.status === 'blocker').length;
  const warnCount = subs.filter((i) => i.status === 'aandacht').length;
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
            {subs.map((it) => (
              <RailButton key={it.id} item={it} compact />
            ))}
          </div>
        )}
      </div>

      {/* Desktop: sticky linker rail */}
      <aside className="hidden lg:block self-start sticky top-[88px] max-h-[calc(100vh-104px)] overflow-y-auto pr-1">
        <div className="space-y-2">
          <div className="rounded-xl border border-border/70 bg-card/95 overflow-hidden shadow-[0_1px_2px_0_hsl(var(--shadow-color)/0.04)]">
            <div className="px-3.5 py-3 border-b border-border/60 bg-gradient-to-b from-muted/40 to-muted/10">
              <p className="text-[10px] uppercase tracking-[0.16em] text-primary/70 font-semibold">Werkstroom</p>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-[15px] font-semibold font-mono-data tabular-nums text-foreground">{okCount}</span>
                <span className="text-[11px] text-muted-foreground">/ {relevant.length} compleet</span>
              </div>
              <div className="mt-2 h-1 rounded-full bg-muted/70 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-accent/80 to-accent transition-all duration-500"
                  style={{ width: `${pct}%` }}
                  aria-label={`${pct}% compleet`}
                />
              </div>
              {(blockerCount > 0 || warnCount > 0) && (
                <p className="mt-2 text-[10px] text-muted-foreground">
                  {blockerCount > 0 && <span className="text-destructive font-medium">{blockerCount} blocker · </span>}
                  {warnCount > 0 && <span className="text-amber-700 dark:text-amber-300 font-medium">{warnCount} aandacht</span>}
                </p>
              )}
            </div>
            <ol className="py-1.5">
              {items.map((it) => (
                <li key={`${it.level}-${it.id}-${it.number}`}>
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
        <span className="text-[10px] font-mono-data tabular-nums text-muted-foreground shrink-0">{item.number}</span>
        <span className="text-[11px] font-medium truncate">{item.title}</span>
        {item.count != null && item.count > 0 && (
          <span className="ml-auto text-[10px] tabular-nums text-muted-foreground">{item.count}</span>
        )}
      </button>
    );
  }
  if (item.level === 'chapter') {
    return (
      <button
        type="button"
        onClick={() => scrollToId(item.id)}
        className="w-full flex items-baseline gap-2 px-3 pt-2.5 pb-1 text-left group min-w-0 border-t first:border-t-0 border-border/60"
      >
        <span className="text-[11px] font-mono-data tabular-nums text-primary/80 font-semibold w-6 shrink-0">
          {item.number}
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-[11px] font-semibold uppercase tracking-[0.06em] text-foreground truncate">
            {item.title}
          </span>
          {item.hint && (
            <span className="block text-[10px] text-muted-foreground truncate font-normal normal-case tracking-normal">
              {item.hint}
            </span>
          )}
        </span>
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={() => scrollToId(item.id)}
      className="w-full flex items-center gap-2 pl-6 pr-3 py-1.5 hover:bg-muted/40 text-left group min-w-0"
    >
      <span className="text-[10px] font-mono-data tabular-nums text-muted-foreground w-8 shrink-0">
        {item.number}
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
