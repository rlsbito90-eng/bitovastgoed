// Data-hook voor de Vastgoedrekenen module.
import { mapDbError, showAppErrorToast, describeDbError } from '@/lib/errors';
// Beheert CRUD voor calculations, scenarios, components, costs, wws units, sell-off units,
// risk items en outputs voor een specifiek object.

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type {
  Calculation, Scenario, Component, ScenarioCost, WwsUnit,
  SellOffUnit, RiskItem, CalcOutput, TaxSettings,
} from '@/lib/vastgoedrekenen/types';
import { guardScenarioUpdatePatch, stripUndefinedEntries, type GuardedScenarioPatch } from '@/lib/vastgoedrekenen/saveGuards';
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
    if (error) { toast.error(mapDbError(error, 'Aanmaken mislukt')); return null; }
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
    if (error) toast.error(mapDbError(error, 'Opslaan outputs mislukt'));
  }, [scenarioId]);

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
    components, costs, wwsUnits, sellOffUnits, risks, output, loading,
    refetch: fetchAll, upsertOutput,
    createStrategyUnit, updateStrategyUnit, deleteStrategyUnit, importStrategyFromComponents,
  };
}
