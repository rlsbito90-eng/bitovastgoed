import type { ObjectIdentitySourceType } from './sourceInventory';
import { OBJECT_IDENTITY_SOURCE_ADAPTERS } from './sourceAdapters';

export interface SourceInventoryExecutionStep {
  sourceType: ObjectIdentitySourceType;
  table: string;
  columns: string[];
  pageSize: number;
  maxRows: number;
  operation: 'select';
  readOnly: true;
  writes: 0;
  failureMode: 'isolate_source';
}

export interface SourceInventoryExecutionPlan {
  status: 'execution_plan_ready';
  readOnly: true;
  writes: 0;
  automaticMerges: 0;
  pageSize: number;
  maxRowsPerSource: number;
  steps: SourceInventoryExecutionStep[];
}

export function maakBroninventarisatieUitvoerplan(options?: {
  pageSize?: number;
  maxRowsPerSource?: number;
}): SourceInventoryExecutionPlan {
  const pageSize = options?.pageSize ?? 500;
  const maxRowsPerSource = options?.maxRowsPerSource ?? 100_000;

  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 1_000) {
    throw new Error('pageSize moet een geheel getal tussen 1 en 1000 zijn.');
  }
  if (!Number.isInteger(maxRowsPerSource) || maxRowsPerSource < 1) {
    throw new Error('maxRowsPerSource moet een positief geheel getal zijn.');
  }

  const steps = Object.values(OBJECT_IDENTITY_SOURCE_ADAPTERS).map(adapter => ({
    sourceType: adapter.sourceType,
    table: adapter.tableName,
    columns: [...adapter.selectedColumns],
    pageSize,
    maxRows: maxRowsPerSource,
    operation: 'select' as const,
    readOnly: true as const,
    writes: 0 as const,
    failureMode: 'isolate_source' as const,
  }));

  return {
    status: 'execution_plan_ready',
    readOnly: true,
    writes: 0,
    automaticMerges: 0,
    pageSize,
    maxRowsPerSource,
    steps,
  };
}

export function valideerBroninventarisatiePagina(
  expectedSource: ObjectIdentitySourceType,
  rows: unknown[],
  pageSize: number,
): { valid: true; rowCount: number } {
  if (!Array.isArray(rows)) throw new Error(`Ongeldige pagina voor ${expectedSource}.`);
  if (rows.length > pageSize) {
    throw new Error(`Pagina voor ${expectedSource} overschrijdt pageSize ${pageSize}.`);
  }
  return { valid: true, rowCount: rows.length };
}
