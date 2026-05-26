// Huuranalyse-helpers: bruto, gecorrigeerd, NOI, BAR, factor.

import type { Scenario, WwsUnit } from './types';

export function annualFromMonthly(m: number | null | undefined): number {
  return Math.round((Number(m ?? 0)) * 12);
}

export function getWwsCorrectedAnnualRent(units: WwsUnit[]): number {
  return units.reduce((sum, u) => {
    const monthly = u.corrected_monthly_rent ?? u.wws_max_monthly_rent ?? u.current_monthly_rent ?? 0;
    return sum + Number(monthly) * 12;
  }, 0);
}

export function pickCorrectedAnnualRent(
  scenario: Pick<Scenario,
    'rent_choice' | 'current_monthly_rent' | 'market_monthly_rent' | 'manual_corrected_monthly_rent'>,
  wwsAnnual: number,
): number {
  const current = annualFromMonthly(scenario.current_monthly_rent);
  const market = annualFromMonthly(scenario.market_monthly_rent);
  const manual = annualFromMonthly(scenario.manual_corrected_monthly_rent);
  switch (scenario.rent_choice) {
    case 'huidig': return current;
    case 'markt': return market;
    case 'wws':
      if (wwsAnnual > 0) return wwsAnnual;
      // Geen WWS-units aangemaakt: val terug op laagste beschikbare van huidig/markt.
      if (current > 0 && market > 0) return Math.min(current, market);
      return current || market || 0;
    case 'handmatig': return manual;
    default:
      // Standaard: voorzichtigste positieve waarde
      if (wwsAnnual > 0 && market > 0) return Math.min(wwsAnnual, market);
      return current || market || wwsAnnual;
  }
}

export function computeNoi(
  brutoJaar: number,
  pct: { vacancyPct: number; operatingCostPct: number; maintenanceReservePct: number; managementCostPct: number },
  otherAnnualCosts: number,
): number {
  const totaalPct = pct.vacancyPct + pct.operatingCostPct + pct.maintenanceReservePct + pct.managementCostPct;
  const aftrek = Math.round((brutoJaar * totaalPct) / 100) + Math.round(Number(otherAnnualCosts || 0));
  return Math.max(0, brutoJaar - aftrek);
}

export function bar(jaarhuur: number, grondslag: number): number | null {
  if (!grondslag || grondslag <= 0) return null;
  return Number(((jaarhuur / grondslag) * 100).toFixed(2));
}

export function factor(grondslag: number, jaarhuur: number): number | null {
  if (!jaarhuur || jaarhuur <= 0) return null;
  return Number((grondslag / jaarhuur).toFixed(2));
}
