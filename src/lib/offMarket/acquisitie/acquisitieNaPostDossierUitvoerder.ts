import type { AcquisitieNaPostDossierCommando } from './acquisitieNaPostDossierPlan';

export interface AcquisitieNaPostDossierPoort {
  werkDossierBij(commando: AcquisitieNaPostDossierCommando): Promise<void>;
}

export interface AcquisitieNaPostDossierUitkomst {
  selectieId: string;
  operationKey: string;
  geslaagd: boolean;
  foutcode: string | null;
}

function veiligeFoutcode(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = String((error as { code?: unknown }).code ?? '').trim();
    if (/^[A-Z0-9_:-]{1,80}$/i.test(code)) return code;
  }
  return 'DOSSIERPROJECTIE_MISLUKT';
}

/**
 * Voert exact één vooraf gevalideerd dossiercommando uit. Vrije foutmeldingen
 * worden niet doorgegeven en er is geen impliciete retry of statuscorrectie.
 */
export async function voerAcquisitieNaPostDossierPlanUit(input: {
  commando: AcquisitieNaPostDossierCommando;
  poort: AcquisitieNaPostDossierPoort;
}): Promise<AcquisitieNaPostDossierUitkomst> {
  try {
    await input.poort.werkDossierBij(input.commando);
    return {
      selectieId: input.commando.selectieId,
      operationKey: input.commando.operationKey,
      geslaagd: true,
      foutcode: null,
    };
  } catch (error) {
    return {
      selectieId: input.commando.selectieId,
      operationKey: input.commando.operationKey,
      geslaagd: false,
      foutcode: veiligeFoutcode(error),
    };
  }
}
