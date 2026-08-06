import type { AcquisitieNaPostActiebediening } from './acquisitieNaPostActiebediening';

export interface AcquisitieNaPostActieHandlers {
  herstelPostregistratie(): Promise<void>;
  herstelOpvolging(): Promise<void>;
  herstelDossierbijwerking(operationKey: string): Promise<void>;
  herstelAudit(operationKey: string): Promise<void>;
}

/**
 * Routeert exact één door de UI bevestigde herstelactie naar de passende
 * applicatiehandler. De router kent geen Supabase-client en voert geen actie
 * uit voor verborgen of uitgeschakelde bediening.
 */
export async function routeerAcquisitieNaPostHerstelactie(input: {
  bediening: AcquisitieNaPostActiebediening;
  handlers: AcquisitieNaPostActieHandlers;
}): Promise<void> {
  const { bediening, handlers } = input;

  if (!bediening.zichtbaar || bediening.uitgeschakeld || bediening.actie === 'geen') {
    throw new Error('Na-postherstelactie is niet uitvoerbaar.');
  }

  switch (bediening.actie) {
    case 'postregistratie_herstellen':
      await handlers.herstelPostregistratie();
      return;
    case 'opvolging_herstellen':
      await handlers.herstelOpvolging();
      return;
    case 'dossierbijwerking_herstellen':
      if (!bediening.operationKey?.trim()) {
        throw new Error('Dossierherstel mist de vereiste operation key.');
      }
      await handlers.herstelDossierbijwerking(bediening.operationKey);
      return;
    case 'audit_herstellen':
      if (!bediening.operationKey?.trim()) {
        throw new Error('Auditherstel mist de vereiste operation key.');
      }
      await handlers.herstelAudit(bediening.operationKey);
      return;
  }
}
