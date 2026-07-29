import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { mapDbError } from '@/lib/errors';
import {
  buildGebiedsvoorkeurPayload,
  type Gebiedsfrequentie,
  type Gebiedsvoorkeur,
  type GebiedsvoorkeurDraft,
} from '@/lib/acquisitie/gebiedsvoorkeuren';

function untypedTable(name: string) {
  return (supabase as unknown as { from: (table: string) => any }).from(name);
}

function normalizePreference(row: unknown): Gebiedsvoorkeur {
  const item = row as Gebiedsvoorkeur;
  return {
    ...item,
    priority: Number(item.priority ?? 3),
    version: Number(item.version ?? 1),
    asset_type_codes: item.asset_type_codes ?? [],
    strategy_codes: item.strategy_codes ?? [],
    active: item.active !== false,
  };
}

function normalizeFrequency(row: unknown): Gebiedsfrequentie {
  const item = row as Gebiedsfrequentie;
  return {
    ...item,
    signal_count: Number(item.signal_count ?? 0),
    active_signal_count: Number(item.active_signal_count ?? 0),
  };
}

export function useGebiedsvoorkeuren() {
  const [preferences, setPreferences] = useState<Gebiedsvoorkeur[]>([]);
  const [frequencies, setFrequencies] = useState<Gebiedsfrequentie[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    const [preferenceResult, frequencyResult] = await Promise.all([
      untypedTable('acquisitie_gebiedsvoorkeuren')
        .select('*')
        .order('active', { ascending: false })
        .order('priority')
        .order('updated_at', { ascending: false }),
      untypedTable('view_acquisitie_gebiedsfrequentie')
        .select('*')
        .order('signal_count', { ascending: false })
        .order('location_level'),
    ]);

    if (preferenceResult.error) {
      toast.error(mapDbError(preferenceResult.error, 'Gebiedsvoorkeuren konden niet worden geladen. Is de Fase 6A-migratie toegepast?'));
      setPreferences([]);
    } else {
      setPreferences((preferenceResult.data ?? []).map(normalizePreference));
    }

    if (frequencyResult.error) {
      toast.error(mapDbError(frequencyResult.error, 'Gebiedsfrequenties konden niet worden geladen.'));
      setFrequencies([]);
    } else {
      setFrequencies((frequencyResult.data ?? []).map(normalizeFrequency));
    }
    setLoading(false);
  }, []);

  useEffect(() => { void refetch(); }, [refetch]);

  const save = useCallback(async (draft: GebiedsvoorkeurDraft, id?: string | null) => {
    try {
      const payload = buildGebiedsvoorkeurPayload(draft);
      const now = new Date().toISOString();
      if (id) {
        const current = preferences.find((item) => item.id === id);
        const { error } = await untypedTable('acquisitie_gebiedsvoorkeuren')
          .update({ ...payload, version: Number(current?.version ?? 0) + 1, updated_at: now })
          .eq('id', id);
        if (error) throw error;
        toast.success('Gebiedsvoorkeur bijgewerkt');
      } else {
        const { data: userData } = await supabase.auth.getUser();
        const { error } = await untypedTable('acquisitie_gebiedsvoorkeuren').insert({
          ...payload,
          created_by: userData.user?.id ?? null,
          created_at: now,
          updated_at: now,
        });
        if (error) throw error;
        toast.success('Gebiedsvoorkeur toegevoegd');
      }
      await refetch();
      return true;
    } catch (error) {
      toast.error(mapDbError(error as { message?: string }, 'Gebiedsvoorkeur opslaan mislukt'));
      return false;
    }
  }, [preferences, refetch]);

  const setActive = useCallback(async (item: Gebiedsvoorkeur, active: boolean) => {
    const { error } = await untypedTable('acquisitie_gebiedsvoorkeuren')
      .update({ active, version: Number(item.version) + 1, updated_at: new Date().toISOString() })
      .eq('id', item.id);
    if (error) toast.error(mapDbError(error, 'Status gebiedsvoorkeur wijzigen mislukt'));
    else {
      toast.success(active ? 'Gebied geactiveerd' : 'Gebied gearchiveerd');
      await refetch();
    }
  }, [refetch]);

  return { preferences, frequencies, loading, refetch, save, setActive };
}
