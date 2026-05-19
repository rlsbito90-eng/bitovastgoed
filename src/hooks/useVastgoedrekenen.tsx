// Data-hook voor de Vastgoedrekenen module.
// Beheert CRUD voor calculations, scenarios, components, costs, wws units, sell-off units,
// risk items en outputs voor een specifiek object.

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type {
  Calculation, Scenario, Component, ScenarioCost, WwsUnit,
  SellOffUnit, RiskItem, CalcOutput, TaxSettings,
} from '@/lib/vastgoedrekenen/types';
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
    if (error) { toast.error('Wijzigen mislukt: ' + error.message); return; }
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

  const create = useCallback(async (input: Partial<Calculation>) => {
    if (!objectId) return null;
    const { data: userData } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from('real_estate_calculations')
      .insert({
        object_id: objectId,
        calculation_name: input.calculation_name ?? 'Nieuwe quickscan',
        status: input.status ?? 'concept',
        main_strategy: input.main_strategy ?? 'belegging',
        object_type: input.object_type ?? 'enkelvoudig',
        input_reliability: input.input_reliability ?? 'laag',
        notes: input.notes ?? null,
        created_by: userData.user?.id ?? null,
      })
      .select('*')
      .single();
    if (error) { toast.error('Aanmaken mislukt: ' + error.message); return null; }
    toast.success('Quickscan aangemaakt');
    await fetchAll();
    return data as Calculation;
  }, [objectId, fetchAll]);

  const update = useCallback(async (id: string, patch: Partial<Calculation>) => {
    const { error } = await supabase.from('real_estate_calculations').update(patch).eq('id', id);
    if (error) toast.error('Wijzigen mislukt');
    else await fetchAll();
  }, [fetchAll]);

  const remove = useCallback(async (id: string) => {
    const { error } = await supabase.from('real_estate_calculations').delete().eq('id', id);
    if (error) toast.error('Verwijderen mislukt');
    else { toast.success('Quickscan verwijderd'); await fetchAll(); }
  }, [fetchAll]);

  return { calculations, loading, refetch: fetchAll, create, update, remove };
}

export function useQuickscanDetail(calculationId: string | undefined) {
  const [calculation, setCalculation] = useState<Calculation | null>(null);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!calculationId) return;
    setLoading(true);
    const [cRes, sRes] = await Promise.all([
      supabase.from('real_estate_calculations').select('*').eq('id', calculationId).maybeSingle(),
      supabase.from('calculation_scenarios').select('*').eq('calculation_id', calculationId).order('created_at', { ascending: true }),
    ]);
    if (cRes.error) toast.error('Kon quickscan niet laden');
    setCalculation((cRes.data as Calculation) ?? null);
    setScenarios((sRes.data ?? []) as Scenario[]);
    setLoading(false);
  }, [calculationId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const updateCalculation = useCallback(async (patch: Partial<Calculation>) => {
    if (!calculationId) return;
    const { error } = await supabase.from('real_estate_calculations').update(patch).eq('id', calculationId);
    if (error) toast.error('Opslaan mislukt');
    else await fetchAll();
  }, [calculationId, fetchAll]);

  const createScenario = useCallback(async (input: Partial<Scenario>) => {
    if (!calculation) return null;
    const { data, error } = await supabase
      .from('calculation_scenarios')
      .insert({
        calculation_id: calculation.id,
        object_id: calculation.object_id,
        scenario_name: input.scenario_name ?? 'Nieuw scenario',
        strategy_type: input.strategy_type ?? calculation.main_strategy,
        status: input.status ?? 'concept',
        ...input,
      })
      .select('*')
      .single();
    if (error) { toast.error('Scenario aanmaken mislukt: ' + error.message); return null; }
    await fetchAll();
    return data as Scenario;
  }, [calculation, fetchAll]);

  const updateScenario = useCallback(async (id: string, patch: Partial<Scenario>) => {
    const { error } = await supabase.from('calculation_scenarios').update(patch).eq('id', id);
    if (error) toast.error('Opslaan mislukt');
    else await fetchAll();
  }, [fetchAll]);

  const deleteScenario = useCallback(async (id: string) => {
    const { error } = await supabase.from('calculation_scenarios').delete().eq('id', id);
    if (error) toast.error('Verwijderen mislukt');
    else { toast.success('Scenario verwijderd'); await fetchAll(); }
  }, [fetchAll]);

  return { calculation, scenarios, loading, refetch: fetchAll, updateCalculation, createScenario, updateScenario, deleteScenario };
}

export function useScenarioChildren(scenarioId: string | undefined) {
  const [components, setComponents] = useState<Component[]>([]);
  const [costs, setCosts] = useState<ScenarioCost[]>([]);
  const [wwsUnits, setWwsUnits] = useState<WwsUnit[]>([]);
  const [sellOffUnits, setSellOffUnits] = useState<SellOffUnit[]>([]);
  const [risks, setRisks] = useState<RiskItem[]>([]);
  const [output, setOutput] = useState<CalcOutput | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!scenarioId) return;
    setLoading(true);
    const [c, k, w, so, r, o] = await Promise.all([
      supabase.from('calculation_components').select('*').eq('scenario_id', scenarioId).order('created_at'),
      supabase.from('scenario_costs').select('*').eq('scenario_id', scenarioId).order('created_at'),
      supabase.from('residential_wws_units').select('*').eq('scenario_id', scenarioId).order('created_at'),
      supabase.from('sell_off_units').select('*').eq('scenario_id', scenarioId).order('created_at'),
      supabase.from('risk_analysis').select('*').eq('scenario_id', scenarioId).order('created_at'),
      supabase.from('calculation_outputs').select('*').eq('scenario_id', scenarioId).maybeSingle(),
    ]);
    setComponents((c.data ?? []) as Component[]);
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
    if (error) toast.error('Opslaan outputs mislukt: ' + error.message);
  }, [scenarioId]);

  return {
    components, costs, wwsUnits, sellOffUnits, risks, output, loading,
    refetch: fetchAll, upsertOutput,
  };
}
