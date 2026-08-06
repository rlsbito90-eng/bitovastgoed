import type { ProductiekernSupabaseQueryUitvoerder } from './productiekernSupabaseLeesTransportAdapter';

export class ProductiekernLeesBudgetOverschredenError extends Error {
  readonly code = 'ACQUISITIE_PRODUCTIEKERN_LEESBUDGET_OVERSCHREDEN';

  constructor(readonly maximaalAantalQueries: number) {
    super('Het begrensde productiekern-leesbudget is overschreden.');
    this.name = 'ProductiekernLeesBudgetOverschredenError';
  }
}

/**
 * Maakt een uitvoerder voor één begrensde leescontext, bijvoorbeeld één
 * dossiervergelijking. Iedere daadwerkelijke onderliggende query telt mee;
 * de decorator reset nooit stilzwijgend en voert geen writes uit.
 */
export function metProductiekernLeesBudget(
  uitvoerder: ProductiekernSupabaseQueryUitvoerder,
  maximaalAantalQueries = 25,
): ProductiekernSupabaseQueryUitvoerder {
  if (!Number.isInteger(maximaalAantalQueries)
      || maximaalAantalQueries < 1
      || maximaalAantalQueries > 100) {
    throw new Error('Productiekern-leesbudget moet tussen 1 en 100 queries liggen.');
  }
  let gebruikt = 0;

  return {
    voerUit(input) {
      if (gebruikt >= maximaalAantalQueries) {
        return Promise.reject(
          new ProductiekernLeesBudgetOverschredenError(maximaalAantalQueries),
        );
      }
      gebruikt += 1;
      return uitvoerder.voerUit(input);
    },
  };
}
