import type { ProductieLeesActivatieBewijs } from './productieLeesActivatiePoort';
import type { ProductiekernLeesActivatieBesluit } from './productiekernLeesActivatieBesluit';
import { maakGepoorteProductiekernBulkLeesRepository } from './gepoorteProductiekernBulkLeesRepository';
import type { ProductiekernLeesSamenstelling } from './productiekernLeesSamenstelling';
import {
  SupabaseProductiekernBulkLeesRepository,
  type ProductiekernBulkLeesRepository,
} from './productiekernSupabaseBulkLeesRepository';
import {
  stelSupabaseProductiekernLezenSamen,
  stelSupabaseProductiekernLezenSamenMetBesluit,
} from './productiekernSupabaseLeesSamenstelling';
import { metProductiekernLeesBudget } from './productiekernSupabaseLeesBudget';
import { metSamengevoegdeProductiekernReads } from './productiekernSupabaseLeesSamenvoeging';
import {
  maakProductiekernSupabaseLeesTransport,
  type ProductiekernLeesTransportOpties,
  type ProductiekernSupabaseQueryUitvoerder,
} from './productiekernSupabaseLeesTransportAdapter';
import {
  maakWeerbareProductiekernLeesUitvoerder,
  type ProductiekernLeesWeerbaarheidOpties,
} from './productiekernSupabaseLeesWeerbaarheid';

export interface ProductiekernSupabaseClientOpties {
  transport?: ProductiekernLeesTransportOpties;
  weerbaarheid?: ProductiekernLeesWeerbaarheidOpties;
  maximaalAantalQueries?: number;
  gelijktijdigeIdentiekeReadsSamenvoegen?: boolean;
}

export interface ProductiekernSupabaseClientSamenstelling extends ProductiekernLeesSamenstelling {
  bulkRepository: ProductiekernBulkLeesRepository;
}

function bouwLeesKeten(
  uitvoerder: ProductiekernSupabaseQueryUitvoerder,
  opties: ProductiekernSupabaseClientOpties,
) {
  const gebudgetteerdeUitvoerder = metProductiekernLeesBudget(
    uitvoerder,
    opties.maximaalAantalQueries ?? 100,
  );
  const weerbareUitvoerder = maakWeerbareProductiekernLeesUitvoerder(
    gebudgetteerdeUitvoerder,
    opties.weerbaarheid,
  );
  const samengesteldeUitvoerder =
    opties.gelijktijdigeIdentiekeReadsSamenvoegen === false
      ? weerbareUitvoerder
      : metSamengevoegdeProductiekernReads(weerbareUitvoerder);

  return maakProductiekernSupabaseLeesTransport(
    samengesteldeUitvoerder,
    opties.transport,
  );
}

/**
 * Omgevingsneutrale samenstelling nadat een productie- of werk-CRM-poort zijn
 * bewijs al fail-closed heeft beoordeeld.
 */
export function stelProductiekernSupabaseClientSamenMetBesluit(
  activatie: ProductiekernLeesActivatieBesluit,
  uitvoerder: ProductiekernSupabaseQueryUitvoerder,
  opties: ProductiekernSupabaseClientOpties = {},
): ProductiekernSupabaseClientSamenstelling {
  const transport = bouwLeesKeten(uitvoerder, opties);
  const basis = stelSupabaseProductiekernLezenSamenMetBesluit(activatie, transport);
  const bulkAchterliggend = new SupabaseProductiekernBulkLeesRepository(transport);

  return {
    ...basis,
    bulkRepository: maakGepoorteProductiekernBulkLeesRepository(
      basis.activatie,
      bulkAchterliggend,
    ),
  };
}

/**
 * Productiespecifieke convenience-route. Querybudget -> timeout/retry ->
 * optionele gelijktijdige samenvoeging -> allowlisted querycontract ->
 * privacy-veilige transportadapter -> productie-readpoort.
 */
export function stelProductiekernSupabaseClientSamen(
  bewijs: Partial<ProductieLeesActivatieBewijs> | null | undefined,
  uitvoerder: ProductiekernSupabaseQueryUitvoerder,
  opties: ProductiekernSupabaseClientOpties = {},
): ProductiekernSupabaseClientSamenstelling {
  const transport = bouwLeesKeten(uitvoerder, opties);
  const basis = stelSupabaseProductiekernLezenSamen(bewijs, transport);
  const bulkAchterliggend = new SupabaseProductiekernBulkLeesRepository(transport);

  return {
    ...basis,
    bulkRepository: maakGepoorteProductiekernBulkLeesRepository(
      basis.activatie,
      bulkAchterliggend,
    ),
  };
}
