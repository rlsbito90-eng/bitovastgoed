// Rekenketen-uitleg: stap-voor-stap van input naar maximale aankoopprijs.
//
// Pure helper bovenop bestaande ComputedOutputs. Bevat geen rekenlogica
// en wijzigt geen waarden; alleen herleiding en bronvermelding.

import type { Scenario, ComputedOutputs } from '../types';
import { fieldStatus, type FieldStatus } from '../validation/fieldStatus';
import { resolveEffectiveBuyerFee, resolveEffectiveNotary } from '../fees/feeResolver';

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
  const fee = resolveEffectiveBuyerFee(scenario);
  steps.push({
    fase: 'kosten',
    label: 'Aankoopfee (incl. btw)',
    fields: ['scenario.buyer_fee_method', 'scenario.buyer_fee_amount', 'scenario.buyer_fee_percentage'],
    formula: fee.method === 'staffel' && fee.staffel.tier
      ? `${fee.staffel.tier.label} × basis (${fee.basisLabel}) = ${eur(fee.amountExVat)} ex. btw + ${fee.vatPct}% btw`
      : `${fee.pctExVat}% × ${eur(fee.basis)} = ${eur(fee.amountExVat)} ex. btw + ${fee.vatPct}% btw`,
    value: eur(fee.amountInclVat),
    status: fieldStatus(fee.amountInclVat),
    source: `${fee.sourceLabel} · basis: ${fee.basisLabel}`,
    note: fee.warnings.join(' • ') || undefined,
  });
  const notary = resolveEffectiveNotary(scenario);
  steps.push({
    fase: 'kosten',
    label: 'Notariskosten',
    fields: ['scenario.notary_costs_method', 'scenario.notary_costs_profile', 'scenario.notary_costs'],
    formula: notary.profile?.formula,
    value: eur(notary.amount),
    status: fieldStatus(notary.amount),
    source: notary.method === 'profile' && notary.profile
      ? `${notary.sourceLabel}: ${notary.profile.profile.label}`
      : notary.sourceLabel,
    note: [
      ...notary.warnings,
      notary.method === 'profile' ? 'Quickscan-default; controleer bij notaris/offerte vóór harde bieding.' : '',
    ].filter(Boolean).join(' • ') || undefined,
  });
  steps.push({
    fase: 'kosten',
    label: 'Overige aankoopkosten (advies, dd, overig, safety)',
    fields: ['scenario.advisory_costs', 'scenario.due_diligence_costs', 'scenario.other_acquisition_costs', 'scenario.safety_margin'],
    value: eur(o.totalAcquisitionCosts - fee.amountInclVat - notary.amount),
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
  const leadIsStrat = o.leadingMaxBasis === 'strategie';
  const leadIsSale = o.leadingMaxBasis === 'verkoop';
  steps.push({
    fase: 'vergelijking',
    label: 'Leidende maximale prijs',
    value: `${eur(o.leadingMaxValue)} (${o.leadingMaxBasisLabel})`,
    note: leadIsStrat
      ? 'Componentstrategie is leidend; maximumBid (BAR/exit) is informatief.'
      : leadIsSale
        ? 'Verkoop/exit-tak is leidend; componentstrategie en huur/BAR zijn informatief.'
        : 'Huur/BAR is leidend; componentstrategie en verkoop/exit zijn informatief.',
    source: 'computeScenario',
  });
  const askDiffSign = o.leadingDifferenceWithAskingPrice >= 0 ? '≥' : '<';
  steps.push({
    fase: 'vergelijking',
    label: 'Verschil met vraagprijs (leidend)',
    formula: 'leidende max prijs − vraagprijs',
    value: eur(o.leadingDifferenceWithAskingPrice),
    note: `Leidende waarde ${askDiffSign} vraagprijs.`,
  });
  if (Math.round(o.leadingDifferenceWithAskingPrice) !== Math.round(o.differenceWithAskingPrice)) {
    steps.push({
      fase: 'vergelijking',
      label: 'Verschil met vraagprijs (informatief, alternatief spoor)',
      formula: 'alternatieve max bieding − vraagprijs',
      value: eur(o.differenceWithAskingPrice),
      note: 'Niet leidend — alleen ter info.',
    });
  }

  // === DOABLE ===
  steps.push({
    fase: 'doable',
    label: 'Rond te rekenen bij vraagprijs?',
    value: o.leadingRoundsAtAsking == null ? '—' : o.leadingRoundsAtAsking ? 'Ja' : 'Nee',
    source: `Leidend: ${o.leadingMaxBasisLabel}`,
    note: o.leadingRoundsAtAsking == null
      ? 'Geen vraagprijs ingevuld.'
      : `Leidende waarde ${o.leadingRoundsAtAsking ? '≥' : '<'} vraagprijs.`,
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
