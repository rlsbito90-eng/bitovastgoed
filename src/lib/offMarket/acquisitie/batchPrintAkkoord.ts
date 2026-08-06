import type { BatchProductiepakketManifest } from './batchProductiepakket';

export interface BatchPrintAkkoordInput {
  manifest: BatchProductiepakketManifest;
  gecontroleerdDoor: string;
  gecontroleerdOp: string;
  explicietAkkoord: boolean;
}

export interface BatchPrintAkkoord {
  batchId: string;
  batchnummer: string;
  documentversie: number;
  akkoordVoorPrint: boolean;
  gecontroleerdDoor: string;
  gecontroleerdOp: string;
  blokkades: string[];
}

/**
 * Printen vereist altijd een expliciet menselijk akkoord op exact één
 * documentversie. Dit contract schrijft geen status en start geen printtaak.
 */
export function beoordeelBatchPrintAkkoord(input: BatchPrintAkkoordInput): BatchPrintAkkoord {
  const blokkades = [...input.manifest.blokkades];
  if (!input.manifest.gereedVoorRender) blokkades.push('Productiepakket is niet gereed voor rendering.');
  if (!input.gecontroleerdDoor.trim()) blokkades.push('Controleur ontbreekt.');
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(input.gecontroleerdOp)
      || !Number.isFinite(Date.parse(input.gecontroleerdOp))) {
    blokkades.push('Controletijdstip is geen geldig canoniek UTC-tijdstip.');
  }
  if (!input.explicietAkkoord) blokkades.push('Expliciet printakkoord ontbreekt.');

  return {
    batchId: input.manifest.batchId,
    batchnummer: input.manifest.batchnummer,
    documentversie: input.manifest.documentversie,
    akkoordVoorPrint: blokkades.length === 0,
    gecontroleerdDoor: input.gecontroleerdDoor.trim(),
    gecontroleerdOp: input.gecontroleerdOp,
    blokkades,
  };
}
