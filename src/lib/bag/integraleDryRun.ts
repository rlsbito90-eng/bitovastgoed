import type { BagOfficieelAdapterRecord } from './officieleXmlRecordAdapter';
import { maakDryRunRapport, maakImportBatches, type BagDryRunRapport } from './importBatch';
import { bouwBagStagingModel, type BagStagingModel } from './stagingModel';

export interface BagIntegraleDryRunInvoer {
  datasetVersie: string;
  scopeCode: string;
  records: readonly BagOfficieelAdapterRecord[];
  batchGrootte: number;
  startIndex?: number;
}

export interface BagIntegraleDryRunResultaat {
  staging: BagStagingModel;
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
  const voorkomens = verwerkteRecords.map(record => ({
    objecttype: record.objecttype,
    identificatie: record.identificatie,
    voorkomenidentificatie: record.voorkomen.voorkomenidentificatie,
    beginGeldigheid: record.voorkomen.beginGeldigheid,
    eindGeldigheid: record.voorkomen.eindGeldigheid,
    tijdstipRegistratie: record.voorkomen.tijdstipRegistratie,
    eindRegistratie: record.voorkomen.eindRegistratie,
    tijdstipInactief: record.voorkomen.tijdstipInactief ?? record.voorkomen.tijdstipInactiefLV,
    status: record.status,
    relaties: record.relaties,
    velden: record.velden,
    geometrie: record.geometrie.crs === 'EPSG:28992' && record.geometrie.dimensie
      ? {
          crs: record.geometrie.crs,
          dimensie: record.geometrie.dimensie,
          coordinaten: record.geometrie.coordinaten,
        }
      : null,
  }));
  const staging = bouwBagStagingModel(voorkomens);

  const perObjecttype = verwerkteRecords.reduce<Record<string, number>>((acc, record) => {
    acc[record.objecttype] = (acc[record.objecttype] ?? 0) + 1;
    return acc;
  }, {});
  const fouten = staging.fouten.map(fout => `${fout.code}:${fout.identificatie}:${fout.reden}`);

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
