import type {
  BriefContract,
  BriefversieContract,
  PrintbatchContract,
} from '@/lib/offMarket/acquisitie/productiekernContract';
import { parseProductieNummer } from '@/lib/offMarket/acquisitie/productieIdentiteit';
import type { AcquisitieBron } from './eventContract';
import type { AcquisitieDomeinEvent } from './domainEventContract';

export interface ProductieTrackingContext {
  bron: AcquisitieBron;
  vastgoedkansId?: string | null;
  signaalId?: string | null;
  actorId?: string | null;
}

function geldigeDossiercontext(context: ProductieTrackingContext): boolean {
  return Number(Boolean(context.vastgoedkansId)) + Number(Boolean(context.signaalId)) === 1;
}

/**
 * Read-only TRACK-projectie van een definitieve productiekernbrief.
 * Een concept of ongeldige/ontbrekende BR-identiteit levert bewust geen feit op.
 */
export function projecteerDefinitieveBriefNaarAcquisitieEvent(
  brief: BriefContract,
  context: ProductieTrackingContext,
): AcquisitieDomeinEvent | null {
  if (!geldigeDossiercontext(context) || brief.status !== 'definitief' || !brief.definitiefOp || !brief.briefnummer) return null;
  const parsed = parseProductieNummer(brief.briefnummer);
  if (!parsed || parsed.type !== 'brief') return null;

  return {
    type: 'brief_definitief_gemaakt',
    bron: context.bron,
    occurredAt: brief.definitiefOp,
    refs: {
      vastgoedkansId: context.vastgoedkansId ?? null,
      signaalId: context.signaalId ?? null,
      objectId: brief.objectId,
      briefId: brief.id,
    },
    actorId: context.actorId ?? null,
    externalReference: brief.briefnummer,
    idempotencyKey: `brief:${brief.briefnummer}:definitief`,
    metadata: {
      briefnummer: brief.briefnummer,
      actieveVersie: brief.actieveVersie,
      relatieId: brief.relatieId,
      selectieId: brief.selectieId,
    },
  };
}

/**
 * Alleen een werkelijk verzonden specifieke briefversie is communicatieverzending.
 * PDF/batchgeneratie of printstatus alleen is onvoldoende.
 */
export function projecteerVerzondenBriefversieNaarAcquisitieEvent(
  versie: BriefversieContract,
  brief: BriefContract,
  context: ProductieTrackingContext,
  batchId?: string | null,
): AcquisitieDomeinEvent | null {
  if (!geldigeDossiercontext(context) || versie.status !== 'verzonden' || !versie.verzondenOp || versie.briefId !== brief.id) return null;
  if (!brief.briefnummer) return null;
  const parsed = parseProductieNummer(brief.briefnummer);
  if (!parsed || parsed.type !== 'brief') return null;

  return {
    type: 'communicatie_verzonden',
    bron: context.bron,
    occurredAt: versie.verzondenOp,
    refs: {
      vastgoedkansId: context.vastgoedkansId ?? null,
      signaalId: context.signaalId ?? null,
      objectId: brief.objectId,
      briefId: brief.id,
      briefVersieId: versie.id,
      batchId: batchId ?? null,
    },
    actorId: context.actorId ?? null,
    externalReference: brief.briefnummer,
    idempotencyKey: `briefversie:${versie.id}:verzonden`,
    metadata: {
      briefnummer: brief.briefnummer,
      versienummer: versie.versienummer,
      kanaal: 'post',
    },
  };
}

/**
 * Batchstatus projecteert alleen harde feiten: print en post.
 * `documenten_gegenereerd` is nadrukkelijk geen verzending.
 */
export function projecteerPrintbatchNaarAcquisitieEvents(
  batch: PrintbatchContract,
  context: ProductieTrackingContext,
): AcquisitieDomeinEvent[] {
  if (!geldigeDossiercontext(context)) return [];
  const parsed = parseProductieNummer(batch.batchnummer);
  if (!parsed || parsed.type !== 'batch') return [];

  const events: AcquisitieDomeinEvent[] = [];
  if (batch.printdatum && ['geprint', 'gedeeltelijk_gepost', 'gepost'].includes(batch.status)) {
    events.push({
      type: 'batch_geprint',
      bron: context.bron,
      occurredAt: batch.printdatum,
      refs: {
        vastgoedkansId: context.vastgoedkansId ?? null,
        signaalId: context.signaalId ?? null,
        batchId: batch.id,
      },
      actorId: context.actorId ?? null,
      externalReference: batch.batchnummer,
      idempotencyKey: `batch:${batch.batchnummer}:geprint`,
      metadata: { batchnummer: batch.batchnummer, documentversie: batch.documentversie },
    });
  }
  if (batch.verzenddatum && ['gedeeltelijk_gepost', 'gepost'].includes(batch.status)) {
    events.push({
      type: 'communicatie_verzonden',
      bron: context.bron,
      occurredAt: batch.verzenddatum,
      refs: {
        vastgoedkansId: context.vastgoedkansId ?? null,
        signaalId: context.signaalId ?? null,
        batchId: batch.id,
      },
      actorId: context.actorId ?? null,
      externalReference: batch.batchnummer,
      idempotencyKey: `batch:${batch.batchnummer}:gepost`,
      metadata: {
        batchnummer: batch.batchnummer,
        kanaal: 'post',
        gedeeltelijk: batch.status === 'gedeeltelijk_gepost',
      },
    });
  }
  return events;
}
