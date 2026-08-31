import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  summarizeUnifiedFees,
  type UnifiedFeeRecord,
} from '@/lib/lifecycle/feeReporting';

/**
 * Reads the database-level one-fee-per-object projection.
 *
 * Contract:
 * - before preferred bidder / exclusivity: Object forecast is pipeline;
 * - from preferred bidder / exclusivity: concrete Deal fee is pipeline;
 * - after closed won: the same Deal fee is realized and no longer pipeline;
 * - legacy candidate Deal rows do not suppress Object forecasts.
 */
export interface UnifiedFeeRow extends UnifiedFeeRecord {}

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

  const stats = useMemo(
    () => summarizeUnifiedFees(rows, realizedYear),
    [rows, realizedYear],
  );

  return { rows, stats, loading, error, reload };
}
