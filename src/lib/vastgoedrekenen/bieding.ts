// Biedingsadvies: terugrekenen vanaf gewenste BAR naar maximale bieding.

import { VR_DEFAULTS } from './defaults';

export type BidAdvice = {
  maxAllInValue: number;
  maxBid: number;
  conservative: number;
  realistic: number;
  aggressive: number;
  notInterestingAbove: number;
};

export function computeBidAdvice(args: {
  correctedAnnualRent: number;
  targetBar: number; // %
  totalAcquisitionCosts: number;
  totalCosts: number;
  financingCosts: number;
  safetyMargin: number;
}): BidAdvice {
  const { correctedAnnualRent, targetBar } = args;
  const safe = (bar: number) => (bar > 0 ? Math.round((correctedAnnualRent / bar) * 100) : 0);

  const maxAllInValue = safe(targetBar);
  const overhead = args.totalAcquisitionCosts + args.totalCosts + args.financingCosts + args.safetyMargin;
  const toBid = (allIn: number) => Math.max(0, allIn - overhead);

  return {
    maxAllInValue,
    maxBid: toBid(maxAllInValue),
    aggressive: toBid(safe(Math.max(0.1, targetBar - VR_DEFAULTS.barStepPct))),
    realistic: toBid(maxAllInValue),
    conservative: toBid(safe(targetBar + VR_DEFAULTS.barStepPct)),
    notInterestingAbove: toBid(safe(Math.max(0.1, targetBar - VR_DEFAULTS.barStepPct * 2))),
  };
}
