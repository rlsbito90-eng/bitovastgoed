// Rekenketen-uitleg: stap-voor-stap van input naar maximale aankoopprijs.
//
// Pure helper bovenop bestaande ComputedOutputs. Bevat geen rekenlogica
// en wijzigt geen waarden; alleen herleiding en bronvermelding.

import type { Scenario, ComputedOutputs } from '../types';
import { fieldStatus, type FieldStatus } from '../validation/fieldStatus';

export interface CalcChainStep {
  fase: 'input' | 'opbrengst' | 'kosten' | 'netto' | 'investering' | 'doel' | 'max_bod' | 'vergelijking' | 'doable';
  label: string;
  fields?: string[];
  formula?: string;
  value: number | string | null;
  source?: string;
  status?: FieldStatus;
  note?: string;
}

const eur = (n: number | null | undefined): string =>
  n == null ? '—' : new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);

export function buildCalcChain(scenario: Scenario, o: ComputedOutputs): CalcChainStep[] {
  const rec = scenario as unknown as Record<string, unknown>;
  const steps: CalcChainStep[] = [];

  // === INPUT ===
  steps.push({
    fase: 'input',
    label: 'Vraagprijs',
    fields: ['scenario.asking_price'],
    value: eur(Number(scenario.asking_price ?? 0)),
    status: fieldStatus(scenario.asking_price),
    source: 'Scenario',
  });
  steps.push({
    fase: 'input',
    label: 'Aankoopprijs (basis voor investering)',
    fields: ['scenario.purchase_price'],
    value: eur(Number(scenario.purchase_price ?? 0)),
    status: fieldStatus(scenario.purchase_price),
    source: 'Scenario',
  });
  steps.push({
    fase: 'input',
    label: 'Gewenste BAR (target_bar)',
    fields: ['scenario.target_bar'],
    value: Number(scenario.target_bar ?? 0) > 0 ? `${Number(scenario.target_bar).toFixed(2)}%` : '—',
    status: fieldStatus(scenario.target_bar),
    source: 'Scenario',
  });

  // === BRUTO OPBRENGST ===
  if (o.assessmentType === 'verkoop' || o.grossSaleProceeds != null) {
    steps.push({
      fase: 'opbrengst',
      label: 'Bruto verkoopopbrengst',
      fields: ['scenario.sale_price_total / strategyUnits.sale_price_*'],
      value: eur(o.grossSaleProceeds),
      status: fieldStatus(o.grossSaleProceeds),
      source: o.strategyEnabled ? 'Componentstrategie' : 'Scenario verkoopvelden',
    });
  }
  steps.push({
    fase: 'opbrengst',
    label: 'Gecorrigeerde jaarhuur (basis voor NOI)',
    fields: ['scenario.rent_source / components / wws'],
    value: eur(o.correctedAnnualRent),
    status: fieldStatus(o.correctedAnnualRent),
    source: String(scenario.rent_source ?? 'handmatig'),
  });

  // === KOSTEN ===
  steps.push({
    fase: 'kosten',
    label: 'Overdrachtsbelasting (OVB)',
    formula: 'tarief × grondslag (per component bij mixed-use)',
    value: eur(o.totalTransferTax),
    status: fieldStatus(o.totalTransferTax),
    source: `OVB-modus: ${scenario.ovb_mode ?? 'auto'}`,
  });
  steps.push({
    fase: 'kosten',
    label: 'Aankoopkosten (incl. safety margin)',
    fields: ['scenario.notary_costs', 'scenario.broker_costs', 'scenario.due_diligence_costs', 'scenario.safety_margin'],
    value: eur(o.totalAcquisitionCosts),
    status: fieldStatus(o.totalAcquisitionCosts),
    source: 'Scenario',
  });
  steps.push({
    fase: 'kosten',
    label: 'Bouw-/projectkosten (incl. onvoorzien & btw)',
    fields: ['scenario_costs[]', 'btw-behandeling per kostenpost'],
    value: eur(o.totalCosts),
    status: fieldStatus(o.totalCosts),
    note: o.totalCosts === 0 ? 'Geen bouwkosten geregistreerd — controleer of dit bewust is.' : undefined,
    source: 'scenario_costs tabel',
  });
  steps.push({
    fase: 'kosten',
    label: 'Financieringskosten',
    fields: ['scenario.financing_costs'],
    value: eur(Number(rec.financing_costs ?? 0)),
    status: fieldStatus(rec.financing_costs),
    source: 'Scenario',
  });

  // === NETTO / SCENARIOWAARDE ===
  if (o.netSaleProceeds != null) {
    steps.push({
      fase: 'netto',
      label: 'Netto verkoopopbrengst',
      formula: 'bruto opbrengst − verkoopkosten',
      value: eur(o.netSaleProceeds),
      status: fieldStatus(o.netSaleProceeds),
    });
  }
  steps.push({
    fase: 'netto',
    label: 'NOI (netto operationeel resultaat)',
    formula: 'gecorrigeerde huur − exploitatie − onderhoud − beheer − overig',
    value: eur(o.noi),
    status: fieldStatus(o.noi),
    note: `Totale correctie: ${o.totalCorrectionPct.toFixed(1)}%`,
  });
  if (o.strategyEnabled) {
    steps.push({
      fase: 'netto',
      label: 'Scenariowaarde (componentstrategie)',
      formula: 'aanhoudwaarde + netto verkoopopbrengsten units',
      value: eur(o.scenarioValue),
      status: fieldStatus(o.scenarioValue),
      source: 'Componentstrategie',
      note: o.strategyMix,
    });
  }

  // === INVESTERING ===
  steps.push({
    fase: 'investering',
    label: 'Totale investering',
    formula: 'aankoopprijs + OVB + aankoopkosten + bouwkosten + financiering',
    value: eur(o.totalInvestment),
    status: fieldStatus(o.totalInvestment),
  });

  // === DOEL ===
  steps.push({
    fase: 'doel',
    label: 'Bindend doel voor max bod',
    value: o.bidBasisUsed === 'verkoop' ? `Verkoop-tak (${o.exitBidBindingTarget ?? '—'})` : 'Huur/BAR-tak',
    source: 'computeScenario',
  });

  // === MAX BOD ===
  steps.push({
    fase: 'max_bod',
    label: 'Maximaal toelaatbare totale investering',
    formula: 'gecorrigeerde huur / (target_bar / 100)',
    value: eur(o.maximumAllInValue),
  });
  steps.push({
    fase: 'max_bod',
    label: 'Maximale bieding (huur/BAR-tak)',
    formula: 'max all-in − OVB − aankoopkosten − bouwkosten − financiering',
    value: eur(o.maximumBid),
  });
  if (o.exitBasedMaxBid != null) {
    steps.push({
      fase: 'max_bod',
      label: 'Maximale bieding (verkoop/exit-tak)',
      value: eur(o.exitBasedMaxBid),
      note: `Bindend doel: ${o.exitBidBindingTarget ?? '—'}`,
    });
  }
  if (o.maxPurchasePrice != null) {
    steps.push({
      fase: 'max_bod',
      label: 'Indicatieve max aankoopprijs (strategie)',
      value: eur(o.maxPurchasePrice),
      source: 'Componentstrategie',
    });
  }

  // === VERGELIJKING ===
  steps.push({
    fase: 'vergelijking',
    label: 'Leidende maximale prijs',
    value: `${eur(o.leadingMaxValue)} (${o.leadingMaxBasisLabel})`,
    note: o.strategyEnabled
      ? 'Bij actieve componentstrategie is maxPurchasePrice leidend; maximumBid (BAR/exit) is informatief.'
      : 'Geen componentstrategie actief — maximumBid is leidend.',
    source: 'computeScenario',
  });
  steps.push({
    fase: 'vergelijking',
    label: 'Verschil met vraagprijs (leidend)',
    formula: 'leidende max prijs − vraagprijs',
    value: eur(o.leadingDifferenceWithAskingPrice),
    note: o.leadingDifferenceWithAskingPrice >= 0 ? 'Ruimte boven vraagprijs.' : 'Korting nodig.',
  });
  if (o.strategyEnabled && Math.round(o.leadingDifferenceWithAskingPrice) !== Math.round(o.differenceWithAskingPrice)) {
    steps.push({
      fase: 'vergelijking',
      label: 'Verschil met vraagprijs (informatief, o.b.v. maximumBid)',
      formula: 'maximumBid − vraagprijs',
      value: eur(o.differenceWithAskingPrice),
      note: 'Niet leidend bij componentstrategie — gebruik de leidende waarde.',
    });
  }

  // === DOABLE ===
  steps.push({
    fase: 'doable',
    label: 'Rond te rekenen bij vraagprijs?',
    value: o.roundsAtAsking == null ? '—' : o.roundsAtAsking ? 'Ja' : 'Nee',
    source: o.strategyEnabled ? 'Componentstrategie (maxPurchasePrice)' : 'Niet van toepassing zonder strategie',
    note: o.strategyEnabled
      ? 'Gebaseerd op maxPurchasePrice ≥ vraagprijs.'
      : undefined,
  });

  return steps;
}

export const CALC_CHAIN_FASE_LABEL: Record<CalcChainStep['fase'], string> = {
  input: '1. Input',
  opbrengst: '2. Bruto opbrengst',
  kosten: '3. Kosten',
  netto: '4. Netto / scenariowaarde',
  investering: '5. Totale investering',
  doel: '6. Doel',
  max_bod: '7. Maximale bieding',
  vergelijking: '8. Verschil met vraagprijs',
  doable: '9. Rond te rekenen',
};
