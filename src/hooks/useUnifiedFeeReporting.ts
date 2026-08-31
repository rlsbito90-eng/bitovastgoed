import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface UnifiedFeeRow {
  objectId: string;
  dealId?: string;
  feeSource: 'object' | 'deal';
  pipelineFee: number;
  realizedFee: number;
  realizedAt?: string;
  objectForecastFeeReference?: number;
  dealFeeReference?: number;
}

const fromDb = (row: any): UnifiedFeeRow => ({
  objectId: row.object_id,
  dealId: row.deal_id ?? undefined,
  feeSource: row.fee_source === 'deal' ? 'deal' : 'object',
  pipelineFee: Number(row.pipeline_fee ?? 0),
  realizedFee: Number(row.realized_fee ?? 0),
  realizedAt: row.realized_at ?? undefined,
  objectForecastFeeReference: row.object_forecast_fee_reference != null
    ? Number(row.object_forecast_fee_reference)
    : undefined,
  dealFeeReference: row.deal_fee_reference != null ? Number(row.deal_fee_reference) : undefined,
});

export function useUnifiedFeeReporting(realizedYear = new Date().getFullYear()) {
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

  const stats = useMemo(() => {
    const realizedRows = rows.filter(row => {
      if (row.realizedFee <= 0 || !row.realizedAt) return false;
      return new Date(row.realizedAt).getFullYear() === realizedYear;
    });

    return {
      pipelineBedrag: rows.reduce((sum, row) => sum + row.pipelineFee, 0),
      gerealiseerdBedrag: realizedRows.reduce((sum, row) => sum + row.realizedFee, 0),
      objectForecastAantal: rows.filter(row => row.feeSource === 'object' && row.pipelineFee > 0).length,
      dealForecastAantal: rows.filter(row => row.feeSource === 'deal' && row.pipelineFee > 0).length,
      gerealiseerdAantal: realizedRows.length,
    };
  }, [rows, realizedYear]);

  return { rows, stats, loading, error, reload };
}
