import type { AcquisitieNaPostHerstelplan } from './acquisitieNaPostHerstelplan';
import {
  voerAcquisitieNaPostHerstelUit,
  type AcquisitieNaPostHerstelPoorten,
  type AcquisitieNaPostHerstelUitkomst,
} from './acquisitieNaPostHerstelUitvoerder';
import type { AcquisitieNaPostUseCaseResultaat } from './acquisitieNaPostUseCase';
import { bouwAcquisitieNaPostHerstelAuditRecord } from './acquisitieNaPostAudit';
import {
  registreerAcquisitieNaPostAudit,
  type AcquisitieNaPostAuditPoort,
  type AcquisitieNaPostAuditUitkomst,
} from './acquisitieNaPostAuditUitvoerder';

export interface AcquisitieNaPostHerstelMetAuditResultaat {
  herstel: AcquisitieNaPostHerstelUitkomst;
  audit: AcquisitieNaPostAuditUitkomst | null;
}

/**
 * Voert exact de aangewezen herstelstap uit en registreert daarna uitsluitend
 * voor een uitgevoerde herstelpoging of handmatige escalatie één privacyveilig
 * auditrecord. Een auditfout verandert de hersteluitkomst niet.
 */
export async function voerAcquisitieNaPostHerstelMetAuditUit(input: {
  plan: AcquisitieNaPostHerstelplan;
  oorspronkelijkResultaat: AcquisitieNaPostUseCaseResultaat;
  herstelPoorten: AcquisitieNaPostHerstelPoorten;
  auditPoort: AcquisitieNaPostAuditPoort;
  selectieId: string;
  actorId: string;
  auditOperationKey: string;
  auditGeregistreerdOp: string;
}): Promise<AcquisitieNaPostHerstelMetAuditResultaat> {
  const herstel = await voerAcquisitieNaPostHerstelUit({
    plan: input.plan,
    oorspronkelijkResultaat: input.oorspronkelijkResultaat,
    poorten: input.herstelPoorten,
  });

  if (input.plan.actie === 'geen') {
    return { herstel, audit: null };
  }

  const record = bouwAcquisitieNaPostHerstelAuditRecord({
    selectieId: input.selectieId,
    batchId: input.oorspronkelijkResultaat.orchestratie.postregistratie.batchId,
    actorId: input.actorId,
    operationKey: input.auditOperationKey,
    geregistreerdOp: input.auditGeregistreerdOp,
    uitkomst: herstel,
  });
  const audit = await registreerAcquisitieNaPostAudit({
    record,
    poort: input.auditPoort,
  });

  return { herstel, audit };
}
