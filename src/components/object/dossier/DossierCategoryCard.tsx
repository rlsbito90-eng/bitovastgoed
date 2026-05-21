// Compacte categorie-kaart voor het Overzicht-tabblad.

import { ChevronRight } from 'lucide-react';
import {
  CATEGORY_LABELS, type DossierCategory,
} from '@/lib/objectDossier/catalog';
import type { EffectiveItem } from '@/lib/objectDossier/readiness';

interface Props {
  category: DossierCategory;
  items: EffectiveItem[];
  onOpen: () => void;
}

function categoryStatus(items: EffectiveItem[]) {
  const total = items.length;
  const done = items.filter(i => i.status === 'aanwezig').length;
  const missingCritical = items.filter(i => i.catalog.weight === 3 && i.status !== 'aanwezig');
  const missingTop = items
    .filter(i => i.status !== 'aanwezig' && i.status !== 'nvt')
    .sort((a, b) => b.catalog.weight - a.catalog.weight)
    .slice(0, 3);

  let label = 'Beperkt';
  let tone: 'success' | 'warning' | 'destructive' | 'accent' = 'destructive';
  const ratio = total > 0 ? done / total : 0;

  if (missingCritical.length > 0) { label = 'Mist cruciaal'; tone = 'destructive'; }
  else if (ratio >= 0.8) { label = 'Goed'; tone = 'success'; }
  else if (ratio >= 0.5) { label = 'Redelijk'; tone = 'warning'; }
  else { label = 'Beperkt'; tone = 'accent'; }

  return { total, done, ratio, missingCritical, missingTop, label, tone };
}

const TONE_BADGE: Record<string, string> = {
  success:     'bg-success/10 text-success border-success/25',
  warning:     'bg-warning/10 text-warning border-warning/25',
  destructive: 'bg-destructive/10 text-destructive border-destructive/25',
  accent:      'bg-accent/10 text-accent border-accent/25',
};

const TONE_BAR: Record<string, string> = {
  success: 'bg-success', warning: 'bg-warning', destructive: 'bg-destructive', accent: 'bg-accent',
};

export default function DossierCategoryCard({ category, items, onOpen }: Props) {
  const s = categoryStatus(items);
  const pct = s.total > 0 ? Math.round(s.ratio * 100) : 0;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group text-left border border-border rounded-lg bg-card p-4 hover:border-foreground/20 hover:shadow-sm transition-all"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{CATEGORY_LABELS[category]}</p>
          <p className="text-xs font-mono-data text-muted-foreground mt-0.5">
            {s.done}/{s.total} compleet
          </p>
        </div>
        <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded-full border ${TONE_BADGE[s.tone]}`}>
          {s.label}
        </span>
      </div>

      <div className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={`h-full ${TONE_BAR[s.tone]} transition-all`} style={{ width: `${pct}%` }} />
      </div>

      {s.missingTop.length > 0 && (
        <div className="mt-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
            {s.missingCritical.length > 0 ? 'Mist cruciaal' : 'Nog te doen'}
          </p>
          <p className="text-xs text-foreground/80 line-clamp-2">
            {s.missingTop.map(m => m.catalog.label).join(' · ')}
          </p>
        </div>
      )}

      <div className="mt-3 inline-flex items-center gap-1 text-xs text-muted-foreground group-hover:text-foreground">
        Open details <ChevronRight className="h-3 w-3" />
      </div>
    </button>
  );
}
