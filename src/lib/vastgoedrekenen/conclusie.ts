// Automatische conclusie en vervolgstap.

import type { ComputedOutputs } from './types';

const eur = (n: number | null | undefined) => n == null
  ? '—'
  : new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);

export function buildConclusion(o: Pick<ComputedOutputs,
  'dealScore' | 'barTotalInvestment' | 'maximumBid' | 'differenceWithAskingPrice' |
  'requiredDiscount' | 'inputReliability' | 'riskScore' | 'complexityScore' |
  'assessmentType' | 'scoreLabel' | 'netSaleProceeds' | 'netMargin' | 'roi' | 'exitValue'> & { askingPrice: number }): string {
  const bar = o.barTotalInvestment != null ? `${o.barTotalInvestment.toFixed(2)}%` : 'n.v.t.';
  const bid = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(o.maximumBid);

  if (o.assessmentType === 'verkoop') {
    if (o.netSaleProceeds == null && o.exitValue == null) {
      return 'Dit verkoop-/exitscenario heeft nog onvoldoende verkoopopbrengst of exitwaarde om financieel te beoordelen.';
    }
    const roi = o.roi != null ? `${o.roi.toFixed(1)}%` : 'n.v.t.';
    return `Op basis van de ingevoerde verkoopopbrengst ontstaat een nettomarge van ${eur(o.netMargin)} en een ROI van ${roi}. De maximale bieding op basis van exit bedraagt ${bid}. Score: ${o.scoreLabel}.`;
  }

  if (o.dealScore === 'A') {
    return `Dit object lijkt zeer interessant. De BAR op totale investering komt uit op ${bar}. Een realistische maximale bieding ligt rond ${bid}.`;
  }
  if (o.dealScore === 'B') {
    return `Dit object is interessant met aandachtspunten. De BAR op totale investering is ${bar}. Realistische maximale bieding circa ${bid}. Risico: ${o.riskScore}, complexiteit: ${o.complexityScore}.`;
  }
  if (o.dealScore === 'C') {
    const disc = o.requiredDiscount > 0
      ? `Een prijsverlaging van circa ${new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(o.requiredDiscount)} is nodig.`
      : '';
    return `Alleen interessant bij lagere aankoopprijs of betere voorwaarden. BAR op totale investering ${bar}. ${disc}`.trim();
  }
  return `Op basis van de huidige input is het object niet rond te rekenen. De totale investering is te hoog ten opzichte van de gecorrigeerde huur. Inputbetrouwbaarheid: ${o.inputReliability}.`;
}

export function buildNextStep(args: {
  inputReliability: 'laag' | 'middel' | 'hoog';
  missingWoz: boolean;
  missingLabel: boolean;
  missingContracts: boolean;
  hasWwsRisk: boolean;
  isMixedUseWithoutAlloc: boolean;
  dealScore: 'A' | 'B' | 'C' | 'reject';
}): string {
  if (args.dealScore === 'reject') return 'Object afwijzen of archiveren.';
  if (args.missingWoz) return 'Vraag WOZ-waarde op om de berekening betrouwbaarder te maken.';
  if (args.missingLabel) return 'Vraag energielabel op.';
  if (args.missingContracts) return 'Vraag huurcontracten op.';
  if (args.hasWwsRisk) return 'Laat WWS-check uitvoeren voor de woonunits onder 187 punten.';
  if (args.isMixedUseWithoutAlloc) return 'Reken OVB per component toe en raadpleeg bij twijfel notaris/fiscalist.';
  if (args.inputReliability === 'laag') return 'Verzamel ontbrekende kerngegevens vóór bieding.';
  if (args.dealScore === 'A') return 'Bereid bieding voor.';
  return 'Plan bouwkundige quickscan en bereid onderhandeling voor.';
}
