import { describe, expect, it } from 'vitest';
import { bouwObjectIdentityInventoryReport, type SourceExecutionResult } from './inventoryReport';
import type { ObjectIdentitySourceType, SourceInventorySummary } from './sourceInventory';

const sources: ObjectIdentitySourceType[] = [
  'vastgoedkans',
  'object',
  'off_market_signaal',
  'deal',
  'acquisitie_target',
];

function summary(sourceType: ObjectIdentitySourceType): SourceInventorySummary {
  return {
    sourceType,
    totaal: 10,
    metBagVerblijfsobjectId: sourceType === 'object' ? 2 : 4,
    metBagPandId: 1,
    metVolledigAdres: 8,
    metBestaandObjectId: 3,
    koppelbaar: 8,
    handmatigBeoordelen: 2,
  };
}

function result(sourceType: ObjectIdentitySourceType): SourceExecutionResult {
  return {
    sourceType,
    status: 'completed',
    rowsRead: 10,
    pagesRead: 1,
    summary: summary(sourceType),
    issues: [],
    errorCode: null,
  };
}

describe('Object-ID inventarisatierapportage', () => {
  it('levert report_ready voor vijf unieke afgeronde bronnen', () => {
    const report = bouwObjectIdentityInventoryReport(sources.map(result));
    expect(report.status).toBe('report_ready');
    expect(report.readOnly).toBe(true);
    expect(report.writes).toBe(0);
    expect(report.automaticMerges).toBe(0);
    expect(report.sourcesCompleted).toBe(5);
    expect(report.totals.rowsRead).toBe(50);
    expect(report.totals.bagVerrijkingNodig).toBe(5);
  });

  it('blokkeert wanneer een bron ontbreekt', () => {
    const report = bouwObjectIdentityInventoryReport(sources.slice(0, 4).map(result));
    expect(report.status).toBe('report_blocked');
    expect(report.stopReasons).toContain('Niet alle vijf unieke CRM-bronnen zijn gerapporteerd.');
  });

  it('blokkeert bij een mislukte bron en bewaart de foutisolatie', () => {
    const results = sources.map(result);
    results[2] = {
      ...results[2],
      status: 'failed',
      summary: null,
      errorCode: 'read_timeout',
    };
    const report = bouwObjectIdentityInventoryReport(results);
    expect(report.status).toBe('report_blocked');
    expect(report.sourcesFailed).toBe(1);
    expect(report.sourceResults[2].errorCode).toBe('read_timeout');
  });

  it('blokkeert een afgeronde bron zonder samenvatting', () => {
    const results = sources.map(result);
    results[0] = { ...results[0], summary: null };
    const report = bouwObjectIdentityInventoryReport(results);
    expect(report.status).toBe('report_blocked');
    expect(report.stopReasons.some(reason => reason.includes('mist een inventarisatiesamenvatting'))).toBe(true);
  });
});
