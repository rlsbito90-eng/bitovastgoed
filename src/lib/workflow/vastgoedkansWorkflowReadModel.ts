import type { ReactieStatus, Vastgoedkans } from '@/lib/vastgoedkansen';
import { evalueerAcquisitieWorkflow, type AcquisitieWorkflowEvent, type WorkflowState } from './acquisitieWorkflowEngine';

function iso(value: string | null | undefined, fallback: string): string {
  if (!value) return fallback;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00.000Z` : value;
}

function reactieUitkomst(status: ReactieStatus): string {
  if (status === 'interesse') return 'interesse';
  if (status === 'geen_interesse') return 'geen_interesse';
  if (status === 'later_contact') return 'later_bellen';
  return 'overig';
}

export function vastgoedkansNaarWorkflowEvents(kans: Vastgoedkans): AcquisitieWorkflowEvent[] {
  const events: AcquisitieWorkflowEvent[] = [{
    id: `${kans.id}:created`, type: 'pand_toegevoegd', occurredAt: kans.createdAt,
  }];

  if (kans.kadasterStatus === 'gegevens_bekend' || kans.kadasterStatus === 'niet_gevonden') {
    events.push({
      id: `${kans.id}:kadaster`,
      type: 'kadaster_opgehaald',
      occurredAt: iso(kans.kadasterLaatstGecontroleerdOp, kans.updatedAt),
      metadata: { eigenaarResultaat: kans.eigenaarStatus === 'bekend' ? 'uniek' : 'controle' },
    });
  }
  if (kans.eigenaarStatus === 'bekend') {
    events.push({ id: `${kans.id}:eigenaar`, type: 'eigenaar_bevestigd', occurredAt: iso(kans.eigenaarLaatstGecontroleerdOp, kans.updatedAt) });
  }
  if (kans.briefStatus === 'voorbereiden' || kans.briefStatus === 'klaar') {
    events.push({ id: `${kans.id}:brief-concept`, type: 'brief_concept_aangemaakt', occurredAt: kans.updatedAt });
  }
  if (kans.briefStatus === 'verzonden' || kans.briefStatus === 'reactie_ontvangen') {
    events.push({
      id: `${kans.id}:brief-verzonden`, type: 'brief_verzonden',
      occurredAt: iso(kans.briefVerzondenOp, kans.updatedAt),
      metadata: { opvolgdatum: kans.opvolgdatum },
    });
  }
  if (kans.reactieStatus !== 'geen_reactie') {
    events.push({
      id: `${kans.id}:reactie`, type: 'reactie_ontvangen',
      occurredAt: iso(kans.reactieOntvangenOp, kans.updatedAt),
      metadata: { uitkomst: reactieUitkomst(kans.reactieStatus), vervolgdatum: kans.volgendeActieDatum },
    });
  }
  if (kans.archivedAt) {
    events.push({ id: `${kans.id}:archief`, type: 'gearchiveerd', occurredAt: kans.archivedAt });
  }
  return events;
}

export function bouwVastgoedkansWorkflowReadModel(kans: Vastgoedkans): WorkflowState {
  return evalueerAcquisitieWorkflow(vastgoedkansNaarWorkflowEvents(kans));
}
