// Checklist gegroepeerd per categorie, inklapbaar.
// Open-state wordt lokaal bewaard zodat een data-refresh na een wijziging
// geen categorieën dichtklapt. Een externe "openRequest" kan een specifieke
// categorie afdwingen (deep-link vanuit Overzicht).

import { useEffect, useState } from 'react';
import { CATEGORY_LABELS, CATEGORY_ORDER, CHECKLIST_CATALOG, type DossierCategory } from '@/lib/objectDossier/catalog';
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
  /** Signal van buitenaf om een categorie te openen (cat + token zorgt dat herhaalde requests doorkomen). */
  openRequest?: { category: DossierCategory; token: number } | null;
}

export default function DossierChecklist({
  objectId, effective, stored, onChanged, onCreateTask, openRequest,
}: Props) {
  const storedByKey = new Map(stored.map(r => [r.item_key, r]));
  const effByKey = new Map(effective.map(e => [e.catalog.key, e]));

  const [openCats, setOpenCats] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const c of CATEGORY_ORDER) init[c] = c === 'basis';
    return init;
  });

  useEffect(() => {
    if (!openRequest) return;
    setOpenCats(prev => ({ ...prev, [openRequest.category]: true }));
    // Scroll naar de geopende categorie zonder de tabwissel te storen.
    requestAnimationFrame(() => {
      const el = document.getElementById(`dossier-cat-${openRequest.category}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [openRequest]);

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
          <div
            key={cat}
            id={`dossier-cat-${cat}`}
            className="border border-border rounded-lg bg-card scroll-mt-24"
          >
            <button
              type="button"
              onClick={() => toggle(cat)}
              aria-expanded={isOpen}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/30 text-left rounded-lg"
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
