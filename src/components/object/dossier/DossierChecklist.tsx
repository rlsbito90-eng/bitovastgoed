// Checklist gegroepeerd per categorie, inklapbaar via <details>.

import { CATEGORY_LABELS, CATEGORY_ORDER, CHECKLIST_CATALOG } from '@/lib/objectDossier/catalog';
import type { EffectiveItem } from '@/lib/objectDossier/readiness';
import DossierChecklistItem from './DossierChecklistItem';
import type { DossierItemRow } from '@/hooks/useObjectDossier';

interface Props {
  objectId: string;
  effective: EffectiveItem[];
  stored: DossierItemRow[];
  onChanged: () => void;
  onCreateTask?: (preset: { title: string }) => void;
}

export default function DossierChecklist({ objectId, effective, stored, onChanged, onCreateTask }: Props) {
  const storedByKey = new Map(stored.map(r => [r.item_key, r]));
  const effByKey = new Map(effective.map(e => [e.catalog.key, e]));

  return (
    <div className="space-y-3">
      {CATEGORY_ORDER.map(cat => {
        const items = CHECKLIST_CATALOG.filter(c => c.category === cat);
        const done = items.filter(c => effByKey.get(c.key)?.status === 'aanwezig').length;
        return (
          <details key={cat} className="group border border-border rounded-md bg-card" open={cat === 'basis'}>
            <summary className="cursor-pointer list-none px-4 py-3 flex items-center justify-between hover:bg-muted/30">
              <span className="text-sm font-medium text-foreground">{CATEGORY_LABELS[cat]}</span>
              <span className="text-xs font-mono-data text-muted-foreground">{done}/{items.length}</span>
            </summary>
            <div className="px-3 pb-3 pt-1 space-y-2">
              {items.map(c => {
                const eff = effByKey.get(c.key);
                const row = storedByKey.get(c.key);
                return (
                  <DossierChecklistItem
                    key={c.key}
                    objectId={objectId}
                    catalog={c}
                    status={eff?.status ?? null}
                    fromAuto={!!eff?.fromAuto}
                    notitie={row?.notitie ?? null}
                    bron={row?.bron ?? null}
                    opgevraagdOp={row?.opgevraagd_op ?? null}
                    onChanged={onChanged}
                    onCreateTask={onCreateTask}
                  />
                );
              })}
            </div>
          </details>
        );
      })}
    </div>
  );
}
