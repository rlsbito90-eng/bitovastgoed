import type {
  Batchdocumenttype,
  BriefversieContract,
  PrintbatchContract,
} from './productiekernContract';
import {
  magBatchdocumentenRegenereren,
  valideerBriefversie,
  valideerPrintbatch,
} from './productiekernContract';

export interface BatchBriefInvoer {
  briefnummer: string;
  versie: BriefversieContract;
}

export interface BatchDocumentPlanItem {
  documenttype: Batchdocumenttype;
  bestandsnaam: string;
  documentversie: number;
  briefVersieIds: string[];
}

export interface BatchDocumentPlan {
  batchId: string;
  batchnummer: string;
  documentversie: number;
  briefAantal: number;
  geadresseerdeAantal: number;
  documenten: BatchDocumentPlanItem[];
  waarschuwingen: string[];
}

function veiligeBestandsstam(value: string): string {
  return value.replace(/[^A-Z0-9_-]/gi, '-');
}

/**
 * Maakt uitsluitend een deterministisch plan voor batchdocumenten.
 * De functie genereert geen PDF/CSV, schrijft niet naar Storage en verandert
 * geen batch- of briefstatus.
 */
export function bouwBatchDocumentPlan(input: {
  batch: PrintbatchContract;
  brieven: BatchBriefInvoer[];
}): BatchDocumentPlan {
  const batchFouten = valideerPrintbatch(input.batch);
  if (batchFouten.length > 0) {
    throw new Error(`Ongeldige printbatch: ${batchFouten.join(' ')}`);
  }
  if (!magBatchdocumentenRegenereren(input.batch.status)) {
    throw new Error(`Batchdocumenten mogen niet worden gegenereerd bij status ${input.batch.status}.`);
  }
  if (input.brieven.length === 0) {
    throw new Error('Een documentplan vereist minimaal één briefversie.');
  }

  const gezien = new Set<string>();
  const waarschuwingen: string[] = [];
  const gesorteerd = [...input.brieven].sort((a, b) => {
    const nummer = a.briefnummer.localeCompare(b.briefnummer);
    return nummer !== 0 ? nummer : a.versie.id.localeCompare(b.versie.id);
  });

  for (const item of gesorteerd) {
    const fouten = valideerBriefversie(item.versie);
    if (fouten.length > 0) {
      throw new Error(`Ongeldige briefversie ${item.versie.id}: ${fouten.join(' ')}`);
    }
    if (item.versie.status !== 'actief') {
      throw new Error(`Alleen actieve briefversies mogen in een nieuw documentplan: ${item.versie.id}.`);
    }
    if (gezien.has(item.versie.id)) {
      throw new Error(`Briefversie dubbel in batchdocumentplan: ${item.versie.id}.`);
    }
    gezien.add(item.versie.id);
    if (!item.briefnummer.trim()) waarschuwingen.push(`Briefversie ${item.versie.id} mist een briefnummer.`);
  }

  const stam = veiligeBestandsstam(input.batch.batchnummer);
  const suffix = `v${input.batch.documentversie}`;
  const briefVersieIds = gesorteerd.map(item => item.versie.id);
  const documenten: BatchDocumentPlanItem[] = [
    {
      documenttype: 'batchvoorblad',
      bestandsnaam: `${stam}-${suffix}-voorblad.pdf`,
      documentversie: input.batch.documentversie,
      briefVersieIds,
    },
    {
      documenttype: 'controlelijst',
      bestandsnaam: `${stam}-${suffix}-controlelijst.pdf`,
      documentversie: input.batch.documentversie,
      briefVersieIds,
    },
    {
      documenttype: 'brieven_pdf',
      bestandsnaam: `${stam}-${suffix}-brieven.pdf`,
      documentversie: input.batch.documentversie,
      briefVersieIds,
    },
    {
      documenttype: 'adreslabels',
      bestandsnaam: `${stam}-${suffix}-adreslabels.csv`,
      documentversie: input.batch.documentversie,
      briefVersieIds,
    },
  ];

  return {
    batchId: input.batch.id,
    batchnummer: input.batch.batchnummer,
    documentversie: input.batch.documentversie,
    briefAantal: gesorteerd.length,
    geadresseerdeAantal: gesorteerd.length,
    documenten,
    waarschuwingen,
  };
}
