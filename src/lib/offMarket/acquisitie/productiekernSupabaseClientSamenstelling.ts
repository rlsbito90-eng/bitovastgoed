import type { ProductieLeesActivatieBewijs } from './productieLeesActivatiePoort';
import type { ProductiekernLeesSamenstelling } from './productiekernLeesSamenstelling';
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

/**
 * Volledige maar nog client-agnostische samenstelling:
 * querybudget -> timeout/retry -> optionele gelijktijdige samenvoeging ->
 * allowlisted querycontract -> privacy-veilige transportadapter -> bewijs- en
 * leespoort -> read-only repository.
 *
 * Het budget staat rond de ruwe uitvoerder zodat iedere echte poging, inclusief
 * retries, meetelt. De samenvoeging staat buiten de retryketen zodat identieke
 * gelijktijdige callers één volledige poging-/retryreeks delen.
 *
 * De concrete Supabase-client wordt bewust nog niet geïmporteerd. Daardoor kan
 * deze factory geen productieverbinding openen zonder een apart beoordeelde
 * uitvoerder en volledig leesbewijs.
 */
export function stelProductiekernSupabaseClientSamen(
  bewijs: Partial<ProductieLeesActivatieBewijs> | null | undefined,
  uitvoerder: ProductiekernSupabaseQueryUitvoerder,
  opties: ProductiekernSupabaseClientOpties = {},
): ProductiekernLeesSamenstelling {
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
  return stelSupabaseProductiekernLezenSamen(bewijs, transport);
}
