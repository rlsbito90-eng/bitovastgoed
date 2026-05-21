// Wrapper voor de Objectdossier-sectie op de Objectdetailpagina.
// Toont readiness-header + tabs voor Checklist / Aanbiedingsteksten / Aandachtspunten / Documenten.

import { useMemo, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useObjectDossier } from '@/hooks/useObjectDossier';
import { buildEffectiveItems, computeReadiness } from '@/lib/objectDossier/readiness';
import { CHECKLIST_CATALOG, SALE_READY_KEYS, TEASER_READY_KEYS } from '@/lib/objectDossier/catalog';
import DossierReadinessBadge from './DossierReadinessBadge';
import DossierChecklist from './DossierChecklist';
import OfferingTextsSection from './OfferingTextsSection';
import AttentionPointsSection from './AttentionPointsSection';
import DocumentenPanel from '@/components/object/DocumentenPanel';
import TaakFormDialog from '@/components/forms/TaakFormDialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { AlertTriangle } from 'lucide-react';

interface Props {
  objectId: string;
  objectRecord?: Record<string, unknown> | null;
}

export default function ObjectDossierCard({ objectId, objectRecord }: Props) {
  const { items, texts, attention, loading, error, reload } = useObjectDossier(objectId);
  const [taakOpen, setTaakOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('checklist');

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

  return (
    <section className="section-card p-5">
      <header className="flex items-start justify-between gap-3 flex-wrap mb-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">Dossier &amp; aanbieding</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Informatiepositie, marketingteksten en interne aandachtspunten voor dit object.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <DossierReadinessBadge label={readiness.label} score={readiness.score} />
          <button
            onClick={() => markKeysAanwezig(TEASER_READY_KEYS)}
            className="text-xs px-2.5 py-1 rounded border border-input hover:bg-muted"
          >
            Markeer teaser-gereed
          </button>
          <button
            onClick={() => markKeysAanwezig(SALE_READY_KEYS)}
            className="text-xs px-2.5 py-1 rounded border border-input hover:bg-muted"
          >
            Markeer verkoopklaar
          </button>
        </div>
      </header>

      {readiness.missingCritical.length > 0 && (
        <div className="mb-4 flex items-start gap-2 p-3 rounded-md border border-warning/30 bg-warning/5">
          <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
          <div className="text-xs text-foreground">
            <p className="font-medium mb-0.5">Belangrijkste ontbrekende punten</p>
            <p className="text-muted-foreground">
              {readiness.missingCritical.map(m => m.catalog.label).join(' · ')}
            </p>
          </div>
        </div>
      )}

      {error && (
        <p className="mb-3 text-xs text-destructive">
          Dossier-data kon niet geladen worden: {error}
        </p>
      )}

      <Tabs defaultValue="checklist">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="checklist">Checklist</TabsTrigger>
          <TabsTrigger value="teksten">Aanbiedingsteksten</TabsTrigger>
          <TabsTrigger value="aandacht">
            Aandachtspunten {attention.length > 0 && <span className="ml-1 text-[10px] opacity-70">({attention.length})</span>}
          </TabsTrigger>
          <TabsTrigger value="documenten">Documenten</TabsTrigger>
        </TabsList>

        <TabsContent value="checklist" className="pt-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">Laden…</p>
          ) : (
            <DossierChecklist
              objectId={objectId}
              effective={effective}
              stored={items}
              onChanged={reload}
              onCreateTask={() => setTaakOpen(true)}
            />
          )}
        </TabsContent>

        <TabsContent value="teksten" className="pt-4">
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
        onOpenChange={setTaakOpen}
        defaultObjectId={objectId}
      />
    </section>
  );
}
