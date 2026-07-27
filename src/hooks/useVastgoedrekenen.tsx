// Data-hook voor de Vastgoedrekenen module.
import { mapDbError, showAppErrorToast, describeDbError } from '@/lib/errors';
// Beheert CRUD voor calculations, scenarios, components, costs, wws units, sell-off units,
// risk items en outputs voor een specifiek object.

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type {
  Calculation, Scenario, Component, ScenarioCost, WwsUnit,
  SellOffUnit, RiskItem, CalcOutput, TaxSettings,
} from '@/lib/vastgoedrekenen/types';
import {
  acquisitionStructureStatusMessage,
  isAcquisitionStructureMigrationMissing,
  type AcquisitionComponent,
  type AcquisitionStructureStatus,
  type AcquisitionUnitLink,
} from '@/lib/vastgoedrekenen/acquisition';
import { guardScenarioUpdatePatch, stripUndefinedEntries, type GuardedScenarioPatch } from '@/lib/vastgoedrekenen/saveGuards';
import {
  buildScenarioChildClone,
  nextScenarioCopyName,
  stripCloneIdentity,
} from '@/lib/vastgoedrekenen/duplicateScenario';
import { toast } from 'sonner';

export function useTaxSettings() {
  const [settings, setSettings] = useState<TaxSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('vastgoedrekenen_tax_settings')
      .select('*')
      .order('effective_from', { ascending: false })
      .limit(1);
    if (error) {
      toast.error('Kon OVB-instellingen niet laden');
    } else {
      setSettings(data?.[0] ?? null);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const updateSettings = useCallback(async (id: string, patch: Partial<TaxSettings>) => {
    const { error } = await supabase
      .from('vastgoedrekenen_tax_settings')
      .update(patch)
      .eq('id', id);
    if (error) { toast.error(mapDbError(error, 'Wijzigen mislukt')); return; }
    toast.success('OVB-instellingen bijgewerkt');
    await fetchSettings();
  }, [fetchSettings]);

  return { settings, loading, refetch: fetchSettings, updateSettings };
}

export function useObjectCalculations(objectId: string | undefined) {
  const [calculations, setCalculations] = useState<Calculation[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!objectId) { setCalculations([]); setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from('real_estate_calculations')
      .select('*')
      .eq('object_id', objectId)
      .order('created_at', { ascending: false });
    if (error) toast.error('Kon quickscans niet laden');
    else setCalculations((data ?? []) as Calculation[]);
    setLoading(false);
  }, [objectId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const buildAnalysisInsert = useCallback((input: Partial<Calculation> & { propositionType?: unknown }, userId: string | null) => ({
    object_id: objectId as string,
    calculation_name: input.calculation_name ?? 'Nieuwe quickscan',
    status: input.status ?? 'concept',
    main_strategy: input.main_strategy ?? 'belegging',
    object_type: input.object_type ?? 'enkelvoudig',
    input_reliability: input.input_reliability ?? 'laag',
    notes: input.notes ?? null,
    created_by: userId,
    ...propositionPersistencePatch({
      propositionType: input.propositionType ?? input.proposition_type,
      propositionSchemaVersion: input.proposition_schema_version,
    }),
  }), [objectId]);

  const create = useCallback(async (input: Partial<Calculation> & { propositionType?: unknown }) => {
    if (!objectId) return null;
    const { data: userData } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from('real_estate_calculations')
      .insert(buildAnalysisInsert(input, userData.user?.id ?? null))
      .select('*')
      .single();
    if (error) { toast.error(mapDbError(error, 'Aanmaken mislukt')); return null; }
    toast.success('Quickscan aangemaakt');
    await fetchAll();
    return data as Calculation;
  }, [objectId, fetchAll, buildAnalysisInsert]);

  /**
   * Createflow: analyse aanmaken én direct het eerste (generieke) scenario.
   * Mislukt het scenario, dan wordt de analyse teruggedraaid.
   */
  const createAnalysis = useCallback(async (input: {
    calculation_name?: string;
    propositionType?: unknown;
  }) => {
    if (!objectId) return null;
    const { data: userData } = await supabase.auth.getUser();
    const { defaultNotaryProfileFor } = await import('@/lib/vastgoedrekenen/fees/notaryProfile');

    const result = await createAnalysisWithFirstScenario<Calculation, Scenario>({
      insertAnalysis: async () => {
        const res = await supabase
          .from('real_estate_calculations')
          .insert(buildAnalysisInsert(
            { calculation_name: input.calculation_name?.trim() || 'Nieuwe analyse', propositionType: input.propositionType },
            userData.user?.id ?? null,
          ))
          .select('*')
          .single();
        return { data: (res.data as Calculation) ?? null, error: res.error ? { message: mapDbError(res.error, 'Analyse aanmaken mislukt.') } : null };
      },
      insertFirstScenario: async (analysis) => {
        const res = await supabase
          .from('calculation_scenarios')
          .insert({
            calculation_id: analysis.id,
            object_id: analysis.object_id,
            scenario_name: 'Scenario 1',
            strategy_type: analysis.main_strategy,
            status: 'concept',
            buyer_fee_method: 'staffel',
            notary_costs_method: 'profile',
            notary_costs_profile: defaultNotaryProfileFor(analysis.main_strategy, analysis.object_type),
          })
          .select('*')
          .single();
        return { data: (res.data as Scenario) ?? null, error: res.error ? { message: mapDbError(res.error, 'Scenario aanmaken mislukt.') } : null };
      },
      deleteAnalysis: async (id) => {
        const res = await supabase.from('real_estate_calculations').delete().eq('id', id);
        return { error: res.error ? { message: res.error.message } : null };
      },
    });

    if (!result.ok) {
      toast.error(result.message);
      await fetchAll();
      return null;
    }

    toast.success('Analyse aangemaakt');
    await fetchAll();
    return result.analysis;
  }, [objectId, fetchAll, buildAnalysisInsert]);

  const update = useCallback(async (id: string, patch: Partial<Calculation>) => {
    const { error } = await supabase.from('real_estate_calculations').update(patch).eq('id', id);
    if (error) toast.error('Wijzigen mislukt');
    else await fetchAll();
  }, [fetchAll]);

  /** Beperkt updatepad: uitsluitend analysenaam en propositiemetadata (metadata-only). */
  const updateAnalysisMetadata = useCallback(async (id: string, input: {
    calculation_name?: string;
    propositionType?: unknown;
    propositionSchemaVersion?: unknown;
  }) => {
    const patch: Partial<Calculation> = {};
    const naam = input.calculation_name?.trim();
    if (naam) patch.calculation_name = naam;
    if (input.propositionType !== undefined) {
      Object.assign(patch, propositionPersistencePatch({
        propositionType: input.propositionType,
        propositionSchemaVersion: input.propositionSchemaVersion,
      }));
    }
    if (Object.keys(patch).length === 0) return false;
    const { error } = await supabase.from('real_estate_calculations').update(patch).eq('id', id);
    if (error) { toast.error(mapDbError(error, 'Wijzigen mislukt')); return false; }
    await fetchAll();
    return true;
  }, [fetchAll]);

  const remove = useCallback(async (id: string) => {
    const { error } = await supabase.from('real_estate_calculations').delete().eq('id', id);
    if (error) toast.error('Verwijderen mislukt');
    else { toast.success('Quickscan verwijderd'); await fetchAll(); }
  }, [fetchAll]);

  return { calculations, loading, refetch: fetchAll, create, createAnalysis, update, updateAnalysisMetadata, remove };
}

export function useQuickscanDetail(calculationId: string | undefined) {
  const [calculation, setCalculation] = useState<Calculation | null>(null);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [loading, setLoading] = useState(true);
  const requestIdRef = useRef(0);

  const fetchAll = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    if (!calculationId) {
      if (requestId !== requestIdRef.current) return;
      setCalculation(null);
      setScenarios([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const [cRes, sRes] = await Promise.all([
      supabase.from('real_estate_calculations').select('*').eq('id', calculationId).maybeSingle(),
      supabase.from('calculation_scenarios').select('*').eq('calculation_id', calculationId).order('created_at', { ascending: true }),
    ]);
    if (requestId !== requestIdRef.current) return;
    if (cRes.error) toast.error('Kon quickscan niet laden');
    setCalculation((cRes.data as Calculation) ?? null);
    setScenarios((sRes.data ?? []) as Scenario[]);
    setLoading(false);
  }, [calculationId]);

  useEffect(() => {
    setCalculation(null);
    setScenarios([]);
    setLoading(true);
    fetchAll();
    return () => {
      requestIdRef.current += 1;
    };
  }, [fetchAll]);

  const updateCalculation = useCallback(async (patch: Partial<Calculation>) => {
    if (!calculationId) return;
    const { error } = await supabase.from('real_estate_calculations').update(patch).eq('id', calculationId);
    if (error) toast.error('Opslaan mislukt');
    else await fetchAll();
  }, [calculationId, fetchAll]);

  const createScenario = useCallback(async (input: Partial<Scenario>) => {
    if (!calculation) return null;
    const { defaultNotaryProfileFor } = await import('@/lib/vastgoedrekenen/fees/notaryProfile');
    const defaultProfile = defaultNotaryProfileFor(input.strategy_type ?? calculation.main_strategy, calculation.object_type);
    const { data, error } = await supabase
      .from('calculation_scenarios')
      .insert({
        calculation_id: calculation.id,
        object_id: calculation.object_id,
        scenario_name: input.scenario_name ?? 'Nieuw scenario',
        strategy_type: input.strategy_type ?? calculation.main_strategy,
        status: input.status ?? 'concept',
        buyer_fee_method: 'staffel',
        notary_costs_method: 'profile',
        notary_costs_profile: defaultProfile,
        ...input,
      })
      .select('*')
      .single();
    if (error) { toast.error(mapDbError(error, 'Scenario aanmaken mislukt')); return null; }
    await fetchAll();
    return data as Scenario;
  }, [calculation, fetchAll]);

  const updateScenario = useCallback(async (id: string, patch: GuardedScenarioPatch) => {
    const current = scenarios.find((s) => s.id === id) ?? null;
    const guarded = guardScenarioUpdatePatch(patch, current, (field) => {
      const msg = `Waarschuwing: poging om ${field} te wissen zonder expliciete leegmaakactie.`;
      console.warn(msg);
      toast.warning(msg);
    }).patch;
    if (Object.keys(guarded).length === 0) return;
    const { error } = await supabase.from('calculation_scenarios').update(guarded).eq('id', id);
    if (error) toast.error('Opslaan mislukt');
    else await fetchAll();
  }, [fetchAll, scenarios]);

  const deleteScenario = useCallback(async (id: string) => {
    const { error } = await supabase.from('calculation_scenarios').delete().eq('id', id);
    if (error) toast.error('Verwijderen mislukt');
    else { toast.success('Scenario verwijderd'); await fetchAll(); }
  }, [fetchAll]);

  const duplicateScenario = useCallback(async (id: string) => {
    if (!calculation) return null;
    const source = scenarios.find((scenario) => scenario.id === id);
    if (!source) {
      toast.error('Scenario dupliceren mislukt: bron niet gevonden.');
      return null;
    }

    const untyped = supabase as unknown as { from: (table: string) => any };
    const [componentsRes, acquisitionRes, acquisitionLinksRes, costsRes, wwsRes, sellOffRes, risksRes, exitRes] = await Promise.all([
      supabase.from('calculation_components').select('*').eq('scenario_id', id).order('created_at'),
      untyped.from('calculation_acquisition_components').select('*').eq('scenario_id', id).order('sort_order').order('created_at'),
      untyped.from('calculation_acquisition_unit_links').select('*').eq('scenario_id', id).order('created_at'),
      supabase.from('scenario_costs').select('*').eq('scenario_id', id).order('created_at'),
      supabase.from('residential_wws_units').select('*').eq('scenario_id', id).order('created_at'),
      supabase.from('sell_off_units').select('*').eq('scenario_id', id).order('created_at'),
      supabase.from('risk_analysis').select('*').eq('scenario_id', id).order('created_at'),
      supabase.from('exit_assumptions').select('*').eq('scenario_id', id).order('created_at'),
    ]);

    const requiredLoadError = [componentsRes, costsRes, wwsRes, sellOffRes, risksRes, exitRes]
      .map((result) => result.error)
      .find(Boolean);
    const optionalAcquisitionError = [acquisitionRes.error, acquisitionLinksRes.error]
      .find((error) => error && error.code !== '42P01');
    const loadError = requiredLoadError ?? optionalAcquisitionError;
    if (loadError) {
      toast.error(mapDbError(loadError, 'Scenario dupliceren mislukt: onderliggende invoer kon niet worden geladen'));
      return null;
    }

    const duplicateName = nextScenarioCopyName(
      source.scenario_name,
      scenarios.map((scenario) => scenario.scenario_name),
    );
    const scenarioPayload = {
      ...stripCloneIdentity(source as unknown as Record<string, unknown>),
      calculation_id: calculation.id,
      object_id: calculation.object_id,
      scenario_name: duplicateName,
      status: 'concept',
    };

    const { data: duplicateData, error: duplicateError } = await supabase
      .from('calculation_scenarios')
      .insert(scenarioPayload as never)
      .select('*')
      .single();
    if (duplicateError || !duplicateData) {
      toast.error(mapDbError(duplicateError, 'Scenario dupliceren mislukt'));
      return null;
    }

    const duplicate = duplicateData as Scenario;
    const componentIdMap = new Map<string, string>();
    const acquisitionComponentIdMap = new Map<string, string>();
    const sellOffUnitIdMap = new Map<string, string>();

    const rollback = async (cause: unknown) => {
      const { error: rollbackError } = await supabase
        .from('calculation_scenarios')
        .delete()
        .eq('id', duplicate.id);
      const detail = cause instanceof Error ? cause.message : 'Onbekende fout';
      if (rollbackError) {
        toast.error(`Scenario is onvolledig gekopieerd en kon niet automatisch worden verwijderd. Controleer “${duplicateName}”.`);
      } else {
        toast.error(`Scenario dupliceren afgebroken: ${detail}`);
      }
    };

    try {
      for (const component of componentsRes.data ?? []) {
        const payload = buildScenarioChildClone(
          component as unknown as Record<string, unknown>,
          duplicate.id,
        );
        const { data, error } = await supabase
          .from('calculation_components')
          .insert(payload as never)
          .select('id')
          .single();
        if (error || !data) throw new Error(error?.message ?? 'Component kopiëren mislukt');
        componentIdMap.set(component.id, data.id);
      }

      for (const acquisitionComponent of acquisitionRes.error ? [] : acquisitionRes.data ?? []) {
        const payload = buildScenarioChildClone(
          acquisitionComponent as unknown as Record<string, unknown>,
          duplicate.id,
        );
        const { data, error } = await untyped
          .from('calculation_acquisition_components')
          .insert(payload)
          .select('id')
          .single();
        if (error || !data) throw new Error(error?.message ?? 'Verkrijgingscomponent kopiëren mislukt');
        acquisitionComponentIdMap.set(acquisitionComponent.id, data.id);
      }

      for (const scenarioCost of costsRes.data ?? []) {
        const payload = buildScenarioChildClone(
          scenarioCost as unknown as Record<string, unknown>,
          duplicate.id,
          componentIdMap,
        );
        const { error } = await supabase.from('scenario_costs').insert(payload as never);
        if (error) throw new Error(error.message);
      }

      for (const wwsUnit of wwsRes.data ?? []) {
        const payload = buildScenarioChildClone(
          wwsUnit as unknown as Record<string, unknown>,
          duplicate.id,
          componentIdMap,
        );
        const { error } = await supabase.from('residential_wws_units').insert(payload as never);
        if (error) throw new Error(error.message);
      }

      for (const sellOffUnit of sellOffRes.data ?? []) {
        const payload = buildScenarioChildClone(
          sellOffUnit as unknown as Record<string, unknown>,
          duplicate.id,
          componentIdMap,
        );
        const { data, error } = await supabase
          .from('sell_off_units')
          .insert(payload as never)
          .select('id')
          .single();
        if (error || !data) throw new Error(error?.message ?? 'Strategie-unit kopiëren mislukt');
        sellOffUnitIdMap.set(sellOffUnit.id, data.id);
      }

      for (const acquisitionLink of acquisitionLinksRes.error ? [] : acquisitionLinksRes.data ?? []) {
        const newAcquisitionId = acquisitionComponentIdMap.get(acquisitionLink.acquisition_component_id);
        const newSellOffUnitId = sellOffUnitIdMap.get(acquisitionLink.sell_off_unit_id);
        if (!newAcquisitionId || !newSellOffUnitId) {
          throw new Error('Verkrijgingskoppeling kon niet veilig naar de gekopieerde records worden vertaald');
        }
        const payload = {
          ...stripCloneIdentity(acquisitionLink as unknown as Record<string, unknown>),
          scenario_id: duplicate.id,
          acquisition_component_id: newAcquisitionId,
          sell_off_unit_id: newSellOffUnitId,
        };
        const { error } = await untyped.from('calculation_acquisition_unit_links').insert(payload);
        if (error) throw new Error(error.message);
      }

      for (const risk of risksRes.data ?? []) {
        const payload = buildScenarioChildClone(
          risk as unknown as Record<string, unknown>,
          duplicate.id,
          componentIdMap,
        );
        const { error } = await supabase.from('risk_analysis').insert(payload as never);
        if (error) throw new Error(error.message);
      }

      for (const exitAssumption of exitRes.data ?? []) {
        const payload = buildScenarioChildClone(
          exitAssumption as unknown as Record<string, unknown>,
          duplicate.id,
          componentIdMap,
        );
        const { error } = await supabase.from('exit_assumptions').insert(payload as never);
        if (error) throw new Error(error.message);
      }
    } catch (error) {
      await rollback(error);
      return null;
    }

    toast.success(`Scenario gedupliceerd als “${duplicateName}”. Uitkomsten worden opnieuw berekend.`);
    await fetchAll();
    return duplicate;
  }, [calculation, scenarios, fetchAll]);

  return {
    calculation,
    scenarios,
    loading,
    refetch: fetchAll,
    updateCalculation,
    createScenario,
    updateScenario,
    deleteScenario,
    duplicateScenario,
  };
}

export function useScenarioChildren(scenarioId: string | undefined) {
  const [components, setComponents] = useState<Component[]>([]);
  const [acquisitionComponents, setAcquisitionComponents] = useState<AcquisitionComponent[]>([]);
  const [acquisitionUnitLinks, setAcquisitionUnitLinks] = useState<AcquisitionUnitLink[]>([]);
  const [acquisitionStructureStatus, setAcquisitionStructureStatus] = useState<AcquisitionStructureStatus>('available');
  const [acquisitionStructureError, setAcquisitionStructureError] = useState<string | null>(null);
  const [costs, setCosts] = useState<ScenarioCost[]>([]);
  const [wwsUnits, setWwsUnits] = useState<WwsUnit[]>([]);
  const [sellOffUnits, setSellOffUnits] = useState<SellOffUnit[]>([]);
  const [risks, setRisks] = useState<RiskItem[]>([]);
  const [output, setOutput] = useState<CalcOutput | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!scenarioId) return;
    setLoading(true);
    const untyped = supabase as unknown as { from: (table: string) => any };
    const [c, acq, acqLinks, k, w, so, r, o] = await Promise.all([
      supabase.from('calculation_components').select('*').eq('scenario_id', scenarioId).order('created_at'),
      untyped.from('calculation_acquisition_components').select('*').eq('scenario_id', scenarioId).order('sort_order').order('created_at'),
      untyped.from('calculation_acquisition_unit_links').select('*').eq('scenario_id', scenarioId).order('created_at'),
      supabase.from('scenario_costs').select('*').eq('scenario_id', scenarioId).order('created_at'),
      supabase.from('residential_wws_units').select('*').eq('scenario_id', scenarioId).order('created_at'),
      supabase.from('sell_off_units').select('*').eq('scenario_id', scenarioId).order('created_at'),
      supabase.from('risk_analysis').select('*').eq('scenario_id', scenarioId).order('created_at'),
      supabase.from('calculation_outputs').select('*').eq('scenario_id', scenarioId).maybeSingle(),
    ]);
    setComponents((c.data ?? []) as Component[]);
    const acquisitionError = acq.error ?? acqLinks.error;
    if (!acquisitionError) {
      setAcquisitionComponents((acq.data ?? []) as AcquisitionComponent[]);
      setAcquisitionUnitLinks((acqLinks.data ?? []) as AcquisitionUnitLink[]);
      setAcquisitionStructureStatus('available');
      setAcquisitionStructureError(null);
    } else {
      setAcquisitionComponents([]);
      setAcquisitionUnitLinks([]);
      if (isAcquisitionStructureMigrationMissing(acquisitionError)) {
        setAcquisitionStructureStatus('migration_required');
        setAcquisitionStructureError(null);
      } else {
        setAcquisitionStructureStatus('error');
        setAcquisitionStructureError(describeDbError(acquisitionError, {
          module: 'Vastgoedrekenen',
          section: 'Verkrijgingsstructuur',
          fallback: 'Verkrijgingsstructuur laden mislukt',
        }));
      }
    }
    setCosts((k.data ?? []) as ScenarioCost[]);
    setWwsUnits((w.data ?? []) as WwsUnit[]);
    setSellOffUnits((so.data ?? []) as SellOffUnit[]);
    setRisks((r.data ?? []) as RiskItem[]);
    setOutput((o.data as CalcOutput) ?? null);
    setLoading(false);
  }, [scenarioId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Generic helpers
  const upsertOutput = useCallback(async (payload: Partial<CalcOutput>) => {
    if (!scenarioId) return;
    const { error } = await supabase
      .from('calculation_outputs')
      .upsert({ scenario_id: scenarioId, ...payload }, { onConflict: 'scenario_id' });
    if (error) toast.error(mapDbError(error, 'Opslaan outputs mislukt'));
  }, [scenarioId]);

  // --- Verkrijgingsstructuur (feitelijke situatie bij aankoop) ---
  const recordAcquisitionError = useCallback((error: unknown, fallback: string): string => {
    if (isAcquisitionStructureMigrationMissing(error as { code?: string; message?: string; details?: string; hint?: string })) {
      setAcquisitionStructureStatus('migration_required');
      setAcquisitionStructureError(null);
      return acquisitionStructureStatusMessage('migration_required') as string;
    }
    const message = describeDbError(error as { code?: string; message?: string; details?: string; hint?: string }, {
      module: 'Vastgoedrekenen',
      section: 'Verkrijgingsstructuur',
      fallback,
    });
    setAcquisitionStructureStatus('error');
    setAcquisitionStructureError(message);
    return message;
  }, []);

  const createAcquisitionComponent = useCallback(async (patch: Partial<AcquisitionComponent> = {}) => {
    if (!scenarioId) return null;
    if (acquisitionStructureStatus !== 'available') {
      toast.error(acquisitionStructureStatusMessage(acquisitionStructureStatus, acquisitionStructureError) as string);
      return null;
    }
    const untyped = supabase as unknown as { from: (table: string) => any };
    const payload = {
      scenario_id: scenarioId,
      component_name: patch.component_name ?? 'Nieuw verkrijgingscomponent',
      component_type: patch.component_type ?? 'overig',
      transfer_tax_allocation_method: patch.transfer_tax_allocation_method ?? 'value',
      transfer_tax_classification: patch.transfer_tax_classification ?? null,
      sort_order: acquisitionComponents.length,
      ...patch,
    };
    const { data, error } = await untyped.from('calculation_acquisition_components').insert(payload).select('*').single();
    if (error) {
      toast.error(recordAcquisitionError(error, 'Verkrijgingscomponent aanmaken mislukt'));
      return null;
    }
    await fetchAll();
    return data as AcquisitionComponent;
  }, [scenarioId, acquisitionComponents.length, acquisitionStructureStatus, acquisitionStructureError, fetchAll, recordAcquisitionError]);

  const updateAcquisitionComponent = useCallback(async (id: string, patch: Partial<AcquisitionComponent>) => {
    const untyped = supabase as unknown as { from: (table: string) => any };
    const { error } = await untyped.from('calculation_acquisition_components').update(stripUndefinedEntries(patch)).eq('id', id);
    if (error) toast.error(recordAcquisitionError(error, 'Verkrijgingscomponent wijzigen mislukt'));
    else await fetchAll();
  }, [fetchAll, recordAcquisitionError]);

  const deleteAcquisitionComponent = useCallback(async (id: string) => {
    const untyped = supabase as unknown as { from: (table: string) => any };
    const { error } = await untyped.from('calculation_acquisition_components').delete().eq('id', id);
    if (error) toast.error(recordAcquisitionError(error, 'Verkrijgingscomponent verwijderen mislukt'));
    else await fetchAll();
  }, [fetchAll, recordAcquisitionError]);

  const setAcquisitionComponentLinks = useCallback(async (acquisitionComponentId: string, sellOffUnitIds: string[]) => {
    if (!scenarioId) return;
    const untyped = supabase as unknown as { from: (table: string) => any };
    const { error: deleteError } = await untyped
      .from('calculation_acquisition_unit_links')
      .delete()
      .eq('acquisition_component_id', acquisitionComponentId);
    if (deleteError) {
      toast.error(recordAcquisitionError(deleteError, 'Koppelingen wijzigen mislukt'));
      return;
    }
    if (sellOffUnitIds.length > 0) {
      const rows = sellOffUnitIds.map((sellOffUnitId) => ({
        scenario_id: scenarioId,
        acquisition_component_id: acquisitionComponentId,
        sell_off_unit_id: sellOffUnitId,
      }));
      const { error: insertError } = await untyped.from('calculation_acquisition_unit_links').insert(rows);
      if (insertError) {
        toast.error(recordAcquisitionError(insertError, 'Koppelingen opslaan mislukt'));
        await fetchAll();
        return;
      }
    }
    await fetchAll();
  }, [scenarioId, fetchAll, recordAcquisitionError]);

  // --- Componentstrategie (sell_off_units) ---
  const createStrategyUnit = useCallback(async (patch: Record<string, unknown> = {}) => {
    if (!scenarioId) {
      toast.error('Vastgoedrekenen › Componentstrategie: scenario_id ontbreekt. Selecteer of bewaar eerst een scenario.');
      return null;
    }
    const label = (patch.unit_label as string | undefined) ?? (patch.unit_name as string | undefined) ?? 'Unit';
    const payload = {
      scenario_id: scenarioId,
      unit_name: label,
      unit_label: label,
      strategy: 'later_beslissen',
      ...patch,
    };
    const { data, error } = await supabase.from('sell_off_units').insert(payload as never).select('*').single();
    if (error) {
      showAppErrorToast(error, { module: 'Vastgoedrekenen', section: 'Componentstrategie', record: label, action: 'Controleer naam, type en strategie.' });
      return null;
    }
    await fetchAll();
    return data as SellOffUnit;
  }, [scenarioId, fetchAll]);

  const updateStrategyUnit = useCallback(async (id: string, patch: Record<string, unknown>) => {
    const { error } = await supabase.from('sell_off_units').update(stripUndefinedEntries(patch) as never).eq('id', id);
    if (error) showAppErrorToast(error, { module: 'Vastgoedrekenen', section: 'Componentstrategie', action: 'Controleer ingevulde waarden.' });
    else await fetchAll();
  }, [fetchAll]);

  const deleteStrategyUnit = useCallback(async (id: string) => {
    const { error } = await supabase.from('sell_off_units').delete().eq('id', id);
    if (error) showAppErrorToast(error, { module: 'Vastgoedrekenen', section: 'Componentstrategie' });
    else await fetchAll();
  }, [fetchAll]);

  const importStrategyFromComponents = useCallback(async (mode: 'default' | 'hybrid' = 'default') => {
    if (!scenarioId) {
      toast.error('Vastgoedrekenen › Componentstrategie: scenario_id ontbreekt. Bewaar eerst het scenario.');
      return;
    }
    if (components.length === 0) {
      toast.info('Geen componenten om te importeren. Voeg eerst componenten toe.');
      return;
    }
    const { defaultStrategyForType, hybridStrategyForType } = await import('@/lib/vastgoedrekenen/componentStrategy');
    const pick = mode === 'hybrid' ? hybridStrategyForType : defaultStrategyForType;
    const existingIds = new Set(sellOffUnits.map((u) => (u as unknown as { component_id?: string }).component_id).filter(Boolean));
    const toImport = components.filter((c) => !existingIds.has(c.id));
    if (toImport.length === 0) {
      toast.info('Alle componenten zijn al geïmporteerd.');
      return;
    }

    // Importeer per rij zodat we exact kunnen melden welke component faalt
    // en niet-kritieke ontbrekende velden (oppervlakte, huur, …) niet blokkerend zijn.
    const successes: string[] = [];
    const failures: Array<{ name: string; message: string }> = [];
    const warnings: string[] = [];

    for (const c of toImport) {
      const label = c.component_name?.trim() || 'Naamloze component';
      const cRec = c as unknown as Record<string, unknown>;
      const strategy = pick(c.component_type);
      const isSale = ['verkopen_leeg','verkopen_verhuurd','renoveren_verkopen','splitsen_verkopen','transformeren_verkopen'].includes(strategy);

      // Verkoopwaarde: gebruik expected_sale_value_vacant (of _rented) als startpunt
      // voor sell-strategieën, zodat de strategie direct doorrekent.
      const saleVacant = Number((cRec.expected_sale_value_vacant as number | null) ?? 0);
      const saleRented = Number((cRec.expected_sale_value_rented as number | null) ?? 0);
      const allocated = Number((cRec.allocated_component_value as number | null) ?? 0);
      const salePriceTotal = saleVacant > 0
        ? saleVacant
        : saleRented > 0
          ? saleRented
          : allocated > 0 ? allocated : null;

      const row = {
        scenario_id: scenarioId,
        component_id: c.id,
        unit_name: label,
        unit_label: label,
        unit_type: c.component_type ?? 'overig',
        surface_gbo: c.surface_gbo ?? null,
        surface_vvo: c.surface_vvo ?? null,
        surface_bvo: c.surface_bvo ?? null,
        hold_monthly_rent: c.current_monthly_rent ?? null,
        hold_annual_rent: c.current_annual_rent ?? null,
        notes: (cRec.notes as string | null) ?? null,
        strategy,
        sale_price_source: isSale ? 'totaal' : null,
        sale_price_total: isSale ? salePriceTotal : null,
        hold_valuation_method: !isSale ? 'BAR' : null,
      };
      const { error } = await supabase.from('sell_off_units').insert(row as never);
      if (error) {
        failures.push({
          name: label,
          message: describeDbError(error, {
            module: 'Vastgoedrekenen',
            section: 'Componentstrategie › Importeer uit componenten',
            record: label,
          }),
        });
      } else {
        successes.push(label);
        if (!c.surface_gbo && !c.surface_vvo && !c.surface_bvo) warnings.push(`${label}: oppervlakte ontbreekt`);
        if (isSale && !salePriceTotal) warnings.push(`${label}: verkoopwaarde ontbreekt`);
        if (!isSale && !c.current_annual_rent && !c.current_monthly_rent) warnings.push(`${label}: huur ontbreekt voor aanhouden`);
      }
    }

    if (successes.length > 0) toast.success(`${successes.length} component(en) geïmporteerd.`);
    for (const f of failures) toast.error(f.message);
    if (warnings.length > 0) toast.warning(`Aanvullen aanbevolen:\n• ${warnings.slice(0, 5).join('\n• ')}${warnings.length > 5 ? `\n…en ${warnings.length - 5} meer` : ''}`);
    await fetchAll();
  }, [scenarioId, components, sellOffUnits, fetchAll]);

  return {
    components, acquisitionComponents, acquisitionUnitLinks, acquisitionStructureStatus,
    acquisitionStructureMessage: acquisitionStructureStatusMessage(acquisitionStructureStatus, acquisitionStructureError),
    costs, wwsUnits, sellOffUnits, risks, output, loading,
    refetch: fetchAll, upsertOutput,
    createAcquisitionComponent, updateAcquisitionComponent, deleteAcquisitionComponent, setAcquisitionComponentLinks,
    createStrategyUnit, updateStrategyUnit, deleteStrategyUnit, importStrategyFromComponents,
  };
}
