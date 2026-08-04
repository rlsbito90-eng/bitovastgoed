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

const IDENTITY_COLUMNS = new Set([
  'bag_verblijfsobject_id',
  'bag_vbo_id',
  'bag_pand_id',
  'adres',
  'postcode',
  'plaats',
]);

export function preflightObjectIdentitySourceAdapters(
  schema: SourceAdapterSchemaSnapshot[],
): SourceAdapterPreflightResult {
  const byTable = new Map(schema.map(item => [item.table, new Set(item.columns)]));
  const issues: SourceAdapterPreflightIssue[] = [];

  for (const adapter of Object.values(OBJECT_IDENTITY_SOURCE_ADAPTERS)) {
    const columns = byTable.get(adapter.tableName);
    if (!columns) {
      issues.push({
        sourceType: adapter.sourceType,
        table: adapter.tableName,
        code: 'missing_table',
        detail: `Tabel ${adapter.tableName} ontbreekt.`,
      });
      continue;
    }

    if (!columns.has('id')) {
      issues.push({
        sourceType: adapter.sourceType,
        table: adapter.tableName,
        code: 'missing_required_column',
        detail: `Vereiste primaire sleutel id ontbreekt in ${adapter.tableName}.`,
      });
    }

    const availableIdentityColumns = adapter.selectedColumns.filter(
      column => IDENTITY_COLUMNS.has(column) && columns.has(column),
    );
    const hasFullAddress = ['adres', 'postcode', 'plaats'].every(column => columns.has(column));
    const hasBagIdentity = availableIdentityColumns.some(column => column.startsWith('bag_'));

    if (!hasBagIdentity && !hasFullAddress) {
      issues.push({
        sourceType: adapter.sourceType,
        table: adapter.tableName,
        code: 'no_identity_path',
        detail: 'Geen geldige BAG-route en geen volledig adrespad beschikbaar.',
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
