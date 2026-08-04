import { OBJECT_IDENTITY_SOURCE_ADAPTERS } from './sourceAdapters';

export interface SourceAdapterSchemaSnapshot {
  table: string;
  columns: string[];
}

export interface SourceAdapterPreflightIssue {
  sourceType: string;
  table: string;
  code: 'missing_table' | 'missing_required_column' | 'no_identity_path';
  detail: string;
}

export interface SourceAdapterPreflightResult {
  status: 'preflight_ready' | 'preflight_blocked';
  readOnly: true;
  writes: 0;
  issues: SourceAdapterPreflightIssue[];
}

export function preflightObjectIdentitySourceAdapters(
  schema: SourceAdapterSchemaSnapshot[],
): SourceAdapterPreflightResult {
  const byTable = new Map(schema.map(item => [item.table, new Set(item.columns)]));
  const issues: SourceAdapterPreflightIssue[] = [];

  for (const adapter of OBJECT_IDENTITY_SOURCE_ADAPTERS) {
    const columns = byTable.get(adapter.table);
    if (!columns) {
      issues.push({
        sourceType: adapter.sourceType,
        table: adapter.table,
        code: 'missing_table',
        detail: `Tabel ${adapter.table} ontbreekt.`,
      });
      continue;
    }

    for (const required of adapter.requiredColumns) {
      if (!columns.has(required)) {
        issues.push({
          sourceType: adapter.sourceType,
          table: adapter.table,
          code: 'missing_required_column',
          detail: `Vereiste kolom ${required} ontbreekt in ${adapter.table}.`,
        });
      }
    }

    const identityCandidates = [
      ...adapter.bagVerblijfsobjectColumns,
      ...adapter.bagPandColumns,
      ...adapter.addressColumns,
    ];
    if (!identityCandidates.some(column => columns.has(column))) {
      issues.push({
        sourceType: adapter.sourceType,
        table: adapter.table,
        code: 'no_identity_path',
        detail: 'Geen BAG- of adreskolom beschikbaar voor onafhankelijke objectidentiteit.',
      });
    }
  }

  return {
    status: issues.length === 0 ? 'preflight_ready' : 'preflight_blocked',
    readOnly: true,
    writes: 0,
    issues,
  };
}
