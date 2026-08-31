export interface UnifiedFeeRecord {
  objectId: string;
  dealId?: string;
  feeSource: 'object' | 'deal';
  pipelineFee: number;
  realizedFee: number;
  realizedAt?: string;
  objectForecastFeeReference?: number;
  dealFeeReference?: number;
}

export interface UnifiedFeeStats {
  pipelineBedrag: number;
  gerealiseerdBedrag: number;
  objectForecastAantal: number;
  dealForecastAantal: number;
  gerealiseerdAantal: number;
}

/**
 * Summarizes the canonical one-row-per-object fee projection.
 * Reference amounts are deliberately never added to totals: they exist only
 * for traceability when the economic source shifts from Object to Deal.
 */
export function summarizeUnifiedFees(
  rows: UnifiedFeeRecord[],
  realizedYear: number,
): UnifiedFeeStats {
  const realizedRows = rows.filter(row => {
    if (row.realizedFee <= 0 || !row.realizedAt) return false;
    return new Date(row.realizedAt).getFullYear() === realizedYear;
  });

  return {
    pipelineBedrag: rows.reduce((sum, row) => sum + Math.max(0, row.pipelineFee || 0), 0),
    gerealiseerdBedrag: realizedRows.reduce((sum, row) => sum + Math.max(0, row.realizedFee || 0), 0),
    objectForecastAantal: rows.filter(row => row.feeSource === 'object' && row.pipelineFee > 0).length,
    dealForecastAantal: rows.filter(row => row.feeSource === 'deal' && row.pipelineFee > 0).length,
    gerealiseerdAantal: realizedRows.length,
  };
}
