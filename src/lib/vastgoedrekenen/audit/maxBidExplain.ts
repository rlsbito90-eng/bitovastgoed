// Stap-voor-stap onderbouwing van Maximale bieding / Maximale aankoopprijs.
// Pure helper: gebruikt enkel bestaande publieke compute-functies + outputs.

import type { Scenario, ComputedOutputs } from '../types';
import type { MaxBidExplainStep } from './types';

const eur = (n: number | null | undefined) =>
  n == null ? '—' : new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);

export function buildMaxBidExplain(scenario: Scenario, outputs: ComputedOutputs): MaxBidExplainStep[] {
  const rec = scenario as unknown as Record<string, unknown>;
  const targetBar = Number(scenario.target_bar ?? 6);
  const steps: MaxBidExplainStep[] = [];

  steps.push({
    label: 'Actieve huurbron',
    value: String(scenario.rent_source ?? 'handmatig'),
    note: 'Bepaalt of huur uit scenario, componenten of WWS komt.',
  });
  steps.push({ label: 'Huidige jaarhuur', value: eur(outputs.currentAnnualRent) });
  steps.push({ label: 'Markthuur (jaar)', value: eur(outputs.marketAnnualRent) });
  steps.push({ label: 'WWS-gecorrigeerde jaarhuur', value: eur(outputs.wwsCorrectedAnnualRent) });
  steps.push({
    label: 'Gecorrigeerde jaarhuur (basis voor NOI)',
    value: eur(outputs.correctedAnnualRent),
    note: 'Op basis van rent_choice / rent_source.',
  });
  steps.push({
    label: 'Totale correctiepercentages (leegstand + exploitatie + onderhoud + beheer + overig)',
    value: `${outputs.totalCorrectionPct.toFixed(1)}%`,
  });
  steps.push({ label: 'NOI', value: eur(outputs.noi), formula: 'gecorrigeerde huur − correcties − overige jaarlasten' });

  steps.push({ label: 'Gewenste BAR (target_bar)', value: `${targetBar.toFixed(2)}%` });
  steps.push({
    label: 'Maximaal toelaatbare totale investering',
    value: eur(outputs.maximumAllInValue),
    formula: 'gecorrigeerde huur / (target_bar / 100)',
  });
  steps.push({ label: '− OVB', value: eur(outputs.totalTransferTax) });
  steps.push({ label: '− Aankoopkosten (incl. safety_margin)', value: eur(outputs.totalAcquisitionCosts) });
  steps.push({ label: '− Bouw-/projectkosten (incl. onvoorzien & meegenomen btw)', value: eur(outputs.totalCosts) });
  steps.push({ label: '− Financieringskosten', value: eur(Number(scenario.financing_costs ?? 0)) });
  steps.push({
    label: 'Maximale bieding (BAR-tak)',
    value: eur(outputs.maximumBid),
    formula: 'max all-in − OVB − aankoopkosten − projectkosten − financieringskosten',
  });

  if (outputs.exitBasedMaxBid != null) {
    steps.push({
      label: 'Maximale bieding (exit-tak, netto na overhead)',
      value: eur(outputs.exitBasedMaxBid),
      note: `Bindend doel: ${outputs.exitBidBindingTarget ?? '—'}`,
    });
  }

  steps.push({
    label: 'Gebruikte basis voor effectieve maxBid',
    value: outputs.bidBasisUsed,
    note: outputs.bidBasisUsed === 'verkoop' ? 'Verkoopcase: exit-tak gebruikt.' : 'Exploitatie/huur-tak gebruikt.',
  });

  if (outputs.strategyEnabled) {
    steps.push({ label: 'Scenariowaarde (componentstrategie)', value: eur(outputs.scenarioValue) });
    steps.push({ label: 'Indicatieve maxPurchasePrice (strategie)', value: eur(outputs.maxPurchasePrice) });
  }

  steps.push({
    label: 'Leidende basis voor maximale prijs',
    value: outputs.leadingMaxBasisLabel,
    note: 'Alle conclusies (rond te rekenen, verschil met vraagprijs, max prijs) volgen deze basis.',
  });
  steps.push({
    label: 'Leidende maximale prijs',
    value: eur(outputs.leadingMaxValue),
  });
  steps.push({
    label: 'Verschil met vraagprijs (leidend)',
    value: eur(outputs.leadingDifferenceWithAskingPrice),
    note: `Leidende waarde ${outputs.leadingDifferenceWithAskingPrice >= 0 ? '≥' : '<'} vraagprijs.`,
  });
  steps.push({
    label: 'Rond te rekenen bij vraagprijs?',
    value: outputs.leadingRoundsAtAsking == null ? '—' : outputs.leadingRoundsAtAsking ? 'Ja' : 'Nee',
    note: `Leidend: ${outputs.leadingMaxBasisLabel}.`,
  });
  if (Math.round(outputs.leadingDifferenceWithAskingPrice) !== Math.round(outputs.differenceWithAskingPrice)) {
    steps.push({
      label: 'Verschil met vraagprijs (informatief, alternatief spoor)',
      value: eur(outputs.differenceWithAskingPrice),
      note: 'Niet leidend.',
    });
  }
  steps.push({
    label: 'Sale_target inputs',
    value: [
      `marge € ${Number(rec.sale_target_margin_amount ?? 0)}`,
      `marge % ${Number(rec.sale_target_margin_percentage ?? 0)}`,
      `ROI ${Number(rec.sale_target_roi_percentage ?? 0)}%`,
      `exit € ${Number(rec.sale_target_exit_value ?? 0)}`,
    ].join(' · '),
  });

  return steps;
}
