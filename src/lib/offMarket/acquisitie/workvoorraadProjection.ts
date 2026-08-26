import type { RoutingResult } from '@/lib/offMarket/acquisitie/partyCampaign';
import type { WerkvoorraadStatus } from '@/hooks/useAcquisitieSelectie';

export interface WerkvoorraadRouteRij {
  itemKey: string;
  routing: RoutingResult;
  partijMatchBevestigd: boolean;
}

export interface WerkvoorraadProjectieResultaat {
  status: WerkvoorraadStatus;
  reden: string;
  partijMatchBeoordelen: boolean;
}

/**
 * Eén deterministische projectie per signaal. De onderliggende campagne/contact-
 * historie blijft bronwaarheid; deze status is alleen de begrijpelijke dagwerkbak.
 */
export function bepaalWerkvoorraadProjectie(
  rijen: WerkvoorraadRouteRij[],
  productieKeys: Set<string>,
): WerkvoorraadProjectieResultaat {
  if (rijen.length === 0) {
    return { status: 'actief', reden: 'Geen partijrouting beschikbaar.', partijMatchBeoordelen: false };
  }

  const onzeker = rijen.find((r) => !r.partijMatchBevestigd || r.routing.outcome === 'benadering_bepalen');
  if (onzeker) {
    return {
      status: 'benadering_bepalen',
      reden: onzeker.routing.reden,
      partijMatchBeoordelen: !onzeker.partijMatchBevestigd,
    };
  }

  const productie = rijen.find((r) => productieKeys.has(r.itemKey));
  if (productie) {
    return {
      status: 'actief',
      reden: `Briefactie bevestigd: ${productie.routing.reden}`,
      partijMatchBeoordelen: false,
    };
  }

  const herbenadering = rijen.find((r) => r.routing.outcome === 'herbenadering_voorstellen');
  if (herbenadering) {
    return { status: 'benadering_bepalen', reden: herbenadering.routing.reden, partijMatchBeoordelen: false };
  }

  const eerder = rijen.find((r) =>
    r.routing.outcome === 'gespreksonderwerp'
    || r.routing.outcome === 'alleen_registreren',
  );
  if (eerder) {
    return { status: 'eerder_benaderd', reden: eerder.routing.reden, partijMatchBeoordelen: false };
  }

  if (rijen.every((r) => r.routing.outcome === 'niet_benaderen')) {
    return {
      status: 'niet_benaderen',
      reden: rijen[0].routing.reden,
      partijMatchBeoordelen: false,
    };
  }

  const gebundeld = rijen.find((r) =>
    r.routing.outcome === 'bundelen_bij_partij'
    || r.routing.outcome === 'meenemen_in_vervolgbrief',
  );
  if (gebundeld) {
    return {
      status: 'gebundeld_bij_partij',
      reden: gebundeld.routing.reden,
      partijMatchBeoordelen: false,
    };
  }

  return { status: 'actief', reden: rijen[0].routing.reden, partijMatchBeoordelen: false };
}
