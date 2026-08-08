import { normaliseerProductiekernLeesFout } from './productiekernSupabaseLeesFout';
import type { ProductiekernSupabaseQueryUitvoerder } from './productiekernSupabaseLeesTransportAdapter';

export interface ProductiekernLeesRetryOpties {
  maximaalAantalPogingen?: number;
  wacht?: (milliseconden: number) => Promise<void>;
  wachttijdenMs?: readonly number[];
}

const STANDAARD_WACHTTIJDEN_MS = [100, 300] as const;

export function metBegrensdeProductiekernLeesRetry(
  uitvoerder: ProductiekernSupabaseQueryUitvoerder,
  opties: ProductiekernLeesRetryOpties = {},
): ProductiekernSupabaseQueryUitvoerder {
  const maximaalAantalPogingen = opties.maximaalAantalPogingen ?? 3;
  const wachttijdenMs = opties.wachttijdenMs ?? STANDAARD_WACHTTIJDEN_MS;
  const wacht = opties.wacht ?? ((milliseconden) => new Promise<void>((resolve) => setTimeout(resolve, milliseconden)));
  if (!Number.isInteger(maximaalAantalPogingen) || maximaalAantalPogingen < 1 || maximaalAantalPogingen > 3) {
    throw new Error('Maximaal aantal leespogingen moet tussen 1 en 3 liggen.');
  }
  if (wachttijdenMs.some((waarde) => !Number.isFinite(waarde) || waarde < 0)) {
    throw new Error('Retrywachttijden moeten niet-negatieve eindige getallen zijn.');
  }

  async function metRetry<T>(actie: () => Promise<T>): Promise<T> {
    let laatsteFout: unknown;
    for (let poging = 1; poging <= maximaalAantalPogingen; poging += 1) {
      try { return await actie(); } catch (error) {
        laatsteFout = error;
        const fout = normaliseerProductiekernLeesFout(error);
        if (!fout.herstelbaar || poging === maximaalAantalPogingen) throw error;
        await wacht(wachttijdenMs[poging - 1] ?? wachttijdenMs.at(-1) ?? 0);
      }
    }
    throw laatsteFout;
  }

  return {
    voerUit: (input) => metRetry(() => uitvoerder.voerUit(input)),
    voerBulkUit: uitvoerder.voerBulkUit
      ? (input) => metRetry(() => uitvoerder.voerBulkUit!(input))
      : undefined,
  };
}
