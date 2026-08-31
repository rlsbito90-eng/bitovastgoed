import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface UnifiedFeeRow {
  objectId: string;
  dealId?: string;
  feeSource: 'object' | 'deal';
  pipelineFee: number;
  realizedFee: number;
  objectForecastFeeReference?: number;
  dealFeeReference?: number;
}

const fromDb = (row: any): UnifiedFeeRow => ({
  objectId: row.object_id,
  dealId: row.deal_id ?? undefined,
  feeSource: row.fee_source === 'deal' ? 'deal' : 'object',
  pipelineFee: Number(row.pipeline_fee ?? 0),
  realizedFee: Number(row.realized_fee ?? 0),
  objectForecastFeeReference: row.object_forecast_fee_reference != null
    ? Number(row.object_forecast_fee_reference)
    : undefined,
  dealFeeReference: row.deal_fee_reference != null ? Number(row.deal_fee_reference) : undefined,
});

export function useUnifiedFeeReporting() {
  const [rows, setRows] = useState<UnifiedFeeRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await (supabase as any)
        .from('object_fee_reporting')
        .select('*');
      if (error) throw error;
      setRows((data ?? []).map(fromDb));
    } catch (err) {
      setError(err);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const stats = useMemo(() => ({
    pipelineBedrag: rows.reduce((sum, row) => sum + row.pipelineFee, 0),
    gerealiseerdBedrag: rows.reduce((sum, row) => sum + row.realizedFee, 0),
    objectForecastAantal: rows.filter(row => row.feeSource === 'object' && row.pipelineFee > 0).length,
    dealForecastAantal: rows.filter(row => row.feeSource === 'deal' && row.pipelineFee > 0).length,
    gerealiseerdAantal: rows.filter(row => row.realizedFee > 0).length,
  }), [rows]);

  return { rows, stats, loading, error, reload };
}
