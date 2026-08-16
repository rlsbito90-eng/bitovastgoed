import { bouwBatchDocumentPlan, type BatchBriefInvoer, type BatchDocumentPlan } from './batchDocumentPlan';
import type { AtomischePrintbatchRepository } from './atomischePrintbatchSupabaseRepository';
import type {
  BatchdocumentContract,
  BriefContract,
  BriefversieContract,
  PrintbatchContract,
} from './productiekernContract';
import type { AcquisitieProductieTransactieRepository } from './productieTransactieRepository';

export interface ProductiekernBatchBrief {
  brief: BriefContract;
  versie: BriefversieContract;
  geadresseerdeKey: string;
}

export interface ProductiekernBatchStartResultaat {
  batch: PrintbatchContract;
  plan: BatchDocumentPlan;
  brieven: ProductiekernBatchBrief[];
}

function bewaakBatchBriefIdentiteit(item: ProductiekernBatchBrief): void {
  if (item.brief.status !== 'definitief') throw new Error('Alleen definitieve brieven mogen in een printbatch.');
  if (!item.brief.briefnummer?.trim()) throw new Error('Definitieve brief mist BR-nummer.');
  if (item.versie.briefId !== item.brief.id) throw new Error('Briefversie hoort niet bij de opgegeven brief.');
  if (item.brief.actieveVersie !== item.versie.versienummer) throw new Error('Brief en gekoppelde versie lopen niet gelijk.');
  if (!item.geadresseerdeKey.trim()) throw new Error('Geadresseerde key is verplicht voor printproductie.');
}

function bewaakBatchBrief(item: ProductiekernBatchBrief): void {
  bewaakBatchBriefIdentiteit(item);
  if (item.versie.status !== 'actief') throw new Error('Alleen de actieve briefversie mag in een nieuwe printbatch.');
}

function sorteerBrieven(brieven: ProductiekernBatchBrief[]): ProductiekernBatchBrief[] {
  return [...brieven].sort((a, b) => {
    const n = (a.brief.briefnummer ?? '').localeCompare(b.brief.briefnummer ?? '');
    return n !== 0 ? n : a.versie.id.localeCompare(b.versie.id);
  });
}

/**
 * Maakt één BAT plus alle koppelingen in één database-transactie. Hierdoor kan
 * een netwerkfout nooit een half gekoppelde conceptbatch achterlaten.
 * Documenten worden hier nog niet geregistreerd: eerst moeten alle vier
 * artifacts succesvol gegenereerd én duurzaam opgeslagen zijn.
 */
export async function startProductiekernPrintbatch(input: {
  brieven: ProductiekernBatchBrief[];
  actorId: string;
  datum: string;
  operationScope: string;
}, atomisch: AtomischePrintbatchRepository): Promise<ProductiekernBatchStartResultaat> {
  if (!input.actorId.trim()) throw new Error('Actor is verplicht.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.datum)) throw new Error('Batchdatum moet YYYY-MM-DD zijn.');
  if (!input.operationScope.trim()) throw new Error('Operation scope is verplicht.');
  if (input.brieven.length === 0) throw new Error('Een printbatch vereist minimaal één definitieve brief.');
  if (input.brieven.length > 1000) throw new Error('Een printbatch mag maximaal 1000 definitieve brieven bevatten.');

  const uniekeBrieven = new Set<string>();
  const uniekeVersies = new Set<string>();
  for (const item of input.brieven) {
    bewaakBatchBrief(item);
    if (uniekeBrieven.has(item.brief.id)) throw new Error(`Brief dubbel in batch: ${item.brief.id}.`);
    if (uniekeVersies.has(item.versie.id)) throw new Error(`Briefversie dubbel in batch: ${item.versie.id}.`);
    uniekeBrieven.add(item.brief.id);
    uniekeVersies.add(item.versie.id);
  }

  const brieven = sorteerBrieven(input.brieven);
  const batch = await atomisch.maakPrintbatchMetBrieven({
    actorId: input.actorId,
    operationKey: `printbatch:${input.operationScope}`,
    datum: input.datum,
    brieven: brieven.map((item) => ({ briefId: item.brief.id, briefVersieId: item.versie.id })),
  });

  const planInvoer: BatchBriefInvoer[] = brieven.map((item) => ({
    briefnummer: item.brief.briefnummer!,
    versie: item.versie,
  }));
  const plan = bouwBatchDocumentPlan({ batch, brieven: planInvoer });
  return { batch, plan, brieven };
}

function exactVierDocumenten(plan: BatchDocumentPlan, documenten: BatchdocumentContract[]): void {
  if (documenten.length !== 4) throw new Error('Exact vier opgeslagen batchdocumenten zijn verplicht.');
  const gepland = new Set(plan.documenten.map((d) => d.documenttype));
  const gezien = new Set<string>();
  for (const document of documenten) {
    if (document.batchId !== plan.batchId) throw new Error('Opgeslagen document hoort bij een andere batch.');
    if (document.documentversie !== plan.documentversie) throw new Error('Opgeslagen document heeft een andere documentversie.');
    if (document.status !== 'actief') throw new Error('Alleen actieve batchdocumenten kunnen worden geregistreerd.');
    if (!document.bestandReferentie.trim()) throw new Error('Batchdocument mist bestandreferentie.');
    if (!gepland.has(document.documenttype)) throw new Error(`Onverwacht batchdocumenttype: ${document.documenttype}.`);
    if (gezien.has(document.documenttype)) throw new Error(`Batchdocumenttype dubbel: ${document.documenttype}.`);
    gezien.add(document.documenttype);
  }
  if (gezien.size !== gepland.size) throw new Error('Niet alle vier geplande documenttypen zijn opgeslagen.');
}

export async function registreerProductiekernBatchdocumenten(input: {
  batch: PrintbatchContract;
  plan: BatchDocumentPlan;
  opgeslagenDocumenten: BatchdocumentContract[];
  actorId: string;
  uitgevoerdOp?: string;
}, transacties: AcquisitieProductieTransactieRepository): Promise<void> {
  exactVierDocumenten(input.plan, input.opgeslagenDocumenten);
  const uitgevoerdOp = input.uitgevoerdOp ?? new Date().toISOString();
  await transacties.registreerBatchdocumenten({
    actie: 'batch_documenten_registreren',
    batch: input.batch,
    plan: input.plan,
    opgeslagenDocumenten: input.opgeslagenDocumenten,
    actorId: input.actorId,
    operationKey: `batch-documenten:${input.batch.id}:v${input.plan.documentversie}`,
    verwachtVersienummer: input.plan.documentversie,
    uitgevoerdOp,
  });
}

export async function markeerProductiekernBatchGeprint(input: {
  batch: PrintbatchContract;
  actorId: string;
  printdatum?: string;
}, transacties: AcquisitieProductieTransactieRepository): Promise<void> {
  const printdatum = input.printdatum ?? new Date().toISOString();
  await transacties.markeerBatchGeprint({
    actie: 'batch_geprint_markeren',
    batch: input.batch,
    actorId: input.actorId,
    operationKey: `batch-geprint:${input.batch.id}:v${input.batch.documentversie}`,
    verwachtVersienummer: input.batch.documentversie,
    uitgevoerdOp: printdatum,
    printdatum,
  });
}

/**
 * Post alle nog niet verzonden immutable briefversies één voor één. Bij een
 * gedeeltelijke eerdere poging worden reeds `verzonden` versies op identiteit
 * gecontroleerd en overgeslagen; de resterende writes behouden hun vaste
 * operation keys. Hierdoor is een refresh/retry veilig en hervatbaar.
 */
export async function markeerProductiekernBrievenGepost(input: {
  batch: PrintbatchContract;
  brieven: ProductiekernBatchBrief[];
  actorId: string;
  verzenddatum?: string;
}, transacties: AcquisitieProductieTransactieRepository): Promise<void> {
  if (input.batch.status !== 'geprint' && input.batch.status !== 'gedeeltelijk_gepost') {
    throw new Error('Alleen een geprinte batch kan als gepost worden verwerkt.');
  }
  if (!input.batch.printdatum) throw new Error('Batch mist printdatum.');
  const verzenddatum = input.verzenddatum ?? new Date().toISOString();

  for (const item of sorteerBrieven(input.brieven)) {
    bewaakBatchBriefIdentiteit(item);
    if (item.versie.status === 'verzonden') continue;
    if (item.versie.status !== 'actief') {
      throw new Error(`Briefversie ${item.versie.id} kan niet als gepost worden verwerkt.`);
    }
    await transacties.markeerBriefGepost({
      actie: 'brief_gepost_markeren',
      brief: item.brief,
      actieveVersie: item.versie,
      batch: input.batch,
      actorId: input.actorId,
      operationKey: `brief-gepost:${input.batch.id}:${item.versie.id}`,
      verwachtVersienummer: item.versie.versienummer,
      uitgevoerdOp: verzenddatum,
      verzenddatum,
      geadresseerdeKey: item.geadresseerdeKey,
    });
  }
}
