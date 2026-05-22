// Dossier-cockpit voor één object.
// Tabs: Overzicht (default) · Checklist · Actielijst · Aanbieding · Aandachtspunten · Documenten.
// Overzicht is de hoofdweergave; checklist blijft beschikbaar voor wie alles wil afwerken.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useObjectDossier } from '@/hooks/useObjectDossier';
import { buildEffectiveItems, computeReadiness } from '@/lib/objectDossier/readiness';
import {
  CHECKLIST_CATALOG, SALE_READY_KEYS, TEASER_READY_KEYS, type DossierCategory,
} from '@/lib/objectDossier/catalog';
import DossierOverview from './DossierOverview';
import DossierChecklist from './DossierChecklist';
import MissingItemsPanel from './MissingItemsPanel';
import OfferingTextsSection from './OfferingTextsSection';
import AttentionPointsSection from './AttentionPointsSection';
import DocumentenPanel from '@/components/object/DocumentenPanel';
import TaakFormDialog from '@/components/forms/TaakFormDialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Props {
  objectId: string;
  objectRecord?: Record<string, unknown> | null;
  openTabRequest?: { tab: DossierTab; token: number } | null;
}

export type DossierTab = 'overzicht' | 'checklist' | 'actielijst' | 'aanbieding' | 'aandacht' | 'documenten';

export default function ObjectDossierCard({ objectId, objectRecord, openTabRequest }: Props) {
  const { items, texts, attention, loading, error, reload } = useObjectDossier(objectId);
  const [taakOpen, setTaakOpen] = useState(false);
  const [taakPreset, setTaakPreset] = useState<{ title?: string } | null>(null);
  const [activeTab, setActiveTab] = useState<DossierTab>('overzicht');
  const [openRequest, setOpenRequest] = useState<{ category: DossierCategory; token: number } | null>(null);
  const tokenRef = useRef(0);

  const storedByKey = useMemo(() => {
    const m: Record<string, { status: any }> = {};
    for (const r of items) m[r.item_key] = { status: r.status as any };
    return m;
  }, [items]);

  const effective = useMemo(
    () => buildEffectiveItems(storedByKey, objectRecord ?? null),
    [storedByKey, objectRecord],
  );
  const readiness = useMemo(() => computeReadiness(effective), [effective]);

  function openTaak(preset: { title: string }) {
    setTaakPreset(preset);
    setTaakOpen(true);
  }

  function openCategory(cat: DossierCategory) {
    tokenRef.current += 1;
    setOpenRequest({ category: cat, token: tokenRef.current });
    setActiveTab('checklist');
  }

  async function markKeysAanwezig(keys: string[]) {
    try {
      const rows = keys.map(k => {
        const cat = CHECKLIST_CATALOG.find(c => c.key === k);
        return {
          object_id: objectId,
          item_key: k,
          category: cat?.category ?? 'commercieel',
          label: cat?.label ?? k,
          weight: cat?.weight ?? 1,
          status: 'aanwezig',
        };
      });
      const { error: err } = await supabase
        .from('object_dossier_items')
        .upsert(rows, { onConflict: 'object_id,item_key' });
      if (err) throw err;
      toast.success('Bijgewerkt');
      reload();
    } catch (e: any) {
      toast.error(e?.message ?? 'Bijwerken mislukt');
    }
  }

  const openAttentionCount = attention.filter(a => (a.status ?? 'open') === 'open').length;
  const actionsCount =
    readiness.missingCritical.length +
    effective.filter(e => e.status === 'opgevraagd').length +
    effective.filter(e => e.status === 'te_controleren').length +
    openAttentionCount;

  useEffect(() => {
    if (openTabRequest) setActiveTab(openTabRequest.tab);
  }, [openTabRequest?.token, openTabRequest?.tab]);

  return (
    <section className="section-card p-5">
      <header className="flex items-start justify-between gap-3 flex-wrap mb-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">Dossier &amp; aanbieding</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Cockpit met informatiepositie, marketingteksten en interne aandachtspunten voor dit object.
          </p>
        </div>
      </header>

      {error && (
        <p className="mb-3 text-xs text-destructive">
          Dossier-data kon niet geladen worden: {error}
        </p>
      )}

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as DossierTab)}>
        <TabsList className="tabs-scroll sm:inline-flex sm:w-auto sm:flex-wrap sm:h-auto bg-muted/40 backdrop-blur p-1 rounded-full gap-1 border border-border/50">
          <TabsTrigger value="overzicht" className="dossier-tab-pill">Overzicht</TabsTrigger>
          <TabsTrigger value="checklist" className="dossier-tab-pill">Checklist</TabsTrigger>
          <TabsTrigger value="actielijst" className="dossier-tab-pill">
            Actielijst {actionsCount > 0 && <span className="ml-1 text-[10px] opacity-70">({actionsCount})</span>}
          </TabsTrigger>
          <TabsTrigger value="aanbieding" className="dossier-tab-pill">Aanbieding</TabsTrigger>
          <TabsTrigger value="aandacht" className="dossier-tab-pill">
            Aandachtspunten {openAttentionCount > 0 && <span className="ml-1 text-[10px] opacity-70">({openAttentionCount})</span>}
          </TabsTrigger>
          <TabsTrigger value="documenten" className="dossier-tab-pill">Documenten</TabsTrigger>
        </TabsList>

        <TabsContent value="overzicht" className="pt-4">
          {loading && items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Laden…</p>
          ) : (
            <DossierOverview
              readiness={readiness}
              effective={effective}
              attention={attention}
              onOpenCategory={openCategory}
              onMarkTeaserReady={() => markKeysAanwezig(TEASER_READY_KEYS)}
              onMarkSaleReady={() => markKeysAanwezig(SALE_READY_KEYS)}
              onCreateTask={openTaak}
              onGoToActions={() => setActiveTab('actielijst')}
            />
          )}
        </TabsContent>

        <TabsContent value="checklist" className="pt-4">
          {loading && items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Laden…</p>
          ) : (
            <DossierChecklist
              objectId={objectId}
              effective={effective}
              stored={items}
              onChanged={reload}
              onCreateTask={openTaak}
              openRequest={openRequest}
            />
          )}
        </TabsContent>

        <TabsContent value="actielijst" className="pt-4">
          <MissingItemsPanel
            objectId={objectId}
            effective={effective}
            attention={attention}
            onChanged={reload}
            onCreateTask={openTaak}
          />
        </TabsContent>

        <TabsContent value="aanbieding" className="pt-4">
          <OfferingTextsSection objectId={objectId} initial={texts} onSaved={reload} />
        </TabsContent>

        <TabsContent value="aandacht" className="pt-4">
          <AttentionPointsSection objectId={objectId} items={attention} onChanged={reload} />
        </TabsContent>

        <TabsContent value="documenten" className="pt-4">
          <DocumentenPanel objectId={objectId} />
        </TabsContent>
      </Tabs>

      <TaakFormDialog
        open={taakOpen}
        onOpenChange={(o) => { setTaakOpen(o); if (!o) setTaakPreset(null); }}
        defaultObjectId={objectId}
      />
    </section>
  );
}
