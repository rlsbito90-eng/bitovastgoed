import {
  voerAcquisitieNaPostUseCaseUit,
  type AcquisitieNaPostUseCaseResultaat,
} from './acquisitieNaPostUseCase';
import {
  bouwAcquisitieNaPostAuditRecord,
  type AcquisitieNaPostAuditRecord,
} from './acquisitieNaPostAudit';
import {
  registreerAcquisitieNaPostAudit,
  type AcquisitieNaPostAuditPoort,
  type AcquisitieNaPostAuditUitkomst,
} from './acquisitieNaPostAuditUitvoerder';

export interface AcquisitieNaPostUseCaseMetAuditResultaat {
  resultaat: AcquisitieNaPostUseCaseResultaat;
  auditRecord: AcquisitieNaPostAuditRecord;
  audit: AcquisitieNaPostAuditUitkomst;
}

/**
 * Voert de na-post-use-case uit en registreert daarna één privacyveilig
 * auditrecord. De audit heeft een afzonderlijke operation key, zodat audit- en
 * dossierwrites niet dezelfde idempotentiesleutel delen. Een mislukte
 * auditregistratie maskeert of wijzigt de bedrijfsresultaten niet.
 *
 * Het exact aangeboden, immutable auditrecord wordt teruggegeven. Daardoor kan
 * een begrensde auditretry hetzelfde record en dezelfde idempotentiesleutel
 * hergebruiken zonder de bedrijfsuse-case opnieuw uit te voeren.
 */
export async function voerAcquisitieNaPostUseCaseMetAuditUit(input: {
  useCase: Parameters<typeof voerAcquisitieNaPostUseCaseUit>[0];
  auditPoort: AcquisitieNaPostAuditPoort;
  auditOperationKey: string;
  auditGeregistreerdOp: string;
}): Promise<AcquisitieNaPostUseCaseMetAuditResultaat> {
  const resultaat = await voerAcquisitieNaPostUseCaseUit(input.useCase);
  const auditRecord = bouwAcquisitieNaPostAuditRecord({
    selectieId: input.useCase.selectieId,
    actorId: input.useCase.actorId,
    operationKey: input.auditOperationKey,
    geregistreerdOp: input.auditGeregistreerdOp,
    resultaat,
  });
  const audit = await registreerAcquisitieNaPostAudit({
    record: auditRecord,
    poort: input.auditPoort,
  });

  return { resultaat, auditRecord, audit };
}
