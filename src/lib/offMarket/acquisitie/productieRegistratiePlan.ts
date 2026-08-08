import type { BriefversieContract, PrintbatchContract } from './productiekernContract';
import { isGeldigeBatchovergang } from './productiekernContract';

export interface PrintregistratiePlan {
  batchId: string;
  vanStatus: PrintbatchContract['status'];
  naarStatus: 'geprint';
  printdatum: string;
  verzenddatumBlijft: string | null;
  eventType: 'printed';
}

export interface PostregistratiePlan {
  batchId: string;
  briefId: string;
  briefVersieId: string;
  vanBatchstatus: PrintbatchContract['status'];
  naarBatchstatus: 'gedeeltelijk_gepost' | 'gepost';
  verzenddatum: string;
  printdatum: string;
  eventType: 'posted';
  opvolgingMagStarten: true;
}

function vereisIsoDatum(value: string, veld: string): void {
  const timestamp = Date.parse(value);
  if (!value.trim() || Number.isNaN(timestamp)) {
    throw new Error(`${veld} moet een geldige datum of datum-tijd zijn.`);
  }
}

/**
 * Plant een expliciete printregistratie. Deze functie schrijft niets en maakt
 * van printen nooit impliciet een verzending.
 */
export function bouwPrintregistratiePlan(input: {
  batch: PrintbatchContract;
  printdatum: string;
}): PrintregistratiePlan {
  vereisIsoDatum(input.printdatum, 'Printdatum');
  if (!isGeldigeBatchovergang(input.batch.status, 'geprint')) {
    throw new Error(`Batchstatus ${input.batch.status} mag niet naar geprint.`);
  }
  if (input.batch.verzenddatum) {
    throw new Error('Een batch met verzenddatum kan niet achteraf als uitsluitend geprint worden geregistreerd.');
  }

  return {
    batchId: input.batch.id,
    vanStatus: input.batch.status,
    naarStatus: 'geprint',
    printdatum: input.printdatum,
    verzenddatumBlijft: null,
    eventType: 'printed',
  };
}

/**
 * Plant verzending per briefversie. Opvolging mag pas vanaf dit expliciete
 * `posted`-moment starten; een printdatum alleen is onvoldoende.
 */
export function bouwPostregistratiePlan(input: {
  batch: PrintbatchContract;
  briefversie: BriefversieContract;
  verzenddatum: string;
  alleActieveBatchbrievenGepost: boolean;
}): PostregistratiePlan {
  vereisIsoDatum(input.verzenddatum, 'Verzenddatum');
  if (!input.batch.printdatum) {
    throw new Error('Een brief mag pas als gepost worden geregistreerd nadat de batch expliciet is geprint.');
  }
  if (input.briefversie.status !== 'actief') {
    throw new Error('Alleen de actieve briefversie mag als gepost worden geregistreerd.');
  }

  const naarBatchstatus = input.alleActieveBatchbrievenGepost
    ? 'gepost'
    : 'gedeeltelijk_gepost';
  if (!isGeldigeBatchovergang(input.batch.status, naarBatchstatus)) {
    throw new Error(`Batchstatus ${input.batch.status} mag niet naar ${naarBatchstatus}.`);
  }

  return {
    batchId: input.batch.id,
    briefId: input.briefversie.briefId,
    briefVersieId: input.briefversie.id,
    vanBatchstatus: input.batch.status,
    naarBatchstatus,
    verzenddatum: input.verzenddatum,
    printdatum: input.batch.printdatum,
    eventType: 'posted',
    opvolgingMagStarten: true,
  };
}
