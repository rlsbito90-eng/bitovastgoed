import type { BatchAdreslabelRij } from './batchAdreslabelRijen';
import type { BatchControlelijst } from './batchControlelijst';
import type { BatchDocumentPlan } from './batchDocumentPlan';
import type { BatchVoorbladModel } from './batchVoorblad';

export interface BatchProductiepakketManifest {
  batchId: string;
  batchnummer: string;
  documentversie: number;
  briefAantal: number;
  briefVersieIds: string[];
  documentBestanden: string[];
  gereedVoorRender: boolean;
  blokkades: string[];
}

/**
 * Verbindt de losse productiemodellen tot één deterministisch manifest.
 * Genereert of bewaart zelf geen bestanden en verandert geen batchstatus.
 */
export function bouwBatchProductiepakketManifest(input: {
  plan: BatchDocumentPlan;
  controlelijst: BatchControlelijst;
  voorblad: BatchVoorbladModel;
  labels: readonly BatchAdreslabelRij[];
}): BatchProductiepakketManifest {
  const blokkades: string[] = [];
  const { plan, controlelijst, voorblad, labels } = input;

  if (controlelijst.batchId !== plan.batchId) blokkades.push('Controlelijst hoort bij een andere batch.');
  if (controlelijst.batchnummer !== plan.batchnummer) blokkades.push('Controlelijst heeft een afwijkend batchnummer.');
  if (controlelijst.documentversie !== plan.documentversie) blokkades.push('Controlelijst heeft een afwijkende documentversie.');
  if (voorblad.batchnummer !== plan.batchnummer) blokkades.push('Voorblad heeft een afwijkend batchnummer.');
  if (voorblad.documentversie !== plan.documentversie) blokkades.push('Voorblad heeft een afwijkende documentversie.');
  if (controlelijst.totaal !== plan.briefAantal) blokkades.push('Briefaantal van controlelijst wijkt af van het documentplan.');
  if (labels.length !== plan.geadresseerdeAantal) blokkades.push('Aantal adreslabels wijkt af van het documentplan.');
  if (!voorblad.gereedVoorPrint) blokkades.push('Voorblad markeert de batch niet als printgereed.');

  const planIds = plan.documenten.find((document) => document.documenttype === 'brieven_pdf')?.briefVersieIds ?? [];
  const controleIds = controlelijst.rijen.map((rij) => rij.briefVersieId);
  const labelIds = labels.map((rij) => rij.briefVersieId);
  const uniek = (waarden: readonly string[]) => new Set(waarden).size === waarden.length;

  if (!uniek(planIds) || !uniek(controleIds) || !uniek(labelIds)) {
    blokkades.push('Productiepakket bevat dubbele briefversie-ID’s.');
  }
  if (JSON.stringify(planIds) !== JSON.stringify(controleIds)) {
    blokkades.push('Volgorde of inhoud van controlelijst wijkt af van het documentplan.');
  }
  if (JSON.stringify(planIds) !== JSON.stringify(labelIds)) {
    blokkades.push('Volgorde of inhoud van adreslabels wijkt af van het documentplan.');
  }

  const documentBestanden = plan.documenten.map((document) => document.bestandsnaam);
  if (!uniek(documentBestanden)) blokkades.push('Documentplan bevat dubbele bestandsnamen.');

  return {
    batchId: plan.batchId,
    batchnummer: plan.batchnummer,
    documentversie: plan.documentversie,
    briefAantal: plan.briefAantal,
    briefVersieIds: [...planIds],
    documentBestanden,
    gereedVoorRender: blokkades.length === 0,
    blokkades,
  };
}
