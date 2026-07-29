import type { ScenarioUnleveredCashflowResult } from './scenarioUnleveredCashflow';

export type FinancingFacilityType = 'acquisition' | 'development' | 'bridge' | 'mortgage' | 'other';
export type FinancingDrawMethod = 'single_month' | 'project_deficit';
export type FinancingInterestMethod = 'cash' | 'capitalized';
export type FinancingRepaymentMethod = 'bullet' | 'linear';

export type ScenarioFinancingFacility = {
  id: string;
  scenario_id: string;
  facility_name: string;
  facility_type: FinancingFacilityType;
  commitment_amount: number;
  draw_method: FinancingDrawMethod;
  draw_start_month: number;
  annual_interest_rate_pct: number;
  interest_method: FinancingInterestMethod;
  arrangement_fee_pct: number | null;
  arrangement_fee_amount: number | null;
  repayment_method: FinancingRepaymentMethod;
  amortization_start_month: number | null;
  maturity_month: number;
  source: string;
  notes: string | null;
  sort_order: number;
  schema_version: number;
  created_at?: string;
  updated_at?: string;
};

export type ScenarioFinancingMonth = {
  month: number;
  unleveredCashflow: number;
  debtDraws: number;
  cashInterest: number;
  capitalizedInterest: number;
  arrangementFees: number;
  principalRepayment: number;
  closingDebtBalance: number;
  equityCashflow: number;
  cumulativeEquityCashflow: number;
};

export type ScenarioFinancingPeriod = Omit<
  ScenarioFinancingMonth,
  'month' | 'closingDebtBalance' | 'cumulativeEquityCashflow'
> & {
  periodIndex: number;
  label: string;
  fromMonth: number;
  toMonth: number;
  closingDebtBalance: number;
};

export type ScenarioFinancingResult = {
  ready: boolean;
  monthly: ScenarioFinancingMonth[];
  periods: ScenarioFinancingPeriod[];
  totalDebtDraws: number;
  totalCashInterest: number;
  totalCapitalizedInterest: number;
  totalArrangementFees: number;
  totalPrincipalRepayment: number;
  peakDebt: number;
  peakEquityRequirement: number;
  equityContributions: number;
  equityDistributions: number;
  equityMultiple: number | null;
  leveredIrrAnnualPct: number | null;
  leveredIrrMonthlyPct: number | null;
  irrStatus: 'ok' | 'not_applicable' | 'ambiguous' | 'no_solution';
  loanToCostPct: number | null;
  blockers: string[];
  warnings: string[];
};

type FacilityState = {
  facility: ScenarioFinancingFacility;
  balance: number;
  totalDrawn: number;
  feeCharged: boolean;
};

function addUnique(target: string[], value: string): void {
  if (!target.includes(value)) target.push(value);
}

function finite(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function validateFacility(
  facility: ScenarioFinancingFacility,
  horizonMonths: number,
  blockers: string[],
): void {
  const name = facility.facility_name.trim() || 'Naamloze financiering';
  if (facility.schema_version !== 1) addUnique(blockers, `${name}: onbekende financieringsversie.`);
  if (finite(facility.commitment_amount) <= 0) addUnique(blockers, `${name}: vul een positief maximaal leenbedrag in.`);
  if (!Number.isInteger(facility.draw_start_month) || facility.draw_start_month < 0) {
    addUnique(blockers, `${name}: de eerste opnamemaand is ongeldig.`);
  }
  if (!Number.isInteger(facility.maturity_month) || facility.maturity_month <= facility.draw_start_month) {
    addUnique(blockers, `${name}: de eindmaand moet later zijn dan de eerste opnamemaand.`);
  }
  if (facility.maturity_month > horizonMonths) {
    addUnique(blockers, `${name}: de eindmaand valt buiten de Quickscan-horizon.`);
  }
  if (facility.annual_interest_rate_pct < 0 || facility.annual_interest_rate_pct > 100) {
    addUnique(blockers, `${name}: de jaarlijkse rente moet tussen 0% en 100% liggen.`);
  }
  if (!facility.source.trim()) addUnique(blockers, `${name}: leg de bron of onderbouwing van de financiering vast.`);
  if (facility.repayment_method === 'linear') {
    if (
      facility.amortization_start_month === null
      || !Number.isInteger(facility.amortization_start_month)
      || facility.amortization_start_month < facility.draw_start_month
      || facility.amortization_start_month > facility.maturity_month
    ) {
      addUnique(blockers, `${name}: vul bij lineaire aflossing een geldige startmaand in.`);
    }
  } else if (facility.amortization_start_month !== null) {
    addUnique(blockers, `${name}: bij aflossingsvrij hoort geen startmaand voor lineaire aflossing.`);
  }
  if (facility.arrangement_fee_amount !== null && facility.arrangement_fee_pct !== null) {
    addUnique(blockers, `${name}: gebruik afsluitkosten als percentage óf als vast bedrag, niet allebei.`);
  }
}

function arrangementFee(facility: ScenarioFinancingFacility): number {
  if (facility.arrangement_fee_amount !== null) return Math.max(0, finite(facility.arrangement_fee_amount));
  if (facility.arrangement_fee_pct !== null) {
    return Math.max(0, Math.round(finite(facility.commitment_amount) * finite(facility.arrangement_fee_pct) / 100));
  }
  return 0;
}

function periodMeta(month: number): Pick<ScenarioFinancingPeriod, 'periodIndex' | 'label' | 'fromMonth' | 'toMonth'> {
  if (month === 0) return { periodIndex: 0, label: 'Maand 0', fromMonth: 0, toMonth: 0 };
  const periodIndex = Math.ceil(month / 12);
  const fromMonth = (periodIndex - 1) * 12 + 1;
  const toMonth = periodIndex * 12;
  return { periodIndex, label: `Jaar ${periodIndex} · maand ${fromMonth}–${toMonth}`, fromMonth, toMonth };
}

function aggregatePeriods(monthly: ScenarioFinancingMonth[]): ScenarioFinancingPeriod[] {
  const periods = new Map<number, ScenarioFinancingPeriod>();
  for (const row of monthly) {
    const meta = periodMeta(row.month);
    const current = periods.get(meta.periodIndex) ?? {
      ...meta,
      unleveredCashflow: 0,
      debtDraws: 0,
      cashInterest: 0,
      capitalizedInterest: 0,
      arrangementFees: 0,
      principalRepayment: 0,
      equityCashflow: 0,
      closingDebtBalance: 0,
    };
    current.unleveredCashflow += row.unleveredCashflow;
    current.debtDraws += row.debtDraws;
    current.cashInterest += row.cashInterest;
    current.capitalizedInterest += row.capitalizedInterest;
    current.arrangementFees += row.arrangementFees;
    current.principalRepayment += row.principalRepayment;
    current.equityCashflow += row.equityCashflow;
    current.closingDebtBalance = row.closingDebtBalance;
    periods.set(meta.periodIndex, current);
  }
  return Array.from(periods.values())
    .filter((row) => (
      row.unleveredCashflow !== 0
      || row.debtDraws !== 0
      || row.cashInterest !== 0
      || row.capitalizedInterest !== 0
      || row.arrangementFees !== 0
      || row.principalRepayment !== 0
      || row.closingDebtBalance !== 0
    ))
    .sort((left, right) => left.periodIndex - right.periodIndex);
}

function countSignChanges(values: number[]): number {
  const signs = values.filter((value) => Math.abs(value) > 1e-9).map(Math.sign);
  let changes = 0;
  for (let index = 1; index < signs.length; index += 1) {
    if (signs[index] !== signs[index - 1]) changes += 1;
  }
  return changes;
}

function npv(values: Array<{ month: number; value: number }>, rate: number): number {
  if (rate <= -1) return Number.POSITIVE_INFINITY;
  return values.reduce((sum, row) => sum + row.value / Math.pow(1 + rate, row.month), 0);
}

function solveIrr(values: Array<{ month: number; value: number }>): {
  status: ScenarioFinancingResult['irrStatus'];
  monthlyRate: number | null;
} {
  const nonZero = values.filter((row) => Math.abs(row.value) > 1e-9);
  if (
    nonZero.length < 2
    || !nonZero.some((row) => row.value < 0)
    || !nonZero.some((row) => row.value > 0)
  ) return { status: 'not_applicable', monthlyRate: null };

  if (countSignChanges(nonZero.map((row) => row.value)) > 1) {
    return { status: 'ambiguous', monthlyRate: null };
  }
  if (nonZero[0].value >= 0 || nonZero[nonZero.length - 1].value <= 0) {
    return { status: 'not_applicable', monthlyRate: null };
  }

  let low = -0.999999;
  let high = 1;
  let lowValue = npv(values, low);
  let highValue = npv(values, high);
  while (Math.sign(lowValue) === Math.sign(highValue) && high < 1_000_000) {
    high *= 2;
    highValue = npv(values, high);
  }
  if (!Number.isFinite(lowValue)) lowValue = Number.MAX_VALUE;
  if (!Number.isFinite(highValue)) highValue = -Number.MAX_VALUE;
  if (Math.sign(lowValue) === Math.sign(highValue)) return { status: 'no_solution', monthlyRate: null };

  for (let iteration = 0; iteration < 250; iteration += 1) {
    const middle = (low + high) / 2;
    const value = npv(values, middle);
    if (Math.abs(value) < 1e-8 || Math.abs(high - low) < 1e-12) {
      return { status: 'ok', monthlyRate: middle };
    }
    if (Math.sign(value) === Math.sign(lowValue)) {
      low = middle;
      lowValue = value;
    } else {
      high = middle;
      highValue = value;
    }
  }
  return { status: 'ok', monthlyRate: (low + high) / 2 };
}

function emptyResult(blockers: string[], warnings: string[]): ScenarioFinancingResult {
  return {
    ready: false,
    monthly: [],
    periods: [],
    totalDebtDraws: 0,
    totalCashInterest: 0,
    totalCapitalizedInterest: 0,
    totalArrangementFees: 0,
    totalPrincipalRepayment: 0,
    peakDebt: 0,
    peakEquityRequirement: 0,
    equityContributions: 0,
    equityDistributions: 0,
    equityMultiple: null,
    leveredIrrAnnualPct: null,
    leveredIrrMonthlyPct: null,
    irrStatus: 'not_applicable',
    loanToCostPct: null,
    blockers,
    warnings,
  };
}

/**
 * Bouwt een afzonderlijke levered laag bovenop de opgeslagen ongefinancierde maandkasstroom.
 * De lening verandert de vastgoedkasstroom zelf niet.
 */
export function buildScenarioFinancing(args: {
  cashflow: ScenarioUnleveredCashflowResult;
  facilities: ScenarioFinancingFacility[];
  legacyFinancingCosts?: number | null;
}): ScenarioFinancingResult {
  const blockers: string[] = [];
  const warnings: string[] = [...args.cashflow.warnings];
  const horizonMonths = args.cashflow.horizonMonths;

  if (!args.cashflow.readyForPeriodicCashflow || horizonMonths === null) {
    args.cashflow.blockers.forEach((blocker) => addUnique(blockers, blocker));
    addUnique(blockers, 'Een volledige ongefinancierde maandkasstroom is nodig voordat financiering kan worden doorgerekend.');
  }
  if (args.facilities.length === 0) {
    addUnique(blockers, 'Voeg minimaal één opgeslagen financieringsfaciliteit toe.');
  }
  if (finite(args.legacyFinancingCosts) > 0) {
    addUnique(
      warnings,
      'Het oude handmatige veld “Financieringskosten” is niet meegenomen. Gebruik de nieuwe faciliteiten voor rente, afsluitkosten en aflossing.',
    );
  }
  if (horizonMonths !== null) {
    args.facilities.forEach((facility) => validateFacility(facility, horizonMonths, blockers));
  }
  if (blockers.length > 0 || horizonMonths === null) return emptyResult(blockers, warnings);

  const states: FacilityState[] = [...args.facilities]
    .sort((left, right) => left.sort_order - right.sort_order || left.facility_name.localeCompare(right.facility_name, 'nl-NL'))
    .map((facility) => ({ facility, balance: 0, totalDrawn: 0, feeCharged: false }));

  let cumulativeEquityCashflow = 0;
  let peakDebt = 0;
  let peakEquityRequirement = 0;
  const monthly: ScenarioFinancingMonth[] = [];

  for (const projectRow of args.cashflow.monthly) {
    let remainingProjectDeficit = Math.max(0, -projectRow.netCashflow);
    let debtDraws = 0;
    let cashInterest = 0;
    let capitalizedInterest = 0;
    let arrangementFees = 0;
    let principalRepayment = 0;

    for (const state of states) {
      const facility = state.facility;
      const monthlyRate = Math.pow(1 + facility.annual_interest_rate_pct / 100, 1 / 12) - 1;
      const interest = state.balance * monthlyRate;
      if (facility.interest_method === 'cash') cashInterest += interest;
      else {
        state.balance += interest;
        capitalizedInterest += interest;
      }

      const canDraw = projectRow.month >= facility.draw_start_month && projectRow.month < facility.maturity_month;
      const remainingCommitment = Math.max(0, facility.commitment_amount - state.totalDrawn);
      let draw = 0;
      if (canDraw && remainingCommitment > 0 && remainingProjectDeficit > 0) {
        if (facility.draw_method === 'single_month' && projectRow.month === facility.draw_start_month) {
          draw = Math.min(remainingCommitment, remainingProjectDeficit);
        }
        if (facility.draw_method === 'project_deficit') {
          draw = Math.min(remainingCommitment, remainingProjectDeficit);
        }
      }
      if (draw > 0) {
        state.balance += draw;
        state.totalDrawn += draw;
        remainingProjectDeficit -= draw;
        debtDraws += draw;
        if (!state.feeCharged) {
          arrangementFees += arrangementFee(facility);
          state.feeCharged = true;
        }
      }

      let repayment = 0;
      if (facility.repayment_method === 'bullet' && projectRow.month === facility.maturity_month) {
        repayment = state.balance;
      } else if (
        facility.repayment_method === 'linear'
        && facility.amortization_start_month !== null
        && projectRow.month >= facility.amortization_start_month
        && projectRow.month <= facility.maturity_month
        && state.balance > 0
      ) {
        const remainingMonths = facility.maturity_month - projectRow.month + 1;
        repayment = state.balance / remainingMonths;
      }
      if (repayment > 0) {
        state.balance = Math.max(0, state.balance - repayment);
        principalRepayment += repayment;
      }
    }

    const closingDebtBalance = states.reduce((sum, state) => sum + state.balance, 0);
    const equityCashflow = projectRow.netCashflow
      + debtDraws
      - cashInterest
      - arrangementFees
      - principalRepayment;
    cumulativeEquityCashflow += equityCashflow;
    peakDebt = Math.max(peakDebt, closingDebtBalance);
    peakEquityRequirement = Math.max(peakEquityRequirement, -cumulativeEquityCashflow);

    monthly.push({
      month: projectRow.month,
      unleveredCashflow: projectRow.netCashflow,
      debtDraws,
      cashInterest,
      capitalizedInterest,
      arrangementFees,
      principalRepayment,
      closingDebtBalance,
      equityCashflow,
      cumulativeEquityCashflow,
    });
  }

  for (const state of states) {
    if (state.balance > 0.01) {
      addUnique(blockers, `${state.facility.facility_name}: na de Quickscan-horizon staat nog schuld open.`);
    }
    const undrawn = state.facility.commitment_amount - state.totalDrawn;
    if (undrawn > 1) {
      addUnique(
        warnings,
        `${state.facility.facility_name}: € ${Math.round(undrawn).toLocaleString('nl-NL')} van het maximale leenbedrag is niet opgenomen.`,
      );
    }
  }
  if (blockers.length > 0) return emptyResult(blockers, warnings);

  const totalDebtDraws = monthly.reduce((sum, row) => sum + row.debtDraws, 0);
  const totalCashInterest = monthly.reduce((sum, row) => sum + row.cashInterest, 0);
  const totalCapitalizedInterest = monthly.reduce((sum, row) => sum + row.capitalizedInterest, 0);
  const totalArrangementFees = monthly.reduce((sum, row) => sum + row.arrangementFees, 0);
  const totalPrincipalRepayment = monthly.reduce((sum, row) => sum + row.principalRepayment, 0);
  const equityContributions = monthly.reduce((sum, row) => sum + Math.max(0, -row.equityCashflow), 0);
  const equityDistributions = monthly.reduce((sum, row) => sum + Math.max(0, row.equityCashflow), 0);
  const irr = solveIrr(monthly.map((row) => ({ month: row.month, value: row.equityCashflow })));
  const leveredIrrMonthlyPct = irr.monthlyRate === null ? null : irr.monthlyRate * 100;
  const leveredIrrAnnualPct = irr.monthlyRate === null
    ? null
    : (Math.pow(1 + irr.monthlyRate, 12) - 1) * 100;

  if (irr.status === 'ambiguous') {
    addUnique(warnings, 'De equitykasstroom wisselt meer dan één keer van teken. Daarom wordt geen mogelijk misleidende levered IRR getoond.');
  } else if (irr.status === 'no_solution') {
    addUnique(warnings, 'Voor de equitykasstroom kon geen betrouwbare levered IRR worden gevonden.');
  } else if (irr.status === 'not_applicable') {
    addUnique(warnings, 'De equitykasstroom heeft geen conventioneel patroon van eerst inleggen en later ontvangen; levered IRR is niet toepasbaar.');
  }

  const costBasis = args.cashflow.reconciliation?.expectedUnleveredInvestment ?? 0;
  const loanToCostPct = costBasis > 0 ? peakDebt / costBasis * 100 : null;

  return {
    ready: true,
    monthly,
    periods: aggregatePeriods(monthly),
    totalDebtDraws,
    totalCashInterest,
    totalCapitalizedInterest,
    totalArrangementFees,
    totalPrincipalRepayment,
    peakDebt,
    peakEquityRequirement,
    equityContributions,
    equityDistributions,
    equityMultiple: equityContributions > 0 ? equityDistributions / equityContributions : null,
    leveredIrrAnnualPct,
    leveredIrrMonthlyPct,
    irrStatus: irr.status,
    loanToCostPct,
    blockers: [],
    warnings: Array.from(new Set(warnings)),
  };
}
