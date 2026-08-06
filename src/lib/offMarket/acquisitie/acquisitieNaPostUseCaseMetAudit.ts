import {
  voerAcquisitieNaPostUseCaseUit,
  type AcquisitieNaPostUseCaseResultaat,
} from './acquisitieNaPostUseCase';
import { bouwAcquisitieNaPostAuditRecord } from './acquisitieNaPostAudit';
import {
  registreerAcquisitieNaPostAudit,
  type AcquisitieNaPostAuditPoort,
  type AcquisitieNaPostAuditUitkomst,
} from './acquisitieNaPostAuditUitvoerder';

export interface AcquisitieNaPostUseCaseMetAuditResultaat {
  resultaat: AcquisitieNaPostUseCaseResultaat;
  audit: AcquisitieNaPostAuditUitkomst;
}

/**
 * Voert de na-post-use-case uit en registreert daarna één privacyveilig
 * auditrecord. De audit heeft een afzonderlijke operation key, zodat audit- en
 * dossierwrites niet dezelfde idempotentiesleutel delen. Een mislukte
 * auditregistratie maskeert of wijzigt de bedrijfsresultaten niet.
 */
export async function voerAcquisitieNaPostUseCaseMetAuditUit(input: {
  useCase: Parameters<typeof voerAcquisitieNaPostUseCaseUit>[0];
  auditPoort: AcquisitieNaPostAuditPoort;
  auditOperationKey: string;
  auditGeregistreerdOp: string;
}): Promise<AcquisitieNaPostUseCaseMetAuditResultaat> {
  const resultaat = await voerAcquisitieNaPostUseCaseUit(input.useCase);
  const record = bouwAcquisitieNaPostAuditRecord({
    selectieId: input.useCase.selectieId,
    actorId: input.useCase.actorId,
    operationKey: input.auditOperationKey,
    geregistreerdOp: input.auditGeregistreerdOp,
    resultaat,
  });
  const audit = await registreerAcquisitieNaPostAudit({
    record,
    poort: input.auditPoort,
  });

  return { resultaat, audit };
}
