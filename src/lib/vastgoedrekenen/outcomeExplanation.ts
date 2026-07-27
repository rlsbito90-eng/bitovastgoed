import type { ComputedOutputs, Scenario } from './types';

export type OutcomeOriginKind = 'input' | 'derived' | 'assumption' | 'computed';
export type OutcomeLineRole = 'basis' | 'deduction' | 'result';

export type OutcomeLine = {
  id: string;
  label: string;
  value: number;
  role: OutcomeLineRole;
  originKind: OutcomeOriginKind;
  originLabel: string;
  explanation?: string;
};

export type OutcomeStage = {
  id: string;
  title: string;
  formula: string;
  lines: OutcomeLine[];
  resultLabel: string;
  resultValue: number;
  roundingDifference: number;
};

export type OutcomeExplanation = {
  track: 'residueel' | 'exploitatie' | 'verkoop';
  title: string;
  summary: string;
  bindingLabel?: string;
  stages: OutcomeStage[];
};

const n = (value: unknown): number => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const roundedDifference = (expected: number, actual: number): number => Math.round(expected - actual);

function residualBindingLabel(outputs: ComputedOutputs): string {
  const target = outputs.residual?.bindingTarget;
  if (target === 'winst_op_gdv') return 'Winst op GDV';
  if (target === 'winst_op_kosten') return 'Winst op kosten';
  if (target === 'vaste_winst') return 'Vaste doelwinst';
  return 'Geen expliciete doelwinst';
}

function saleBindingLabel(outputs: ComputedOutputs): string | undefined {
  if (outputs.exitBidBindingTarget === 'marge_euro') return 'Vaste doelwinst';
  if (outputs.exitBidBindingTarget === 'marge_pct') return 'Winst op GDV';
  if (outputs.exitBidBindingTarget === 'roi') return 'Winst op kosten / ROI';
  if (outputs.exitBidBindingTarget === 'target_exit') return 'Maximale totale investering';
  return undefined;
}

function rentSourceLabel(scenario: Scenario): string {
  const source = String(scenario.rent_source ?? 'handmatig');
  if (source === 'componenten') return 'Afgeleid uit componenthuur';
  if (source === 'wws_gecorrigeerd') return 'Afgeleid uit WWS-units';
  if (source === 'handmatig_gecorrigeerd') return 'Handmatig gecorrigeerde huur';
  return 'Scenario-invoer';
}

function buildResidualExplanation(outputs: ComputedOutputs): OutcomeExplanation {
  const residual = outputs.residual!;
  const allowedFromGdv = residual.grossDevelopmentValue - residual.targetProfitAmount;
  const nonPurchaseCosts = residual.componentDispositionCosts
    + residual.componentDevelopmentCosts
    + residual.sharedScenarioCosts
    + residual.financingCosts
    + residual.transferTaxAtMaxPurchase
    + residual.acquisitionCostsAtMaxPurchase;

  return {
    track: 'residueel',
    title: 'Opbouw residuele maximale koopsom',
    summary: 'De opbrengstwaarde wordt eerst teruggebracht tot de toegestane totale investering. Daarna worden alle kosten buiten de koopsom afgetrokken.',
    bindingLabel: residualBindingLabel(outputs),
    stages: [
      {
        id: 'residual-allowed-investment',
        title: '1. Van opbrengstwaarde naar toegestane totale investering',
        formula: 'Opbrengstwaarde − doelwinst = toegestane totale investering',
        lines: [
          {
            id: 'gdv',
            label: 'GDV / opbrengstwaarde',
            value: residual.grossDevelopmentValue,
            role: 'basis',
            originKind: 'derived',
            originLabel: residual.source === 'componentstrategie' ? 'Afgeleid uit componentstrategie' : 'Afgeleid uit verkoop-/exitinvoer',
          },
          {
            id: 'target-profit',
            label: 'Doelwinst',
            value: residual.targetProfitAmount,
            role: 'deduction',
            originKind: 'assumption',
            originLabel: residualBindingLabel(outputs),
          },
        ],
        resultLabel: 'Toegestane totale investering',
        resultValue: residual.allowedTotalInvestment,
        roundingDifference: roundedDifference(allowedFromGdv, residual.allowedTotalInvestment),
      },
      {
        id: 'residual-purchase-price',
        title: '2. Van toegestane investering naar maximale koopsom',
        formula: 'Toegestane investering − overige kosten = maximale koopsom',
        lines: [
          {
            id: 'allowed-total-investment',
            label: 'Toegestane totale investering',
            value: residual.allowedTotalInvestment,
            role: 'basis',
            originKind: 'computed',
            originLabel: 'Uit stap 1',
          },
          {
            id: 'disposition-costs',
            label: 'Verkoop- en juridische kosten',
            value: residual.componentDispositionCosts,
            role: 'deduction',
            originKind: 'derived',
            originLabel: residual.source === 'componentstrategie' ? 'Som uit componentstrategie' : 'Berekend uit verkoopinvoer',
          },
          {
            id: 'component-development-costs',
            label: 'Directe componentontwikkelkosten',
            value: residual.componentDevelopmentCosts,
            role: 'deduction',
            originKind: 'derived',
            originLabel: 'Som van componentinvoer',
          },
          {
            id: 'shared-project-costs',
            label: 'Algemene projectkosten',
            value: residual.sharedScenarioCosts,
            role: 'deduction',
            originKind: 'derived',
            originLabel: 'Som van algemene kostenposten',
          },
          {
            id: 'financing-costs',
            label: 'Financieringskosten',
            value: residual.financingCosts,
            role: 'deduction',
            originKind: 'input',
            originLabel: 'Scenario-invoer',
          },
          {
            id: 'transfer-tax',
            label: 'Overdrachtsbelasting bij maximale koopsom',
            value: residual.transferTaxAtMaxPurchase,
            role: 'deduction',
            originKind: 'computed',
            originLabel: 'Opnieuw berekend bij maximale koopsom',
          },
          {
            id: 'acquisition-costs',
            label: 'Overige aankoopkosten bij maximale koopsom',
            value: residual.acquisitionCostsAtMaxPurchase,
            role: 'deduction',
            originKind: 'computed',
            originLabel: 'Opnieuw berekend bij maximale koopsom',
          },
        ],
        resultLabel: 'Residuele maximale koopsom',
        resultValue: residual.maxPurchasePrice,
        roundingDifference: roundedDifference(residual.allowedTotalInvestment - nonPurchaseCosts, residual.maxPurchasePrice),
      },
    ],
  };
}

function buildExploitationExplanation(scenario: Scenario, outputs: ComputedOutputs): OutcomeExplanation {
  const totalCorrections = outputs.vacancyCorrectionEur
    + outputs.operatingCostsEur
    + outputs.maintenanceCostsEur
    + outputs.managementCostsEur
    + outputs.otherCostsEur;
  const financing = n(scenario.financing_costs);
  const overhead = outputs.totalTransferTax + outputs.totalAcquisitionCosts + outputs.totalCosts + financing;
  const targetBar = n(scenario.target_bar);

  return {
    track: 'exploitatie',
    title: 'Opbouw maximale bieding op huur / BAR',
    summary: 'De gekozen jaarhuur wordt gecorrigeerd naar NOI. Vanuit de gewenste BAR volgt de maximale all-inwaarde en daarna de maximale bieding.',
    bindingLabel: targetBar > 0 ? `Doel-BAR ${targetBar.toLocaleString('nl-NL')}%` : 'Doel-BAR ontbreekt',
    stages: [
      {
        id: 'rent-to-noi',
        title: '1. Van gecorrigeerde jaarhuur naar NOI',
        formula: 'Jaarhuur − exploitatiecorrecties = NOI',
        lines: [
          {
            id: 'corrected-rent',
            label: 'Gecorrigeerde jaarhuur',
            value: outputs.correctedAnnualRent,
            role: 'basis',
            originKind: 'derived',
            originLabel: rentSourceLabel(scenario),
          },
          { id: 'vacancy', label: 'Leegstandscorrectie', value: outputs.vacancyCorrectionEur, role: 'deduction', originKind: 'assumption', originLabel: 'Aannameprofiel / scenario' },
          { id: 'operating', label: 'Exploitatiekosten', value: outputs.operatingCostsEur, role: 'deduction', originKind: 'assumption', originLabel: 'Aannameprofiel / scenario' },
          { id: 'maintenance', label: 'Onderhoudsreserve', value: outputs.maintenanceCostsEur, role: 'deduction', originKind: 'assumption', originLabel: 'Aannameprofiel / scenario' },
          { id: 'management', label: 'Beheerkosten', value: outputs.managementCostsEur, role: 'deduction', originKind: 'assumption', originLabel: 'Aannameprofiel / scenario' },
          { id: 'other-annual', label: 'Overige jaarlijkse correcties', value: outputs.otherCostsEur, role: 'deduction', originKind: 'derived', originLabel: 'Profiel en/of scenario-invoer' },
        ],
        resultLabel: 'Net operating income (NOI)',
        resultValue: outputs.noi,
        roundingDifference: roundedDifference(outputs.correctedAnnualRent - totalCorrections, outputs.noi),
      },
      {
        id: 'noi-to-bid',
        title: '2. Van maximale all-inwaarde naar maximale bieding',
        formula: 'Maximale all-inwaarde − aankoop- en projectkosten = maximale bieding',
        lines: [
          { id: 'max-all-in', label: 'Maximale all-inwaarde', value: outputs.maximumAllInValue, role: 'basis', originKind: 'computed', originLabel: targetBar > 0 ? `NOI / doel-BAR ${targetBar.toLocaleString('nl-NL')}%` : 'Berekend uit NOI en BAR' },
          { id: 'ovb', label: 'Overdrachtsbelasting', value: outputs.totalTransferTax, role: 'deduction', originKind: 'computed', originLabel: 'OVB-instellingen en aankoopbasis' },
          { id: 'acquisition', label: 'Overige aankoopkosten', value: outputs.totalAcquisitionCosts, role: 'deduction', originKind: 'derived', originLabel: 'Scenario-invoer / profiel' },
          { id: 'project-costs', label: 'Bouw- en projectkosten', value: outputs.totalCosts, role: 'deduction', originKind: 'derived', originLabel: 'Som van kostenposten' },
          { id: 'financing', label: 'Financieringskosten', value: financing, role: 'deduction', originKind: 'input', originLabel: 'Scenario-invoer' },
        ],
        resultLabel: 'Maximale bieding',
        resultValue: outputs.maximumBid,
        roundingDifference: roundedDifference(outputs.maximumAllInValue - overhead, outputs.maximumBid),
      },
    ],
  };
}

function buildSaleExplanation(scenario: Scenario, outputs: ComputedOutputs): OutcomeExplanation {
  const gross = n(outputs.grossSaleProceeds ?? outputs.exitValue);
  const saleCosts = n(outputs.saleCostsTotal);
  const net = n(outputs.netSaleProceeds ?? outputs.exitValue);
  const financing = n(scenario.financing_costs);
  const overhead = outputs.totalTransferTax + outputs.totalAcquisitionCosts + outputs.totalCosts + financing;
  const allowedTotalInvestment = outputs.bidBasisUsed === 'verkoop' ? outputs.maximumBid + overhead : outputs.totalInvestment;
  const secondStageUsesBid = outputs.bidBasisUsed === 'verkoop' && outputs.maximumBid > 0;

  return {
    track: 'verkoop',
    title: secondStageUsesBid ? 'Opbouw maximale bieding op verkoop / exit' : 'Opbouw verkoopresultaat',
    summary: secondStageUsesBid
      ? 'De bruto verkoopopbrengst wordt eerst netto gemaakt. Het bindende winstdoel bepaalt daarna hoeveel totale investering en koopsom maximaal zijn toegestaan.'
      : 'De bruto verkoopopbrengst wordt netto gemaakt en afgezet tegen de huidige totale investering.',
    bindingLabel: saleBindingLabel(outputs),
    stages: [
      {
        id: 'gross-to-net-sale',
        title: '1. Van bruto naar netto verkoopopbrengst',
        formula: 'Bruto verkoopopbrengst − verkoopkosten = netto verkoopopbrengst',
        lines: [
          { id: 'gross-sale', label: 'Bruto verkoopopbrengst', value: gross, role: 'basis', originKind: outputs.strategyEnabled ? 'derived' : 'input', originLabel: outputs.strategyEnabled ? 'Afgeleid uit componentstrategie' : 'Scenario-invoer / afgeleide verkoopwaarde' },
          { id: 'sale-costs', label: 'Verkoop- en juridische kosten', value: saleCosts, role: 'deduction', originKind: 'derived', originLabel: 'Berekend uit verkoopinvoer' },
        ],
        resultLabel: 'Netto verkoopopbrengst',
        resultValue: net,
        roundingDifference: roundedDifference(gross - saleCosts, net),
      },
      secondStageUsesBid
        ? {
            id: 'net-sale-to-bid',
            title: '2. Van toegestane investering naar maximale bieding',
            formula: 'Toegestane totale investering − aankoop- en projectkosten = maximale bieding',
            lines: [
              { id: 'allowed-investment', label: 'Toegestane totale investering', value: allowedTotalInvestment, role: 'basis', originKind: 'computed', originLabel: saleBindingLabel(outputs) ?? 'Bindend verkoopdoel' },
              { id: 'ovb', label: 'Overdrachtsbelasting', value: outputs.totalTransferTax, role: 'deduction', originKind: 'computed', originLabel: 'OVB-instellingen en aankoopbasis' },
              { id: 'acquisition', label: 'Overige aankoopkosten', value: outputs.totalAcquisitionCosts, role: 'deduction', originKind: 'derived', originLabel: 'Scenario-invoer / profiel' },
              { id: 'project-costs', label: 'Bouw- en projectkosten', value: outputs.totalCosts, role: 'deduction', originKind: 'derived', originLabel: 'Som van kostenposten' },
              { id: 'financing', label: 'Financieringskosten', value: financing, role: 'deduction', originKind: 'input', originLabel: 'Scenario-invoer' },
            ],
            resultLabel: 'Maximale bieding',
            resultValue: outputs.maximumBid,
            roundingDifference: roundedDifference(allowedTotalInvestment - overhead, outputs.maximumBid),
          }
        : {
            id: 'net-sale-to-margin',
            title: '2. Van netto opbrengst naar projectresultaat',
            formula: 'Netto verkoopopbrengst − totale investering = nettomarge',
            lines: [
              { id: 'net-sale', label: 'Netto verkoopopbrengst', value: net, role: 'basis', originKind: 'computed', originLabel: 'Uit stap 1' },
              { id: 'total-investment', label: 'Totale investering', value: outputs.totalInvestment, role: 'deduction', originKind: 'computed', originLabel: 'Koopsom, aankoopkosten, projectkosten en financiering' },
            ],
            resultLabel: 'Nettomarge',
            resultValue: n(outputs.netMargin),
            roundingDifference: roundedDifference(net - outputs.totalInvestment, n(outputs.netMargin)),
          },
    ],
  };
}

export function buildOutcomeExplanation(scenario: Scenario, outputs: ComputedOutputs): OutcomeExplanation | null {
  if (outputs.residual) return buildResidualExplanation(outputs);
  if (outputs.assessmentType === 'exploitatie') return buildExploitationExplanation(scenario, outputs);
  if (outputs.saleHasInput || outputs.netSaleProceeds != null || outputs.exitValue != null) return buildSaleExplanation(scenario, outputs);
  return null;
}
