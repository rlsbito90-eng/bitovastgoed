import type { BatchPostregistratiePlan } from './batchPostregistratiePlan';
import type { BatchPostregistratieResultaat } from './batchPostregistratieResultaat';
import { voerBatchPostregistratieUit } from './batchPostregistratieUitvoerder';
import type { AcquisitieOpvolgCommando } from './acquisitieOpvolgPlan';
import { bouwAcquisitieOpvolgPlan } from './acquisitieOpvolgPlan';
import { voerAcquisitieOpvolgUit } from './acquisitieOpvolgUitvoerder';

export interface NaPostOrchestratiePoorten {
  postRepository: Parameters<typeof voerBatchPostregistratieUit>[0]['repository'];
  opvolgTaakpoort: Parameters<typeof voerAcquisitieOpvolgUit>[0]['taakpoort'];
}

export interface NaPostOrchestratieResultaat {
  postregistratie: BatchPostregistratieResultaat;
  opvolgCommandos: AcquisitieOpvolgCommando[];
  opvolgUitkomst: Awaited<ReturnType<typeof voerAcquisitieOpvolgUit>> | null;
}

/**
 * Voert eerst postregistratie uit en maakt uitsluitend voor aantoonbaar
 * geslaagde postcommando's opvolgtaken. Mislukte of overgeslagen brieven
 * kunnen hierdoor nooit stil een opvolgtaak krijgen.
 */
export async function voerNaPostOrchestratieUit(input: {
  plan: BatchPostregistratiePlan;
  poorten: NaPostOrchestratiePoorten;
  opvolgtermijnDagen: number;
  omschrijving?: string;
}): Promise<NaPostOrchestratieResultaat> {
  const postregistratie = await voerBatchPostregistratieUit({
    plan: input.plan,
    repository: input.poorten.postRepository,
  });

  const opvolgCommandos = bouwAcquisitieOpvolgPlan({
    geposteCommandos: postregistratie.geslaagdeCommandos,
    opvolgtermijnDagen: input.opvolgtermijnDagen,
    omschrijving: input.omschrijving,
  });

  const opvolgUitkomst = opvolgCommandos.length === 0
    ? null
    : await voerAcquisitieOpvolgUit({
      commandos: opvolgCommandos,
      taakpoort: input.poorten.opvolgTaakpoort,
    });

  return { postregistratie, opvolgCommandos, opvolgUitkomst };
}
