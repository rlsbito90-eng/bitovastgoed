import type { ProductiekernSupabaseQueryUitvoerder } from './productiekernSupabaseLeesTransportAdapter';

export class ProductiekernLeesBudgetOverschredenError extends Error {
  readonly code = 'ACQUISITIE_PRODUCTIEKERN_LEESBUDGET_OVERSCHREDEN';

  constructor(readonly maximaalAantalQueries: number) {
    super('Het begrensde productiekern-leesbudget is overschreden.');
    this.name = 'ProductiekernLeesBudgetOverschredenError';
  }
}

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
  const reserveer = () => {
    if (gebruikt >= maximaalAantalQueries) {
      throw new ProductiekernLeesBudgetOverschredenError(maximaalAantalQueries);
    }
    gebruikt += 1;
  };

  return {
    voerUit(input) {
      try { reserveer(); } catch (error) { return Promise.reject(error); }
      return uitvoerder.voerUit(input);
    },
    voerBulkUit: uitvoerder.voerBulkUit
      ? (input) => {
        try { reserveer(); } catch (error) { return Promise.reject(error); }
        return uitvoerder.voerBulkUit!(input);
      }
      : undefined,
  };
}
