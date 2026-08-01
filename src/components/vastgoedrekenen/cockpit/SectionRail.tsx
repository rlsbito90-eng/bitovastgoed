import { useMemo, useState } from 'react';
import { AlertOctagon, AlertTriangle, CheckCircle2, ChevronDown, MinusCircle } from 'lucide-react';

export type RailStatus = 'ok' | 'aandacht' | 'blocker' | 'niet_relevant';

export type RailItem = {
  id: string;
  number: string;
  level: 'chapter' | 'sub';
  title: string;
  status: RailStatus;
  count?: number | null;
  hint?: string;
};

const STATUS_CFG: Record<RailStatus, { label: string; icon: typeof CheckCircle2; dot: string; chip: string }> = {
  ok: {
    label: 'OK',
    icon: CheckCircle2,
    dot: 'bg-emerald-500',
    chip: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  },
  aandacht: {
    label: 'Aandacht',
    icon: AlertTriangle,
    dot: 'bg-amber-500',
    chip: 'border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200',
  },
  blocker: {
    label: 'Blocker',
    icon: AlertOctagon,
    dot: 'bg-destructive',
    chip: 'border-destructive/40 bg-destructive/10 text-destructive',
  },
  niet_relevant: {
    label: 'N.v.t.',
    icon: MinusCircle,
    dot: 'bg-muted-foreground/40',
    chip: 'border-border bg-muted text-muted-foreground',
  },
};

function scrollToId(id: string) {
  if (typeof window === 'undefined') return;
  const element = document.getElementById(id);
  if (!element) return;
  element.scrollIntoView({ behavior: 'smooth', block: 'start' });
  element.classList.add('ring-2', 'ring-primary/40', 'ring-offset-2', 'ring-offset-background');
  window.setTimeout(() => {
    element.classList.remove('ring-2', 'ring-primary/40', 'ring-offset-2', 'ring-offset-background');
  }, 1400);
}

export function SectionRail({ items }: { items: RailItem[] }) {
  const [open, setOpen] = useState(false);
  const subItems = useMemo(() => items.filter((item) => item.level === 'sub'), [items]);
  const relevant = useMemo(() => subItems.filter((item) => item.status !== 'niet_relevant'), [subItems]);
  const notRelevant = useMemo(() => subItems.filter((item) => item.status === 'niet_relevant'), [subItems]);
  const okCount = relevant.filter((item) => item.status === 'ok').length;
  const blockerCount = relevant.filter((item) => item.status === 'blocker').length;
  const warningCount = relevant.filter((item) => item.status === 'aandacht').length;
  const percentage = relevant.length > 0 ? Math.round((okCount / relevant.length) * 100) : 0;

  return (
    <section className="lg:col-span-2 lg:[&+div]:col-span-2 min-w-0 rounded-lg border border-border/70 bg-card shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/30 sm:px-4"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary/70">Werkstroom</span>
            <span className="text-xs font-medium text-foreground">{okCount}/{relevant.length} compleet</span>
            {blockerCount > 0 && <span className="text-xs font-medium text-destructive">{blockerCount} blocker{blockerCount === 1 ? '' : 's'}</span>}
            {warningCount > 0 && <span className="text-xs font-medium text-amber-700 dark:text-amber-300">{warningCount} aandacht</span>}
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-accent transition-all duration-300" style={{ width: `${percentage}%` }} />
          </div>
        </div>
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="border-t border-border/60 p-2 sm:p-3">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {relevant.map((item) => <RailButton key={item.id} item={item} />)}
          </div>
          {notRelevant.length > 0 && (
            <details className="mt-2 rounded-md border border-border/60 bg-muted/20">
              <summary className="cursor-pointer px-3 py-2 text-xs text-muted-foreground">Niet relevant ({notRelevant.length})</summary>
              <div className="flex gap-2 overflow-x-auto border-t border-border/50 p-2">
                {notRelevant.map((item) => <RailButton key={item.id} item={item} />)}
              </div>
            </details>
          )}
        </div>
      )}
    </section>
  );
}

function RailButton({ item }: { item: RailItem }) {
  const config = STATUS_CFG[item.status];
  const Icon = config.icon;
  return (
    <button
      type="button"
      onClick={() => scrollToId(item.id)}
      title={item.hint ?? item.title}
      className="flex min-w-[170px] max-w-[230px] items-center gap-2 rounded-md border border-border/60 bg-background px-3 py-2 text-left hover:border-primary/30 hover:bg-muted/30"
    >
      <span className="text-[10px] font-mono-data tabular-nums text-muted-foreground">{item.number}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-medium text-foreground">{item.title}</span>
        {item.hint && <span className="block truncate text-[10px] text-muted-foreground">{item.hint}</span>}
      </span>
      {item.count != null && item.count > 0 && <span className="text-[10px] text-muted-foreground">{item.count}</span>}
      <span className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${config.chip}`}>
        <Icon className="h-3 w-3" />
      </span>
    </button>
  );
}
