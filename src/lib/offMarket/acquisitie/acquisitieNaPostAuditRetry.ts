import type { AcquisitieNaPostAuditRecord } from './acquisitieNaPostAudit';
import {
  registreerAcquisitieNaPostAudit,
  type AcquisitieNaPostAuditPoort,
  type AcquisitieNaPostAuditUitkomst,
} from './acquisitieNaPostAuditUitvoerder';

export interface AcquisitieNaPostAuditRetryPlan {
  poging: number;
  record: AcquisitieNaPostAuditRecord;
}

/**
 * Bouwt uitsluitend een retry voor een mislukte auditregistratie. Het exact
 * eerder aangeboden, immutable record blijft behouden; de bedrijfsuse-case en
 * dossierbijwerking worden niet opnieuw uitgevoerd.
 */
export function bouwAcquisitieNaPostAuditRetryPlan(input: {
  record: AcquisitieNaPostAuditRecord;
  uitkomst: AcquisitieNaPostAuditUitkomst;
  volgendePoging: number;
  maximaalAantalPogingen?: number;
}): AcquisitieNaPostAuditRetryPlan {
  const maximum = input.maximaalAantalPogingen ?? 3;
  if (!Number.isInteger(maximum) || maximum < 1 || maximum > 3) {
    throw new Error('Maximaal aantal auditpogingen moet tussen 1 en 3 liggen.');
  }
  if (!Number.isInteger(input.volgendePoging) || input.volgendePoging < 2) {
    throw new Error('Een auditretry begint bij poging 2.');
  }
  if (input.volgendePoging > maximum) {
    throw new Error('Maximaal aantal auditpogingen is bereikt.');
  }
  if (input.uitkomst.geslaagd) {
    throw new Error('Een geslaagde auditregistratie mag niet opnieuw worden uitgevoerd.');
  }
  if (!input.uitkomst.foutcode) {
    throw new Error('Mislukte auditregistratie mist een veilige foutcode.');
  }
  if (input.uitkomst.operationKey !== input.record.operationKey) {
    throw new Error('Audituitkomst verwijst niet naar het oorspronkelijke auditrecord.');
  }
  if (!Object.isFrozen(input.record) || !Object.isFrozen(input.record.kenmerken)) {
    throw new Error('Auditretry vereist het oorspronkelijke immutable auditrecord.');
  }

  return {
    poging: input.volgendePoging,
    record: input.record,
  };
}

/** Voert exact één geplande auditretry uit via dezelfde auditpoort. */
export async function voerAcquisitieNaPostAuditRetryUit(input: {
  plan: AcquisitieNaPostAuditRetryPlan;
  poort: AcquisitieNaPostAuditPoort;
}): Promise<AcquisitieNaPostAuditUitkomst> {
  return registreerAcquisitieNaPostAudit({
    record: input.plan.record,
    poort: input.poort,
  });
}
