import type { OffMarketPrioriteit, OffMarketStatus } from './types';

const AUTOMATISCHE_PRIORITEIT: Partial<Record<OffMarketStatus, OffMarketPrioriteit>> = {
  niet_interessant: 'laag',
  twijfel: 'laag',
  te_onderzoeken: 'midden',
  interessant: 'hoog',
};

export function bepaalReviewPrioriteit(input: {
  status: OffMarketStatus;
  huidigePrioriteit: OffMarketPrioriteit;
  handmatigAangepast: boolean;
}): OffMarketPrioriteit {
  if (input.handmatigAangepast) return input.huidigePrioriteit;
  return AUTOMATISCHE_PRIORITEIT[input.status] ?? input.huidigePrioriteit;
}

export function acquisitieSelectiePrioriteit(input: {
  huidigePrioriteit: OffMarketPrioriteit;
  handmatigAangepast: boolean;
}): OffMarketPrioriteit {
  return input.handmatigAangepast ? input.huidigePrioriteit : 'hoog';
}
