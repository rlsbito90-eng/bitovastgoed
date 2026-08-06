import { normaliseerProductiekernLeesFout } from './productiekernSupabaseLeesFout';
import type { ProductiekernSupabaseQueryUitvoerder } from './productiekernSupabaseLeesTransportAdapter';

export interface ProductiekernLeesRetryOpties {
  maximaalAantalPogingen?: number;
  wacht?: (milliseconden: number) => Promise<void>;
  wachttijdenMs?: readonly number[];
}

const STANDAARD_WACHTTIJDEN_MS = [100, 300] as const;

/**
 * Herhaalt uitsluitend tijdelijk herstelbare transportfouten en nooit
 * autorisatie-, schema-, cardinaliteits- of onbekende fouten.
 */
export function metBegrensdeProductiekernLeesRetry(
  uitvoerder: ProductiekernSupabaseQueryUitvoerder,
  opties: ProductiekernLeesRetryOpties = {},
): ProductiekernSupabaseQueryUitvoerder {
  const maximaalAantalPogingen = opties.maximaalAantalPogingen ?? 3;
  const wachttijdenMs = opties.wachttijdenMs ?? STANDAARD_WACHTTIJDEN_MS;
  const wacht = opties.wacht ?? ((milliseconden) =>
    new Promise<void>((resolve) => setTimeout(resolve, milliseconden)));

  if (!Number.isInteger(maximaalAantalPogingen)
      || maximaalAantalPogingen < 1
      || maximaalAantalPogingen > 3) {
    throw new Error('Maximaal aantal leespogingen moet tussen 1 en 3 liggen.');
  }
  if (wachttijdenMs.some((waarde) => !Number.isFinite(waarde) || waarde < 0)) {
    throw new Error('Retrywachttijden moeten niet-negatieve eindige getallen zijn.');
  }

  return {
    async voerUit(input) {
      let laatsteFout: unknown;
      for (let poging = 1; poging <= maximaalAantalPogingen; poging += 1) {
        try {
          return await uitvoerder.voerUit(input);
        } catch (error) {
          laatsteFout = error;
          const fout = normaliseerProductiekernLeesFout(error);
          if (!fout.herstelbaar || poging === maximaalAantalPogingen) throw error;
          const wachttijd = wachttijdenMs[poging - 1] ?? wachttijdenMs.at(-1) ?? 0;
          await wacht(wachttijd);
        }
      }
      throw laatsteFout;
    },
  };
}
