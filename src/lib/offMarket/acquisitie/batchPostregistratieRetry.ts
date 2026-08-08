import type { BatchPostregistratieCommando } from './batchPostregistratiePlan';
import type { BatchPostregistratieResultaat } from './batchPostregistratieResultaat';

export interface BatchPostregistratieRetryPlan {
  batchId: string;
  commandos: BatchPostregistratieCommando[];
  aantalPogingen: number;
}

/**
 * Bouwt een retryplan uitsluitend uit eerder mislukte commando's. Operation keys
 * blijven gelijk, zodat de database-idempotentie dezelfde handeling herkent.
 */
export function bouwBatchPostregistratieRetryPlan(input: {
  resultaat: BatchPostregistratieResultaat;
  huidigAantalPogingen: number;
  maximaalAantalPogingen?: number;
}): BatchPostregistratieRetryPlan {
  const maximum = input.maximaalAantalPogingen ?? 3;
  if (!Number.isInteger(input.huidigAantalPogingen) || input.huidigAantalPogingen < 1) {
    throw new Error('Huidig aantal postregistratiepogingen moet minimaal 1 zijn.');
  }
  if (!Number.isInteger(maximum) || maximum < 1 || maximum > 3) {
    throw new Error('Maximaal aantal postregistratiepogingen moet tussen 1 en 3 liggen.');
  }
  if (input.resultaat.retryCommandos.length === 0) {
    throw new Error('Er zijn geen mislukte postcommando’s om opnieuw uit te voeren.');
  }
  if (input.huidigAantalPogingen >= maximum) {
    throw new Error('Maximaal aantal postregistratiepogingen is bereikt.');
  }

  const keys = new Set<string>();
  const commandos = input.resultaat.retryCommandos.map((commando) => {
    if (keys.has(commando.operationKey)) {
      throw new Error(`Dubbel retrycommando voor ${commando.operationKey}.`);
    }
    keys.add(commando.operationKey);
    return { ...commando };
  });

  return {
    batchId: input.resultaat.batchId,
    commandos,
    aantalPogingen: input.huidigAantalPogingen + 1,
  };
}
