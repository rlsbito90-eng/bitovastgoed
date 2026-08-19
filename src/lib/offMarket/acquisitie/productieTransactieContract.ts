import type {
  BatchdocumentContract,
  BriefContract,
  BriefversieContract,
  PrintbatchContract,
} from './productiekernContract';
import type { BatchDocumentPlan } from './batchDocumentPlan';

export type ProductieTransactieActie =
  | 'brief_definitief_maken'
  | 'batch_documenten_registreren'
  | 'batch_documentversie_vernieuwen'
  | 'batch_geprint_markeren'
  | 'brief_gepost_markeren';

export interface TransactieContext {
  actorId: string;
  operationKey: string;
  verwachtVersienummer: number;
  uitgevoerdOp: string;
}

export interface BriefDefinitiefMakenInput extends TransactieContext {
  actie: 'brief_definitief_maken';
  brief: BriefContract;
  actieveVersie: BriefversieContract;
  /** Jaar waarbinnen de database atomisch het volgende BR-nummer reserveert. */
  jaar: number;
}

export interface BatchDocumentenRegistrerenInput extends TransactieContext {
  actie: 'batch_documenten_registreren';
  batch: PrintbatchContract;
  plan: BatchDocumentPlan;
  opgeslagenDocumenten: BatchdocumentContract[];
}

export interface BatchDocumentversieVernieuwenInput extends TransactieContext {
  actie: 'batch_documentversie_vernieuwen';
  batch: PrintbatchContract;
  plan: BatchDocumentPlan;
  opgeslagenDocumenten: BatchdocumentContract[];
  nieuweDocumentversie: number;
  reden: string;
}

export interface BatchGeprintMarkerenInput extends TransactieContext {
  actie: 'batch_geprint_markeren';
  batch: PrintbatchContract;
  printdatum: string;
}

export interface BriefGepostMarkerenInput extends TransactieContext {
  actie: 'brief_gepost_markeren';
  brief: BriefContract;
  actieveVersie: BriefversieContract;
  batch: PrintbatchContract;
  verzenddatum: string;
  geadresseerdeKey: string;
}

export type ProductieTransactieInput =
  | BriefDefinitiefMakenInput
  | BatchDocumentenRegistrerenInput
  | BatchDocumentversieVernieuwenInput
  | BatchGeprintMarkerenInput
  | BriefGepostMarkerenInput;

export interface ProductieTransactieValidatie {
  geldig: boolean;
  fouten: string[];
}

function valideerContext(input: TransactieContext): string[] {
  const fouten: string[] = [];
  if (!input.actorId.trim()) fouten.push('Actor is verplicht.');
  if (!input.operationKey.trim()) fouten.push('Operation key is verplicht.');
  if (!Number.isInteger(input.verwachtVersienummer) || input.verwachtVersienummer < 1) {
    fouten.push('Verwacht versienummer moet minimaal 1 zijn.');
  }
  if (!input.uitgevoerdOp.trim()) fouten.push('Uitvoeringstijdstip is verplicht.');
  return fouten;
}

/**
 * Pure precondition-validatie voor toekomstige transactionele databasefuncties.
 * De functie schrijft niets en kent geen Supabase-client.
 */
export function valideerProductieTransactie(
  input: ProductieTransactieInput,
): ProductieTransactieValidatie {
  const fouten = valideerContext(input);

  switch (input.actie) {
    case 'brief_definitief_maken':
      if (input.brief.status !== 'concept') {
        fouten.push('Alleen een conceptbrief kan definitief worden gemaakt.');
      }
      if (input.brief.briefnummer) {
        fouten.push('Brief heeft al een briefnummer.');
      }
      if (input.actieveVersie.status !== 'actief') {
        fouten.push('Alleen de actieve briefversie kan worden vergrendeld.');
      }
      if (input.actieveVersie.briefId !== input.brief.id) {
        fouten.push('Briefversie hoort niet bij de opgegeven brief.');
      }
      if (!Number.isInteger(input.jaar) || input.jaar < 2000 || input.jaar > 9999) {
        fouten.push('Briefjaar moet een viercijferig jaar vanaf 2000 zijn.');
      }
      break;

    case 'batch_documenten_registreren': {
      if (input.batch.status !== 'concept' && input.batch.status !== 'documenten_gegenereerd') {
        fouten.push('Batchdocumenten kunnen in deze status niet worden geregistreerd.');
      }
      if (input.plan.batchId !== input.batch.id) {
        fouten.push('Documentplan hoort niet bij de opgegeven batch.');
      }
      if (input.plan.documentversie !== input.verwachtVersienummer) {
        fouten.push('Documentplanversie wijkt af van de verwachte versie.');
      }
      const typen = new Set(input.opgeslagenDocumenten.map(document => document.documenttype));
      for (const gepland of input.plan.documenten) {
        if (!typen.has(gepland.documenttype)) {
          fouten.push(`Opgeslagen document ontbreekt: ${gepland.documenttype}.`);
        }
      }
      break;
    }

    case 'batch_documentversie_vernieuwen': {
      if (input.batch.status !== 'documenten_gegenereerd' || input.batch.printdatum) {
        fouten.push('Alleen een nog niet geprinte batch kan een nieuwe documentversie krijgen.');
      }
      if (input.verwachtVersienummer !== input.batch.documentversie) {
        fouten.push('De verwachte documentversie wijkt af van de actuele batch.');
      }
      if (input.nieuweDocumentversie !== input.verwachtVersienummer + 1) {
        fouten.push('De nieuwe documentversie moet exact één hoger zijn.');
      }
      if (input.plan.batchId !== input.batch.id) {
        fouten.push('Documentplan hoort niet bij de opgegeven batch.');
      }
      if (input.plan.documentversie !== input.nieuweDocumentversie) {
        fouten.push('Documentplan hoort niet bij de nieuwe documentversie.');
      }
      if (!input.reden.trim()) fouten.push('Reden voor de nieuwe documentversie is verplicht.');
      const typen = new Set(input.opgeslagenDocumenten.map(document => document.documenttype));
      for (const gepland of input.plan.documenten) {
        if (!typen.has(gepland.documenttype)) {
          fouten.push(`Opgeslagen vervangend document ontbreekt: ${gepland.documenttype}.`);
        }
      }
      if (input.opgeslagenDocumenten.some((document) =>
        document.documentversie !== input.nieuweDocumentversie)) {
        fouten.push('Een opgeslagen document hoort niet bij de nieuwe documentversie.');
      }
      break;
    }

    case 'batch_geprint_markeren':
      if (input.batch.status !== 'documenten_gegenereerd') {
        fouten.push('Alleen een batch met gegenereerde documenten kan geprint worden.');
      }
      if (input.batch.printdatum) fouten.push('Batch heeft al een printdatum.');
      if (!input.printdatum.trim()) fouten.push('Printdatum is verplicht.');
      break;

    case 'brief_gepost_markeren':
      if (input.brief.status !== 'definitief') {
        fouten.push('Alleen een definitieve brief kan gepost worden.');
      }
      if (input.actieveVersie.briefId !== input.brief.id) {
        fouten.push('Briefversie hoort niet bij de opgegeven brief.');
      }
      if (input.actieveVersie.status !== 'actief') {
        fouten.push('Alleen de actieve briefversie kan gepost worden.');
      }
      if (input.batch.status !== 'geprint' && input.batch.status !== 'gedeeltelijk_gepost') {
        fouten.push('Brief kan alleen vanuit een geprinte batch worden gepost.');
      }
      if (!input.batch.printdatum) fouten.push('Batch mist een expliciete printdatum.');
      if (!input.verzenddatum.trim()) fouten.push('Verzenddatum is verplicht.');
      if (!input.geadresseerdeKey.trim()) fouten.push('Geadresseerde key is verplicht.');
      break;
  }

  return { geldig: fouten.length === 0, fouten };
}
