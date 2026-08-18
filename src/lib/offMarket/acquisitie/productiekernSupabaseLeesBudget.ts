import type { ProductiekernSupabaseQueryUitvoerder } from './productiekernSupabaseLeesTransportAdapter';

export class ProductiekernLeesBudgetOverschredenError extends Error {
  readonly code = 'ACQUISITIE_PRODUCTIEKERN_LEESBUDGET_OVERSCHREDEN';

  constructor(readonly maximaalAantalQueries: number) {
    super('Het begrensde productiekern-leesbudget is overschreden.');
    this.name = 'ProductiekernLeesBudgetOverschredenError';
  }
}

/**
 * Harde bovengrens voor één samengestelde Productiekern-readworkflow.
 *
 * De BAT-herstelroute valideert bewust iedere gekoppelde immutable brief en
 * versie opnieuw. Voor batches met tientallen brieven is de eerdere grens van
 * 100 te krap voor die fail-closed validatie. De bovengrens blijft daarom
 * expliciet en eindig, maar laat een normale bulkproductieronde wel toe.
 */
export const MAX_PRODUCTIEKERN_LEESBUDGET = 200;

export function metProductiekernLeesBudget(
  uitvoerder: ProductiekernSupabaseQueryUitvoerder,
  maximaalAantalQueries = 100,
): ProductiekernSupabaseQueryUitvoerder {
  if (!Number.isInteger(maximaalAantalQueries)
      || maximaalAantalQueries < 1
      || maximaalAantalQueries > MAX_PRODUCTIEKERN_LEESBUDGET) {
    throw new Error(`Productiekern-leesbudget moet tussen 1 en ${MAX_PRODUCTIEKERN_LEESBUDGET} queries liggen.`);
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
