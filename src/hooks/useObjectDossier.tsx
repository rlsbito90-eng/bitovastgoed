// React hook voor Objectdossier-data.
// Laadt checklist-items, aanbiedingsteksten en aandachtspunten per object.
// Null-safe: ontbrekende rijen, onbekend object_id of mislukte fetches geven gewoon lege staat.

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

export type DossierItemRow   = Database['public']['Tables']['object_dossier_items']['Row'];
export type OfferingTextsRow = Database['public']['Tables']['object_aanbiedingsteksten']['Row'];
export type AttentionRow     = Database['public']['Tables']['object_aandachtspunten']['Row'];

export interface DossierData {
  items: DossierItemRow[];
  texts: OfferingTextsRow | null;
  attention: AttentionRow[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

export function useObjectDossier(objectId: string | null | undefined): DossierData {
  const [items, setItems] = useState<DossierItemRow[]>([]);
  const [texts, setTexts] = useState<OfferingTextsRow | null>(null);
  const [attention, setAttention] = useState<AttentionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Bijhouden via ref zodat het niet aan reload-identity bijdraagt; dat voorkomt
  // dat tabs/accordions herrenderen alleen omdat hasLoadedOnce flipt.
  const hasLoadedOnceRef = useRef(false);

  const reload = useCallback(async () => {
    if (!objectId) {
      setItems([]); setTexts(null); setAttention([]); setLoading(false);
      return;
    }
    // Alleen bij eerste load een volledige loading-state tonen; bij refresh na een
    // wijziging behouden we de bestaande data zodat tabs/accordions/scroll niet resetten.
    if (!hasLoadedOnceRef.current) setLoading(true);
    setError(null);
    try {
      const [itemsRes, textsRes, attRes] = await Promise.all([
        supabase.from('object_dossier_items').select('*').eq('object_id', objectId),
        supabase.from('object_aanbiedingsteksten').select('*').eq('object_id', objectId).maybeSingle(),
        supabase.from('object_aandachtspunten').select('*').eq('object_id', objectId).order('created_at', { ascending: false }),
      ]);
      if (itemsRes.error) throw itemsRes.error;
      if (textsRes.error && textsRes.error.code !== 'PGRST116') throw textsRes.error;
      if (attRes.error) throw attRes.error;
      setItems(itemsRes.data ?? []);
      setTexts((textsRes.data as OfferingTextsRow | null) ?? null);
      setAttention(attRes.data ?? []);
    } catch (e: any) {
      console.error('useObjectDossier:', e);
      setError(e?.message ?? 'Onbekende fout');
      if (!hasLoadedOnceRef.current) { setItems([]); setTexts(null); setAttention([]); }
    } finally {
      setLoading(false);
      hasLoadedOnceRef.current = true;
    }
  }, [objectId]);

  // Bij navigatie naar een ander object terug naar 'eerste load'-gedrag.
  useEffect(() => {
    hasLoadedOnceRef.current = false;
  }, [objectId]);

  useEffect(() => { void reload(); }, [reload]);

  return { items, texts, attention, loading, error, reload };
}
