import type { ProductieLeesActivatieBewijs } from './productieLeesActivatiePoort';
import { maakGepoorteProductiekernBulkLeesRepository } from './gepoorteProductiekernBulkLeesRepository';
import type { ProductiekernLeesSamenstelling } from './productiekernLeesSamenstelling';
import {
  SupabaseProductiekernBulkLeesRepository,
  type ProductiekernBulkLeesRepository,
} from './productiekernSupabaseBulkLeesRepository';
import { stelSupabaseProductiekernLezenSamen } from './productiekernSupabaseLeesSamenstelling';
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

/**
 * Volledige maar nog client-agnostische samenstelling:
 * querybudget -> timeout/retry -> optionele gelijktijdige samenvoeging ->
 * allowlisted querycontract -> privacy-veilige transportadapter -> bewijs- en
 * leespoort -> read-only repositories.
 *
 * Single- en bulkreads delen exact dezelfde budget-/weerbaarheidsketen en
 * hetzelfde centrale activatiebesluit. De concrete Supabase-client wordt hier
 * bewust niet geïmporteerd of automatisch verbonden.
 */
export function stelProductiekernSupabaseClientSamen(
  bewijs: Partial<ProductieLeesActivatieBewijs> | null | undefined,
  uitvoerder: ProductiekernSupabaseQueryUitvoerder,
  opties: ProductiekernSupabaseClientOpties = {},
): ProductiekernSupabaseClientSamenstelling {
  const gebudgetteerdeUitvoerder = metProductiekernLeesBudget(
    uitvoerder,
    opties.maximaalAantalQueries ?? 25,
  );
  const weerbareUitvoerder = maakWeerbareProductiekernLeesUitvoerder(
    gebudgetteerdeUitvoerder,
    opties.weerbaarheid,
  );
  const samengesteldeUitvoerder =
    opties.gelijktijdigeIdentiekeReadsSamenvoegen === false
      ? weerbareUitvoerder
      : metSamengevoegdeProductiekernReads(weerbareUitvoerder);
  const transport = maakProductiekernSupabaseLeesTransport(
    samengesteldeUitvoerder,
    opties.transport,
  );
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
