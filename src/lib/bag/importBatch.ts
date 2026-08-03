import type { BagImportCheckpoint } from './importRun';

export interface BagImportBatchInvoer<T> {
  records: readonly T[];
  batchGrootte: number;
  startIndex?: number;
}

export interface BagImportBatchResultaat<T> {
  batches: Array<{
    batchIndex: number;
    startIndex: number;
    eindIndexExclusief: number;
    records: readonly T[];
  }>;
  checkpoint: BagImportCheckpoint;
}

export interface BagDryRunTellingen {
  ontvangen: number;
  verwerkt: number;
  geweigerd: number;
  perObjecttype: Record<string, number>;
  objecten: number;
  voorkomens: number;
  relaties: number;
  geometrieen: number;
}

export interface BagDryRunRapport {
  datasetVersie: string;
  scopeCode: string;
  tellingen: BagDryRunTellingen;
  waarschuwingen: string[];
  fouten: string[];
  fingerprint: string;
  hervatbaarVanaf: number | null;
}

function stabiel(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stabiel).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${stabiel(item)}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value);
}

export function maakImportBatches<T>(
  invoer: BagImportBatchInvoer<T>,
  bijgewerktOp = new Date(0).toISOString(),
): BagImportBatchResultaat<T> {
  if (!Number.isInteger(invoer.batchGrootte) || invoer.batchGrootte <= 0) {
    throw new Error('Batchgrootte moet een positief geheel getal zijn.');
  }
  const startIndex = invoer.startIndex ?? 0;
  if (!Number.isInteger(startIndex) || startIndex < 0 || startIndex > invoer.records.length) {
    throw new Error('Startindex valt buiten de invoer.');
  }

  const batches: BagImportBatchResultaat<T>['batches'] = [];
  for (let index = startIndex; index < invoer.records.length; index += invoer.batchGrootte) {
    const eindIndexExclusief = Math.min(index + invoer.batchGrootte, invoer.records.length);
    batches.push({
      batchIndex: batches.length,
      startIndex: index,
      eindIndexExclusief,
      records: invoer.records.slice(index, eindIndexExclusief),
    });
  }

  return {
    batches,
    checkpoint: {
      fase: 'parsen',
      cursor: batches.length ? String(batches.at(-1)?.eindIndexExclusief ?? startIndex) : String(startIndex),
      verwerkteRecords: Math.max(0, invoer.records.length - startIndex),
      geweigerdeRecords: 0,
      voltooid: true,
      bijgewerktOp,
    },
  };
}

export function dryRunFingerprint(rapport: Omit<BagDryRunRapport, 'fingerprint'>): string {
  return stabiel({
    datasetVersie: rapport.datasetVersie,
    scopeCode: rapport.scopeCode,
    tellingen: rapport.tellingen,
    waarschuwingen: [...rapport.waarschuwingen].sort(),
    fouten: [...rapport.fouten].sort(),
    hervatbaarVanaf: rapport.hervatbaarVanaf,
  });
}

export function maakDryRunRapport(
  invoer: Omit<BagDryRunRapport, 'fingerprint'>,
): BagDryRunRapport {
  return { ...invoer, fingerprint: dryRunFingerprint(invoer) };
}
