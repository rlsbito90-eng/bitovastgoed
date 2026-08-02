import type { BagOfficieelRecord } from './officieleXmlRecordAdapter';
import { maakDryRunRapport, maakImportBatches, type BagDryRunRapport } from './importBatch';
import { bouwStagingDataset, type BagStagingDataset } from './stagingModel';

export interface BagIntegraleDryRunInvoer {
  datasetVersie: string;
  scopeCode: string;
  records: readonly BagOfficieelRecord[];
  batchGrootte: number;
  startIndex?: number;
}

export interface BagIntegraleDryRunResultaat {
  staging: BagStagingDataset;
  rapport: BagDryRunRapport;
  batches: number;
}

export function voerIntegraleBagDryRunUit(invoer: BagIntegraleDryRunInvoer): BagIntegraleDryRunResultaat {
  const batchResultaat = maakImportBatches({
    records: invoer.records,
    batchGrootte: invoer.batchGrootte,
    startIndex: invoer.startIndex,
  });
  const verwerkteRecords = batchResultaat.batches.flatMap(batch => [...batch.records]);
  const staging = bouwStagingDataset(verwerkteRecords);

  const perObjecttype = verwerkteRecords.reduce<Record<string, number>>((acc, record) => {
    acc[record.objecttype] = (acc[record.objecttype] ?? 0) + 1;
    return acc;
  }, {});
  const fouten = staging.fouten.map(fout => `${fout.code}:${fout.identificatie ?? ''}:${fout.reden}`);

  const rapport = maakDryRunRapport({
    datasetVersie: invoer.datasetVersie,
    scopeCode: invoer.scopeCode,
    tellingen: {
      ontvangen: invoer.records.length,
      verwerkt: verwerkteRecords.length,
      geweigerd: staging.fouten.length,
      perObjecttype,
      objecten: staging.objecten.length,
      voorkomens: staging.voorkomens.length,
      relaties: staging.relaties.length,
      geometrieen: staging.geometrieen.length,
    },
    waarschuwingen: [],
    fouten,
    hervatbaarVanaf: batchResultaat.checkpoint.voltooid
      ? null
      : Number(batchResultaat.checkpoint.cursor ?? 0),
  });

  return { staging, rapport, batches: batchResultaat.batches.length };
}
