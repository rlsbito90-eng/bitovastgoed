// Checklist gegroepeerd per categorie, inklapbaar.
// Open-state wordt lokaal bewaard zodat een data-refresh na een wijziging
// geen categorieën dichtklapt.

import { useState } from 'react';
import { CATEGORY_LABELS, CATEGORY_ORDER, CHECKLIST_CATALOG } from '@/lib/objectDossier/catalog';
import type { EffectiveItem } from '@/lib/objectDossier/readiness';
import DossierChecklistItem from './DossierChecklistItem';
import type { DossierItemRow } from '@/hooks/useObjectDossier';
import { ChevronDown } from 'lucide-react';

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

  // Open-state per categorie, default: alleen 'basis' open.
  const [openCats, setOpenCats] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const c of CATEGORY_ORDER) init[c] = c === 'basis';
    return init;
  });

  function toggle(cat: string) {
    setOpenCats(prev => ({ ...prev, [cat]: !prev[cat] }));
  }

  return (
    <div className="space-y-3">
      {CATEGORY_ORDER.map(cat => {
        const items = CHECKLIST_CATALOG.filter(c => c.category === cat);
        const done = items.filter(c => effByKey.get(c.key)?.status === 'aanwezig').length;
        const isOpen = !!openCats[cat];
        return (
          <div key={cat} className="border border-border rounded-md bg-card">
            <button
              type="button"
              onClick={() => toggle(cat)}
              aria-expanded={isOpen}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/30 text-left"
            >
              <span className="text-sm font-medium text-foreground flex items-center gap-2">
                <ChevronDown
                  className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${isOpen ? '' : '-rotate-90'}`}
                />
                {CATEGORY_LABELS[cat]}
              </span>
              <span className="text-xs font-mono-data text-muted-foreground">{done}/{items.length}</span>
            </button>
            {isOpen && (
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
            )}
          </div>
        );
      })}
    </div>
  );
}
