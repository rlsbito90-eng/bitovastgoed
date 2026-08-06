import type { BatchPostregistratiePlan } from './batchPostregistratiePlan';
import {
  verzoenBatchPostregistratieResultaat,
  type BatchPostregistratieResultaat,
  type BatchPostregistratieUitkomst,
} from './batchPostregistratieResultaat';

export interface BatchPostregistratieRepository {
  markeerBriefGepost(input: {
    briefId: string;
    briefVersieId: string;
    batchId: string;
    actorId: string;
    operationKey: string;
    verzenddatum: string;
  }): Promise<void>;
}

function veiligeFoutcode(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === 'string' && /^[A-Z0-9_:-]{1,100}$/i.test(code)) return code;
  }
  return 'ONBEKENDE_POSTREGISTRATIEFOUT';
}

/**
 * Voert de vooraf gevalideerde postcommando's deterministisch en sequentieel uit.
 * Eén mislukte brief blokkeert de overige registraties niet, maar iedere uitkomst
 * wordt achteraf strikt met het oorspronkelijke plan verzoend.
 */
export async function voerBatchPostregistratieUit(input: {
  repository: BatchPostregistratieRepository;
  plan: BatchPostregistratiePlan;
}): Promise<BatchPostregistratieResultaat> {
  const uitkomsten: BatchPostregistratieUitkomst[] = [];

  for (const commando of input.plan.commandos) {
    try {
      await input.repository.markeerBriefGepost(commando);
      uitkomsten.push({
        operationKey: commando.operationKey,
        geslaagd: true,
        foutcode: null,
      });
    } catch (error) {
      uitkomsten.push({
        operationKey: commando.operationKey,
        geslaagd: false,
        foutcode: veiligeFoutcode(error),
      });
    }
  }

  return verzoenBatchPostregistratieResultaat({
    plan: input.plan,
    uitkomsten,
  });
}
