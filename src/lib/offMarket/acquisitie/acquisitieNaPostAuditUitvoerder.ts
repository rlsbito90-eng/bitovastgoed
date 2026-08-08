import type { AcquisitieNaPostAuditRecord } from './acquisitieNaPostAudit';

export interface AcquisitieNaPostAuditPoort {
  registreer(record: AcquisitieNaPostAuditRecord): Promise<void>;
}

export interface AcquisitieNaPostAuditUitkomst {
  operationKey: string;
  geslaagd: boolean;
  foutcode: string | null;
}

function veiligeFoutcode(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = String((error as { code?: unknown }).code ?? '').trim();
    if (/^[A-Z0-9_:-]{1,80}$/i.test(code)) return code;
  }
  return 'NA_POST_AUDIT_MISLUKT';
}

/**
 * Registreert exact één reeds opgebouwd, privacyveilig auditrecord.
 * Een auditfout verandert de voorafgaande bedrijfsuitkomst niet en wordt daarom
 * afzonderlijk en zonder vrije foutmelding teruggegeven.
 */
export async function registreerAcquisitieNaPostAudit(input: {
  record: AcquisitieNaPostAuditRecord;
  poort: AcquisitieNaPostAuditPoort;
}): Promise<AcquisitieNaPostAuditUitkomst> {
  try {
    await input.poort.registreer(input.record);
    return {
      operationKey: input.record.operationKey,
      geslaagd: true,
      foutcode: null,
    };
  } catch (error) {
    return {
      operationKey: input.record.operationKey,
      geslaagd: false,
      foutcode: veiligeFoutcode(error),
    };
  }
}
