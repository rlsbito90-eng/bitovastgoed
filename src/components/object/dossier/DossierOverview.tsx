// Overzicht-tabblad: cockpit met samenvatting, cruciale gaten en categoriekaarten.

import { AlertTriangle } from 'lucide-react';
import {
  CATEGORY_ORDER, SALE_READY_KEYS, TEASER_READY_KEYS,
  type DossierCategory,
} from '@/lib/objectDossier/catalog';
import type { EffectiveItem, ReadinessResult } from '@/lib/objectDossier/readiness';
import type { AttentionRow } from '@/hooks/useObjectDossier';
import DossierSummaryCards from './DossierSummaryCards';
import DossierCategoryCard from './DossierCategoryCard';

interface Props {
  readiness: ReadinessResult;
  effective: EffectiveItem[];
  attention: AttentionRow[];
  onOpenCategory: (cat: DossierCategory) => void;
  onMarkTeaserReady: () => void;
  onMarkSaleReady: () => void;
  onCreateTask: (preset: { title: string }) => void;
  onGoToActions: () => void;
}

export default function DossierOverview({
  readiness, effective, attention,
  onOpenCategory, onMarkTeaserReady, onMarkSaleReady, onCreateTask, onGoToActions,
}: Props) {
  const byCat = new Map<DossierCategory, EffectiveItem[]>();
  for (const cat of CATEGORY_ORDER) byCat.set(cat, []);
  for (const e of effective) byCat.get(e.catalog.category)!.push(e);

  const _t = TEASER_READY_KEYS; const _s = SALE_READY_KEYS; void _t; void _s;

  return (
    <div className="space-y-5">
      <DossierSummaryCards readiness={readiness} effective={effective} attention={attention} />

      {readiness.missingCritical.length > 0 && (
        <div className="flex items-start gap-3 p-4 rounded-lg border border-destructive/25 bg-destructive/5">
          <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">
              Cruciaal ontbreekt ({readiness.missingCritical.length})
            </p>
            <p className="text-xs text-muted-foreground mt-1 break-words">
              {readiness.missingCritical.map(m => m.catalog.label).join(' · ')}
            </p>
            <div className="mt-3 flex gap-2 flex-wrap">
              <button
                onClick={() => onCreateTask({ title: 'Ontbrekende dossierstukken opvragen' })}
                className="text-xs px-2.5 py-1 rounded border border-input bg-background hover:bg-muted text-foreground"
              >
                Taak: info opvragen
              </button>
              <button
                onClick={onGoToActions}
                className="text-xs px-2.5 py-1 rounded border border-input bg-background hover:bg-muted text-foreground"
              >
                Bekijk actielijst
              </button>
            </div>
          </div>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-foreground">Categorieën</h3>
          <div className="flex gap-2">
            <button
              onClick={onMarkTeaserReady}
              className="text-xs px-2.5 py-1 rounded border border-input hover:bg-muted"
            >
              Markeer teaser-gereed
            </button>
            <button
              onClick={onMarkSaleReady}
              className="text-xs px-2.5 py-1 rounded border border-input hover:bg-muted"
            >
              Markeer verkoopklaar
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {CATEGORY_ORDER.map(cat => (
            <DossierCategoryCard
              key={cat}
              category={cat}
              items={byCat.get(cat) ?? []}
              onOpen={() => onOpenCategory(cat)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
