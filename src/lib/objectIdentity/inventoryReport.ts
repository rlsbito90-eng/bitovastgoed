import type { ObjectIdentitySourceType, SourceInventoryIssue, SourceInventorySummary } from './sourceInventory';

export interface SourceExecutionResult {
  sourceType: ObjectIdentitySourceType;
  status: 'completed' | 'blocked' | 'failed';
  rowsRead: number;
  pagesRead: number;
  summary: SourceInventorySummary | null;
  issues: SourceInventoryIssue[];
  errorCode: string | null;
}

export interface ObjectIdentityInventoryReport {
  status: 'report_ready' | 'report_blocked';
  readOnly: true;
  writes: 0;
  automaticMerges: 0;
  sourcesCompleted: number;
  sourcesBlocked: number;
  sourcesFailed: number;
  totals: {
    rowsRead: number;
    koppelbaar: number;
    viaBag: number;
    viaAdresFallback: number;
    bagVerrijkingNodig: number;
    handmatigBeoordelen: number;
  };
  sourceResults: SourceExecutionResult[];
  stopReasons: string[];
}

const EXPECTED_SOURCE_COUNT = 5;

export function bouwObjectIdentityInventoryReport(
  sourceResults: SourceExecutionResult[],
): ObjectIdentityInventoryReport {
  const sourceTypes = new Set(sourceResults.map(result => result.sourceType));
  const stopReasons: string[] = [];

  if (sourceResults.length !== EXPECTED_SOURCE_COUNT || sourceTypes.size !== EXPECTED_SOURCE_COUNT) {
    stopReasons.push('Niet alle vijf unieke CRM-bronnen zijn gerapporteerd.');
  }

  for (const result of sourceResults) {
    if (result.status !== 'completed') {
      stopReasons.push(`${result.sourceType} eindigde met status ${result.status}.`);
    }
    if (!Number.isInteger(result.rowsRead) || result.rowsRead < 0) {
      stopReasons.push(`${result.sourceType} heeft een ongeldige rijtelling.`);
    }
    if (!Number.isInteger(result.pagesRead) || result.pagesRead < 0) {
      stopReasons.push(`${result.sourceType} heeft een ongeldige paginatelling.`);
    }
    if (result.status === 'completed' && !result.summary) {
      stopReasons.push(`${result.sourceType} mist een inventarisatiesamenvatting.`);
    }
  }

  const summaries = sourceResults.flatMap(result => result.summary ? [result.summary] : []);
  const viaBag = summaries.reduce(
    (sum, item) => sum + item.metBagVerblijfsobjectId + item.metBagPandId,
    0,
  );
  const viaAdresFallback = summaries.reduce(
    (sum, item) => sum + Math.max(0, item.metVolledigAdres - item.metBagVerblijfsobjectId - item.metBagPandId),
    0,
  );
  const objectSummary = summaries.find(item => item.sourceType === 'object');
  const bagVerrijkingNodig = objectSummary
    ? Math.max(0, objectSummary.metVolledigAdres - objectSummary.metBagVerblijfsobjectId - objectSummary.metBagPandId)
    : 0;

  return {
    status: stopReasons.length === 0 ? 'report_ready' : 'report_blocked',
    readOnly: true,
    writes: 0,
    automaticMerges: 0,
    sourcesCompleted: sourceResults.filter(result => result.status === 'completed').length,
    sourcesBlocked: sourceResults.filter(result => result.status === 'blocked').length,
    sourcesFailed: sourceResults.filter(result => result.status === 'failed').length,
    totals: {
      rowsRead: sourceResults.reduce((sum, result) => sum + Math.max(0, result.rowsRead), 0),
      koppelbaar: summaries.reduce((sum, item) => sum + item.koppelbaar, 0),
      viaBag,
      viaAdresFallback,
      bagVerrijkingNodig,
      handmatigBeoordelen: summaries.reduce((sum, item) => sum + item.handmatigBeoordelen, 0),
    },
    sourceResults,
    stopReasons,
  };
}
