// Linker workflow-rail voor Vastgoedrekenen.
// Toont alleen relevante werkstappen prominent; niet-relevante onderdelen staan apart.

import { useMemo, useState } from 'react';
import {
  ChevronDown,
  AlertTriangle,
  AlertOctagon,
  CheckCircle2,
  MinusCircle,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';

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

function splitRail(items: RailItem[]) {
  const relevant: RailItem[] = [];
  const notRelevant: RailItem[] = [];

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    if (item.level === 'sub') {
      (item.status === 'niet_relevant' ? notRelevant : relevant).push(item);
      continue;
    }

    const chapterSubs: RailItem[] = [];
    for (let cursor = index + 1; cursor < items.length && items[cursor].level === 'sub'; cursor += 1) {
      chapterSubs.push(items[cursor]);
    }
    if (chapterSubs.some((sub) => sub.status !== 'niet_relevant')) relevant.push(item);
    if (chapterSubs.some((sub) => sub.status === 'niet_relevant')) notRelevant.push(item);
  }

  return { relevant, notRelevant };
}

export function SectionRail({ items }: { items: RailItem[] }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showNotRelevant, setShowNotRelevant] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const { relevant, notRelevant } = useMemo(() => splitRail(items), [items]);
  const relevantSubs = relevant.filter((item) => item.level === 'sub');
  const notRelevantSubs = notRelevant.filter((item) => item.level === 'sub');
  const okCount = relevantSubs.filter((item) => item.status === 'ok').length;
  const blockerCount = relevantSubs.filter((item) => item.status === 'blocker').length;
  const warnCount = relevantSubs.filter((item) => item.status === 'aandacht').length;
  const pct = relevantSubs.length > 0 ? Math.round((okCount / relevantSubs.length) * 100) : 0;

  return (
    <>
      {/* Mobile / tablet: compacte accordion-header */}
      <div className="lg:hidden rounded-lg border bg-card overflow-hidden">
        <button
          type="button"
          onClick={() => setMobileOpen((value) => !value)}
          className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/30"
        >
          <div className="flex-1 min-w-0 text-left">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Werkstroom</p>
            <p className="text-xs text-foreground mt-0.5">
              {okCount}/{relevantSubs.length} compleet
              {blockerCount > 0 && <span className="text-destructive"> · {blockerCount} blocker</span>}
              {warnCount > 0 && <span className="text-amber-600 dark:text-amber-300"> · {warnCount} aandacht</span>}
            </p>
          </div>
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${mobileOpen ? 'rotate-180' : ''}`} />
        </button>
        {mobileOpen && (
          <div className="border-t px-2 py-2 space-y-2">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {relevantSubs.map((item) => <RailButton key={item.id} item={item} compact />)}
            </div>
            {notRelevantSubs.length > 0 && (
              <details className="rounded-md border bg-muted/20">
                <summary className="cursor-pointer px-2 py-1.5 text-[11px] text-muted-foreground">
                  Niet relevant ({notRelevantSubs.length})
                </summary>
                <div className="border-t p-2 grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {notRelevantSubs.map((item) => <RailButton key={item.id} item={item} compact />)}
                </div>
              </details>
            )}
          </div>
        )}
      </div>

      {/* Desktop: sticky en inklapbare linker rail */}
      <aside className={`hidden lg:block self-start sticky top-[88px] max-h-[calc(100vh-104px)] overflow-y-auto transition-[width] duration-200 ${desktopCollapsed ? 'w-12' : 'w-[220px] xl:w-[240px]'}`}>
        <div className="rounded-xl border border-border/70 bg-card/95 overflow-hidden shadow-[0_1px_2px_0_hsl(var(--shadow-color)/0.04)]">
          {desktopCollapsed ? (
            <div className="flex flex-col items-center py-2">
              <button
                type="button"
                onClick={() => setDesktopCollapsed(false)}
                className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-md border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
                title="Werkstroom uitklappen"
                aria-label="Werkstroom uitklappen"
              >
                <PanelLeftOpen className="h-4 w-4" />
              </button>
              <div className="mb-2 text-center">
                <div className="text-xs font-semibold font-mono-data">{okCount}/{relevantSubs.length}</div>
                <div className="text-[9px] text-muted-foreground">gereed</div>
              </div>
              <ol className="w-full border-t py-1">
                {relevantSubs.map((item) => {
                  const cfg = STATUS_CFG[item.status];
                  const Icon = cfg.icon;
                  return (
                    <li key={`collapsed-${item.id}`}>
                      <button
                        type="button"
                        onClick={() => scrollToId(item.id)}
                        className="mx-auto flex h-9 w-9 items-center justify-center rounded-md hover:bg-muted"
                        title={`${item.number} ${item.title}${item.hint ? ` — ${item.hint}` : ''}`}
                        aria-label={`${item.number} ${item.title}`}
                      >
                        {item.status === 'ok' ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <span className={`flex h-6 min-w-6 items-center justify-center rounded-full border px-1 text-[9px] font-semibold font-mono-data ${
                            item.status === 'blocker'
                              ? 'border-destructive/50 bg-destructive/10 text-destructive'
                              : 'border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-200'
                          }`}>
                            {item.number}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ol>
            </div>
          ) : (
            <>
              <div className="px-3.5 py-3 border-b border-border/60 bg-gradient-to-b from-muted/40 to-muted/10">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.16em] text-primary/70 font-semibold">Werkstroom</p>
                    <div className="mt-1 flex items-baseline gap-1.5">
                      <span className="text-[15px] font-semibold font-mono-data tabular-nums text-foreground">{okCount}</span>
                      <span className="text-[11px] text-muted-foreground">/ {relevantSubs.length} compleet</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDesktopCollapsed(true)}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
                    title="Werkstroom inklappen"
                    aria-label="Werkstroom inklappen"
                  >
                    <PanelLeftClose className="h-3.5 w-3.5" />
                  </button>
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
                    {blockerCount > 0 && <span className="text-destructive font-medium">{blockerCount} blocker{blockerCount === 1 ? '' : 's'}</span>}
                    {blockerCount > 0 && warnCount > 0 && ' · '}
                    {warnCount > 0 && <span className="text-amber-700 dark:text-amber-300 font-medium">{warnCount} aandacht</span>}
                  </p>
                )}
              </div>

              <ol className="py-1.5">
                {relevant.map((item) => (
                  <li key={`relevant-${item.level}-${item.id}-${item.number}`}>
                    <RailButton item={item} />
                  </li>
                ))}
              </ol>

              {notRelevantSubs.length > 0 && (
                <div className="border-t border-border/60">
                  <button
                    type="button"
                    onClick={() => setShowNotRelevant((value) => !value)}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2 text-[10px] text-muted-foreground hover:bg-muted/30"
                  >
                    <span>Niet relevant ({notRelevantSubs.length})</span>
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showNotRelevant ? 'rotate-180' : ''}`} />
                  </button>
                  {showNotRelevant && (
                    <ol className="border-t border-border/50 py-1.5 bg-muted/10">
                      {notRelevantSubs.map((item) => (
                        <li key={`not-relevant-${item.id}`}>
                          <RailButton item={item} />
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              )}
            </>
          )}
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
        {item.count != null && item.count > 0 && <span className="ml-auto text-[10px] tabular-nums text-muted-foreground">{item.count}</span>}
      </button>
    );
  }
  if (item.level === 'chapter') {
    return (
      <button
        type="button"
        onClick={() => scrollToId(item.id)}
        className="w-full flex items-center gap-2.5 px-3 pt-3 pb-1.5 text-left group min-w-0 border-t first:border-t-0 border-border/50 hover:bg-muted/30 transition-colors"
      >
        <span className="text-[10.5px] font-mono-data tabular-nums text-primary font-semibold w-6 shrink-0">{item.number}</span>
        <span className="text-primary/30 text-[10px] select-none -mx-0.5" aria-hidden>—</span>
        <span className="flex-1 min-w-0">
          <span className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-primary truncate">{item.title}</span>
        </span>
        <span className="h-px flex-1 bg-gradient-to-r from-accent/40 to-transparent max-w-[24px] shrink-0" aria-hidden />
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={() => scrollToId(item.id)}
      className="w-full flex items-center gap-2 pl-7 pr-3 py-1.5 hover:bg-accent/[0.06] hover:border-l-accent border-l-2 border-l-transparent text-left group min-w-0 transition-colors"
    >
      <span className="text-[10px] font-mono-data tabular-nums text-muted-foreground/80 w-8 shrink-0">{item.number}</span>
      <span className="flex-1 min-w-0">
        <span className="block text-[12px] font-medium text-foreground/85 truncate group-hover:text-foreground">{item.title}</span>
        {item.hint && <span className="block text-[10px] text-muted-foreground/80 truncate">{item.hint}</span>}
      </span>
      {item.count != null && item.count > 0 && <span className="text-[10px] tabular-nums text-muted-foreground/70 shrink-0">{item.count}</span>}
      <span
        className={`inline-flex items-center gap-1 shrink-0 px-1.5 py-0.5 rounded-full border text-[9px] uppercase tracking-wide ${cfg.chip}`}
        aria-label={cfg.label}
        title={cfg.label}
      >
        <Icon className="h-2.5 w-2.5" />
      </span>
    </button>
  );
}
