import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { buildScenarioUnleveredCashflow } from '@/lib/vastgoedrekenen/scenarioUnleveredCashflow';
import type { Component, Scenario, ScenarioCost, SellOffUnit } from '@/lib/vastgoedrekenen/types';
import ScenarioDcfAnalysis from './ScenarioDcfAnalysis';

type Props = {
  units: SellOffUnit[];
  components: Component[];
};

type SavedOutput = {
  total_transfer_tax: number | null;
  total_acquisition_costs: number | null;
  total_costs: number | null;
  total_investment: number | null;
};

function scenarioIdFrom(props: Props): string | null {
  const fromUnit = (props.units[0] as unknown as { scenario_id?: string } | undefined)?.scenario_id;
  const fromComponent = (props.components[0] as unknown as { scenario_id?: string } | undefined)?.scenario_id;
  return fromUnit ?? fromComponent ?? null;
}

export default function ScenarioDcfWorkspace(props: Props) {
  const scenarioId = scenarioIdFrom(props);
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [costs, setCosts] = useState<ScenarioCost[]>([]);
  const [savedOutput, setSavedOutput] = useState<SavedOutput | null>(null);
  const [timeHorizonMonths, setTimeHorizonMonths] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!scenarioId) {
      setScenario(null);
      setCosts([]);
      setSavedOutput(null);
      setTimeHorizonMonths(null);
      return;
    }

    setLoading(true);
    const untyped = supabase as unknown as { from: (table: string) => any };
    const scenarioResult = await untyped
      .from('calculation_scenarios')
      .select('*')
      .eq('id', scenarioId)
      .maybeSingle();

    if (scenarioResult.error || !scenarioResult.data) {
      toast.error('DCF-analyse kon het opgeslagen scenario niet laden.');
      setLoading(false);
      return;
    }

    const [costResult, outputResult, analysisResult] = await Promise.all([
      untyped.from('scenario_costs').select('*').eq('scenario_id', scenarioId).order('created_at'),
      untyped.from('calculation_outputs').select('total_transfer_tax,total_acquisition_costs,total_costs,total_investment').eq('scenario_id', scenarioId).maybeSingle(),
      untyped.from('real_estate_calculations').select('time_horizon_months').eq('id', scenarioResult.data.calculation_id).maybeSingle(),
    ]);

    setScenario(scenarioResult.data as Scenario);
    setCosts((costResult.data ?? []) as ScenarioCost[]);
    setSavedOutput((outputResult.data as SavedOutput | null) ?? null);
    const horizon = Number(analysisResult.data?.time_horizon_months ?? Number.NaN);
    setTimeHorizonMonths(Number.isInteger(horizon) && horizon > 0 ? horizon : null);
    setLoading(false);
  }, [scenarioId]);

  useEffect(() => { void fetchAll(); }, [fetchAll]);

  const cashflow = useMemo(() => buildScenarioUnleveredCashflow({
    scenario: scenario ?? ({ purchase_price: null, financing_costs: null, unforeseen_percentage: null } as Scenario),
    costs,
    strategyUnits: props.units,
    timeHorizonMonths,
    savedOutput,
  }), [scenario, costs, props.units, timeHorizonMonths, savedOutput]);

  if (!scenarioId) return null;

  return (
    <ScenarioDcfAnalysis
      scenario={scenario}
      cashflow={cashflow}
      loading={loading}
      onSaved={fetchAll}
    />
  );
}
