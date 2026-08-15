import { projecteerBriefEventNaarAcquisitieEvent } from '@/lib/acquisitie/tracking/eventContract';
import type { BriefEventInput } from '@/lib/offMarket/brieven/events';
import type { Responsstatus } from '@/lib/offMarket/brieven/respons';
import {
  evalueerAcquisitieWorkflow,
  type AcquisitieReactieUitkomst,
  type AcquisitieWorkflowEvent,
  type WorkflowNextAction,
} from './acquisitieWorkflowEngine';

function reactieUitkomst(status?: string | null): AcquisitieReactieUitkomst {
  const s = status as Responsstatus | undefined;
  if (s === 'interesse' || s === 'gesprek_gepland') return 'interesse';
  if (s === 'wil_meer_informatie') return 'meer_informatie';
  if (s === 'later_opnieuw_benaderen') return 'later_bellen';
  if (s === 'niet_geinteresseerd' || s === 'verkocht_of_niet_relevant' || s === 'afgevallen') return 'geen_interesse';
  if (s === 'verkeerd_adres') return 'verkeerde_eigenaar';
  return 'overig';
}

export function naarWorkflowEventVanBriefEvent(
  input: BriefEventInput,
  fallbackId = `brief-event:${input.brief_id ?? 'onbekend'}:${input.event_type}`,
): AcquisitieWorkflowEvent | null {
  const occurredAt = input.event_date ?? new Date().toISOString();
  const metadata = input.metadata ?? {};
  const acquisitieEvent = projecteerBriefEventNaarAcquisitieEvent(input);

  if (input.event_type === 'concept_created') {
    return { id: fallbackId, type: 'brief_concept_aangemaakt', occurredAt, metadata };
  }
  if (acquisitieEvent?.feit === 'communicatie_verzonden') {
    return { id: fallbackId, type: 'brief_verzonden', occurredAt, metadata };
  }
  if (input.event_type === 'returned_mail' || input.status === 'retour_post') {
    return { id: fallbackId, type: 'retour_post', occurredAt, metadata };
  }
  if (input.event_type === 'response_received') {
    // TRACK-1: "geen reactie" is afwezigheid van een inbound gebeurtenis en
    // mag dus geen reactie-event of workflowadvies veroorzaken.
    if (!acquisitieEvent?.teltAlsReactie) return null;
    return {
      id: fallbackId,
      type: 'reactie_ontvangen',
      occurredAt,
      metadata: {
        ...metadata,
        uitkomst: reactieUitkomst(input.status),
        vervolgdatum: typeof metadata.vervolgdatum === 'string' ? metadata.vervolgdatum : null,
      },
    };
  }
  if (input.event_type === 'follow_up_created') {
    return { id: fallbackId, type: 'follow_up_gepland', occurredAt, metadata };
  }
  if (input.event_type === 'follow_up_completed') {
    return { id: fallbackId, type: 'follow_up_afgerond', occurredAt, metadata };
  }
  if (input.event_type === 'archived') {
    return { id: fallbackId, type: 'gearchiveerd', occurredAt, metadata };
  }
  return null;
}

export interface BriefEventWorkflowProjectie {
  volgendeActie: string | null;
  volgendeActieOp: string | null;
  workflowMode: string | null;
  workflowCode: string | null;
}

export function projecteerBriefEventNaarWorkflow(input: BriefEventInput): BriefEventWorkflowProjectie {
  const event = naarWorkflowEventVanBriefEvent(input);
  if (!event) return { volgendeActie: null, volgendeActieOp: null, workflowMode: null, workflowCode: null };
  const state = evalueerAcquisitieWorkflow([event]);
  const actie: WorkflowNextAction | null = state.nextAction;
  return {
    volgendeActie: actie?.label ?? null,
    volgendeActieOp: actie?.dueAt ?? null,
    workflowMode: actie?.mode ?? null,
    workflowCode: actie?.code ?? null,
  };
}
