import type { LegacyOffMarketBriefRij } from './legacyBriefCompatibiliteit';
import { bepaalLegacyProductiestatus } from './legacyProductiestatusPariteit';

export interface LegacyOpvolgingGeschiktheid {
  geschikt: boolean;
  reden:
    | 'expliciet_gepost'
    | 'niet_gepost'
    | 'verzending_onzeker'
    | 'gearchiveerd';
  verzendbewijsOp: string | null;
  waarschuwingen: string[];
}

/**
 * Bepaalt of een legacybrief veilig in de opvolgflow mag komen.
 * Alleen een afzonderlijke postdatum geldt als hard bewijs van posten.
 */
export function bepaalLegacyOpvolgingGeschiktheid(
  rij: LegacyOffMarketBriefRij,
): LegacyOpvolgingGeschiktheid {
  const status = bepaalLegacyProductiestatus(rij);

  if (status.status === 'gearchiveerd') {
    return {
      geschikt: false,
      reden: 'gearchiveerd',
      verzendbewijsOp: status.verzendbewijsOp,
      waarschuwingen: status.waarschuwingen,
    };
  }

  if (status.status === 'verzonden_onzeker') {
    return {
      geschikt: false,
      reden: 'verzending_onzeker',
      verzendbewijsOp: status.verzendbewijsOp,
      waarschuwingen: status.waarschuwingen,
    };
  }

  if (status.status !== 'gepost' || !status.postBevestigd) {
    return {
      geschikt: false,
      reden: 'niet_gepost',
      verzendbewijsOp: null,
      waarschuwingen: status.waarschuwingen,
    };
  }

  return {
    geschikt: true,
    reden: 'expliciet_gepost',
    verzendbewijsOp: status.verzendbewijsOp,
    waarschuwingen: status.waarschuwingen,
  };
}
