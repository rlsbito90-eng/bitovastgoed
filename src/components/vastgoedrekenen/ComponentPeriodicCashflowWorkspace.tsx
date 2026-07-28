import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { buildComponentPeriodicCashflow } from '@/lib/vastgoedrekenen/componentPeriodicCashflow';
import type { SellOffUnit } from '@/lib/vastgoedrekenen/types';
import ComponentPeriodicCashflowPreview from './ComponentPeriodicCashflowPreview';

type Props = {
  units: SellOffUnit[];
  /** Testoverride; productie leest de horizon read-only via het scenario. */
  timeHorizonMonthsOverride?: number | null;
};

export default function ComponentPeriodicCashflowWorkspace({
  units,
  timeHorizonMonthsOverride,
}: Props) {
  const [loadedHorizon, setLoadedHorizon] = useState<number | null>(null);
  const [horizonLoading, setHorizonLoading] = useState(false);
  const scenarioId = (units[0] as unknown as { scenario_id?: string } | undefined)?.scenario_id ?? null;
  const timeHorizonMonths = timeHorizonMonthsOverride !== undefined
    ? timeHorizonMonthsOverride
    : loadedHorizon;

  useEffect(() => {
    if (timeHorizonMonthsOverride !== undefined || !scenarioId) return;

    let cancelled = false;
    const untyped = supabase as unknown as { from: (table: string) => any };

    async function loadHorizon() {
      setHorizonLoading(true);
      const scenarioResult = await untyped
        .from('calculation_scenarios')
        .select('calculation_id')
        .eq('id', scenarioId)
        .maybeSingle();

      if (cancelled) return;
      if (scenarioResult.error || !scenarioResult.data?.calculation_id) {
        setLoadedHorizon(null);
        setHorizonLoading(false);
        return;
      }

      const analysisResult = await untyped
        .from('real_estate_calculations')
        .select('time_horizon_months')
        .eq('id', scenarioResult.data.calculation_id)
        .maybeSingle();

      if (cancelled) return;
      const value = Number(analysisResult.data?.time_horizon_months ?? Number.NaN);
      setLoadedHorizon(Number.isFinite(value) && value > 0 ? value : null);
      setHorizonLoading(false);
    }

    void loadHorizon();
    return () => {
      cancelled = true;
    };
  }, [scenarioId, timeHorizonMonthsOverride]);

  const result = useMemo(
    () => buildComponentPeriodicCashflow(units, timeHorizonMonths),
    [units, timeHorizonMonths],
  );

  if (units.length === 0) return null;

  return (
    <ComponentPeriodicCashflowPreview
      result={result}
      horizonLoading={horizonLoading}
    />
  );
}
