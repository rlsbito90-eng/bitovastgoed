import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { mapDbError } from '@/lib/errors';
import { toast } from 'sonner';
import {
  SCENARIO_INPUT_PROFILE_SCHEMA_VERSION,
  type ScenarioInputContext,
  type ScenarioInputContextDraft,
  type ScenarioProfileCode,
} from '@/lib/vastgoedrekenen/inputProfiles';

function table(name: string) {
  return (supabase as unknown as { from: (tableName: string) => any }).from(name);
}

function normalizeContext(row: unknown): ScenarioInputContext {
  const item = row as ScenarioInputContext;
  return {
    ...item,
    scenario_profile_code: (item.scenario_profile_code ?? 'base') as ScenarioProfileCode,
    location_keys: item.location_keys ?? [],
    derivation_notes: item.derivation_notes ?? {},
    schema_version: Number(item.schema_version ?? SCENARIO_INPUT_PROFILE_SCHEMA_VERSION),
  };
}

export function useScenarioInputProfile(scenarioId: string, objectId: string | null | undefined) {
  const [context, setContext] = useState<ScenarioInputContext | null>(null);
  const [geoLocationKeys, setGeoLocationKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const refetch = useCallback(async () => {
    setLoading(true);
    const { data, error } = await table('scenario_kengetal_contexts')
      .select('*')
      .eq('scenario_id', scenarioId)
      .maybeSingle();
    if (error) {
      toast.error(mapDbError(error, 'Invoerprofiel kon niet worden geladen. Is de Fase 6B-migratie toegepast?'));
      setContext(null);
    } else {
      setContext(data ? normalizeContext(data) : null);
    }
    setLoading(false);
  }, [scenarioId]);

  const refetchGeo = useCallback(async () => {
    if (!objectId) {
      setGeoLocationKeys([]);
      return;
    }
    const { data, error } = await table('off_market_signalen')
      .select('geo_gemeente_code, geo_wijk_code, geo_buurt_code, geo_verrijkt_op')
      .eq('gekoppeld_object_id', objectId)
      .order('geo_verrijkt_op', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) {
      setGeoLocationKeys([]);
      return;
    }
    const record = data as Record<string, unknown>;
    setGeoLocationKeys(Array.from(new Set([
      record.geo_gemeente_code,
      record.geo_wijk_code,
      record.geo_buurt_code,
    ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0))));
  }, [objectId]);

  useEffect(() => { void refetch(); }, [refetch]);
  useEffect(() => { void refetchGeo(); }, [refetchGeo]);

  const save = useCallback(async (draft: ScenarioInputContextDraft) => {
    if (draft.scenario_id !== scenarioId) {
      toast.error('Het invoerprofiel hoort niet bij het geopende scenario.');
      return null;
    }
    if (!['conservative', 'base', 'optimistic'].includes(draft.scenario_profile_code)) {
      toast.error('Kies een geldig scenarioprofiel.');
      return null;
    }
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const now = new Date().toISOString();
      const payload = {
        ...draft,
        location_keys: Array.from(new Set(draft.location_keys ?? [])),
        derivation_notes: draft.derivation_notes ?? {},
        schema_version: SCENARIO_INPUT_PROFILE_SCHEMA_VERSION,
        updated_by: userData.user?.id ?? null,
        updated_at: now,
      };
      const { data, error } = await table('scenario_kengetal_contexts')
        .upsert(payload, { onConflict: 'scenario_id' })
        .select('*')
        .single();
      if (error) {
        toast.error(mapDbError(error, 'Invoerprofiel opslaan mislukt'));
        return null;
      }
      const normalized = normalizeContext(data);
      setContext(normalized);
      toast.success('Invoerprofiel opgeslagen. Er zijn nog geen kengetallen toegepast.');
      return normalized;
    } finally {
      setSaving(false);
    }
  }, [scenarioId]);

  const recordApplication = useCallback(async (args: {
    contextSnapshot: ScenarioInputContextDraft;
    appliedItems: Array<Record<string, unknown>>;
    skippedItems: Array<Record<string, unknown>>;
    status: 'completed' | 'partial' | 'failed';
  }) => {
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await table('scenario_kengetal_profile_applications').insert({
      scenario_id: scenarioId,
      profile_code: args.contextSnapshot.scenario_profile_code,
      context_snapshot: args.contextSnapshot,
      applied_items: args.appliedItems,
      skipped_items: args.skippedItems,
      status: args.status,
      created_by: userData.user?.id ?? null,
    });
    if (error) {
      toast.error(mapDbError(error, 'Profieltoepassing is uitgevoerd, maar de auditregel kon niet worden opgeslagen.'));
      return false;
    }
    return true;
  }, [scenarioId]);

  return {
    context,
    geoLocationKeys,
    loading,
    saving,
    refetch,
    save,
    recordApplication,
  };
}
