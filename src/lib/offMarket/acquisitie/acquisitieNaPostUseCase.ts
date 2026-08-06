import type { BatchPostregistratiePlan } from './batchPostregistratiePlan';
import {
  voerNaPostOrchestratieUit,
  type NaPostOrchestratiePoorten,
  type NaPostOrchestratieResultaat,
} from './acquisitieNaPostOrchestratie';
import {
  projecteerAcquisitieNaPostResultaat,
  type AcquisitieNaPostProjectie,
} from './acquisitieNaPostProjectie';
import {
  bouwAcquisitieNaPostDossierPlan,
  type AcquisitieNaPostDossierCommando,
} from './acquisitieNaPostDossierPlan';
import {
  voerAcquisitieNaPostDossierPlanUit,
  type AcquisitieNaPostDossierPoort,
  type AcquisitieNaPostDossierUitkomst,
} from './acquisitieNaPostDossierUitvoerder';

export interface AcquisitieNaPostUseCaseResultaat {
  orchestratie: NaPostOrchestratieResultaat;
  projectie: AcquisitieNaPostProjectie;
  dossierCommando: AcquisitieNaPostDossierCommando;
  dossierUitkomst: AcquisitieNaPostDossierUitkomst;
}

/**
 * Volledige applicatie-use-case na fysieke verzending:
 * 1. registreer uitsluitend expliciet geposte briefversies;
 * 2. maak opvolgtaken uitsluitend voor geslaagde registraties;
 * 3. projecteer de operationele werkbak;
 * 4. werk het dossier via één expliciet, idempotent commando bij.
 *
 * Elke stap gebruikt een smalle poort. Deze functie kent geen Supabase-client,
 * voert geen migratie uit en activeert geen productiekernconfiguratie.
 */
export async function voerAcquisitieNaPostUseCaseUit(input: {
  selectieId: string;
  plan: BatchPostregistratiePlan;
  totaalBriefversies: number;
  actorId: string;
  dossierOperationKey: string;
  opvolgtermijnDagen: number;
  omschrijving?: string;
  nu: string;
  poorten: NaPostOrchestratiePoorten & {
    dossierPoort: AcquisitieNaPostDossierPoort;
  };
}): Promise<AcquisitieNaPostUseCaseResultaat> {
  const orchestratie = await voerNaPostOrchestratieUit({
    plan: input.plan,
    poorten: input.poorten,
    opvolgtermijnDagen: input.opvolgtermijnDagen,
    omschrijving: input.omschrijving,
  });

  const projectie = projecteerAcquisitieNaPostResultaat({
    resultaat: orchestratie,
    totaalBriefversies: input.totaalBriefversies,
    nu: input.nu,
  });

  const dossierCommando = bouwAcquisitieNaPostDossierPlan({
    selectieId: input.selectieId,
    projectie,
    actorId: input.actorId,
    operationKey: input.dossierOperationKey,
  });

  const dossierUitkomst = await voerAcquisitieNaPostDossierPlanUit({
    commando: dossierCommando,
    poort: input.poorten.dossierPoort,
  });

  return { orchestratie, projectie, dossierCommando, dossierUitkomst };
}
