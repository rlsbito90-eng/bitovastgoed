import type { BatchControlelijst } from './batchControlelijst';
import type { PrintbatchContract } from './productiekernContract';
import { valideerPrintbatch } from './productiekernContract';

export interface BatchVoorbladModel {
  batchnummer: string;
  documentversie: number;
  status: PrintbatchContract['status'];
  briefAantal: number;
  nietGeverifieerdeAdressen: number;
  ontbrekendePdfs: number;
  gereedVoorPrint: boolean;
  waarschuwingen: string[];
}

export function bouwBatchVoorbladModel(
  batch: PrintbatchContract,
  controlelijst: BatchControlelijst,
): BatchVoorbladModel {
  const fouten = valideerPrintbatch(batch);
  if (fouten.length > 0) throw new Error(`Ongeldige printbatch: ${fouten.join(' ')}`);
  if (controlelijst.batchId !== batch.id) {
    throw new Error('Controlelijst hoort niet bij de opgegeven printbatch.');
  }
  if (controlelijst.batchnummer !== batch.batchnummer) {
    throw new Error('Batchnummer van controlelijst wijkt af.');
  }

  const waarschuwingen: string[] = [];
  if (controlelijst.nietGeverifieerd > 0) {
    waarschuwingen.push(`${controlelijst.nietGeverifieerd} adres(sen) zijn niet geverifieerd.`);
  }
  if (controlelijst.pdfOntbreekt > 0) {
    waarschuwingen.push(`${controlelijst.pdfOntbreekt} brief-PDF('s) ontbreken.`);
  }

  return {
    batchnummer: batch.batchnummer,
    documentversie: batch.documentversie,
    status: batch.status,
    briefAantal: controlelijst.totaal,
    nietGeverifieerdeAdressen: controlelijst.nietGeverifieerd,
    ontbrekendePdfs: controlelijst.pdfOntbreekt,
    gereedVoorPrint:
      (batch.status === 'documenten_gegenereerd' || batch.status === 'concept')
      && controlelijst.totaal > 0
      && waarschuwingen.length === 0,
    waarschuwingen,
  };
}
