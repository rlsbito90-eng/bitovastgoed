import type { Scenario, ScenarioCost, SellOffUnit } from './types';
import { buildComponentPeriodicCashflow } from './componentPeriodicCashflow';
import { computeCostBreakdown, computeTotalCosts } from './investering';
import {
  resolveScenarioCostCashflowTiming,
  type ResolvedScenarioCostCashflowTiming,
} from './scenarioCostCashflowTiming';

export type SavedScenarioCashflowOutput = {
  total_transfer_tax?: number | null;
  total_acquisition_costs?: number | null;
  total_costs?: number | null;
  total_investment?: number | null;
};

export type ScenarioUnleveredCashflowMonth = {
  month: number;
  purchasePrice: number;
  transferTax: number;
  acquisitionCosts: number;
  rentalIncome: number;
  grossSaleProceeds: number;
  terminalValue: number;
  componentDevelopmentCosts: number;
  sharedScenarioCosts: number;
  dispositionCosts: number;
  netCashflow: number;
  cumulativeCashflow: number;
};

export type ScenarioUnleveredCashflowPeriod = Omit<
  ScenarioUnleveredCashflowMonth,
  'month' | 'cumulativeCashflow'
> & {
  periodIndex: number;
  label: string;
  fromMonth: number;
  toMonth: number;
};

export type ScenarioUnleveredCashflowTotals = Omit<
  ScenarioUnleveredCashflowMonth,
  'month' | 'cumulativeCashflow'
>;

export type ScenarioInvestmentReconciliation = {
  expectedUnleveredInvestment: number;
  reportedUnleveredInvestment: number | null;
  difference: number | null;
  reconciled: boolean | null;
};

export type ScenarioUnleveredCashflowResult = {
  readyForPeriodicCashflow: boolean;
  readyForDiscounting: boolean;
  horizonMonths: number | null;
  monthly: ScenarioUnleveredCashflowMonth[];
  periods: ScenarioUnleveredCashflowPeriod[];
  totals: ScenarioUnleveredCashflowTotals;
  reconciliation: ScenarioInvestmentReconciliation | null;
  blockers: string[];
  discountingBlockers: string[];
  warnings: string[];
};

type MutableMonth = Omit<ScenarioUnleveredCashflowMonth, 'netCashflow' | 'cumulativeCashflow'>;

type CostPlan = {
  cost: ScenarioCost;
  timing: ResolvedScenarioCostCashflowTiming;
  amount: number;
};

function finiteNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function addUnique(target: string[], message: string): void {
  if (!target.includes(message)) target.push(message);
}

function zeroTotals(): ScenarioUnleveredCashflowTotals {
  return {
    purchasePrice: 0,
    transferTax: 0,
    acquisitionCosts: 0,
    rentalIncome: 0,
    grossSaleProceeds: 0,
    terminalValue: 0,
    componentDevelopmentCosts: 0,
    sharedScenarioCosts: 0,
    dispositionCosts: 0,
    netCashflow: 0,
  };
}

function emptyResult(
  horizonMonths: number | null,
  blockers: string[],
  discountingBlockers: string[],
  warnings: string[],
): ScenarioUnleveredCashflowResult {
  return {
    readyForPeriodicCashflow: false,
    readyForDiscounting: false,
    horizonMonths,
    monthly: [],
    periods: [],
    totals: zeroTotals(),
    reconciliation: null,
    blockers,
    discountingBlockers,
    warnings,
  };
}

function spreadIntegerAmount(total: number, startMonth: number, endMonth: number): number[] {
  const count = endMonth - startMonth + 1;
  if (total <= 0 || count <= 0) return [];
  const base = Math.floor(total / count);
  let remainder = total - base * count;
  return Array.from({ length: count }, () => {
    const amount = base + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder -= 1;
    return amount;
  });
}

function periodMeta(month: number): Pick<ScenarioUnleveredCashflowPeriod, 'periodIndex' | 'label' | 'fromMonth' | 'toMonth'> {
  if (month === 0) return { periodIndex: 0, label: 'Maand 0', fromMonth: 0, toMonth: 0 };
  const periodIndex = Math.ceil(month / 12);
  const fromMonth = (periodIndex - 1) * 12 + 1;
  const toMonth = periodIndex * 12;
  return { periodIndex, label: `Jaar ${periodIndex} · maand ${fromMonth}–${toMonth}`, fromMonth, toMonth };
}

function aggregatePeriods(monthly: ScenarioUnleveredCashflowMonth[]): ScenarioUnleveredCashflowPeriod[] {
  const periods = new Map<number, ScenarioUnleveredCashflowPeriod>();
  for (const row of monthly) {
    const meta = periodMeta(row.month);
    const current = periods.get(meta.periodIndex) ?? { ...meta, ...zeroTotals() };
    current.purchasePrice += row.purchasePrice;
    current.transferTax += row.transferTax;
    current.acquisitionCosts += row.acquisitionCosts;
    current.rentalIncome += row.rentalIncome;
    current.grossSaleProceeds += row.grossSaleProceeds;
    current.terminalValue += row.terminalValue;
    current.componentDevelopmentCosts += row.componentDevelopmentCosts;
    current.sharedScenarioCosts += row.sharedScenarioCosts;
    current.dispositionCosts += row.dispositionCosts;
    current.netCashflow += row.netCashflow;
    periods.set(meta.periodIndex, current);
  }
  return Array.from(periods.values())
    .filter((period) => Object.entries(period).some(([key, value]) => (
      !['periodIndex', 'label', 'fromMonth', 'toMonth'].includes(key) && Number(value) !== 0
    )))
    .sort((left, right) => left.periodIndex - right.periodIndex);
}

function buildCostPlans(
  costs: ScenarioCost[],
  unforeseenPercentage: number,
  horizonMonths: number,
  blockers: string[],
  warnings: string[],
): CostPlan[] {
  const plans: CostPlan[] = [];

  for (const cost of costs) {
    const amount = computeCostBreakdown(cost, unforeseenPercentage).includedInInvestment;
    if (amount <= 0) continue;
    const timing = resolveScenarioCostCashflowTiming(cost, horizonMonths);
    if (!timing.valid) {
      timing.warnings.forEach((warning) => addUnique(blockers, warning));
      continue;
    }
    plans.push({ cost, timing, amount });
  }

  const expectedTotal = computeTotalCosts(costs, unforeseenPercentage).total;
  const plannedTotal = plans.reduce((sum, plan) => sum + plan.amount, 0);
  if (blockers.length === 0 && expectedTotal !== plannedTotal && plans.length > 0) {
    const adjustment = expectedTotal - plannedTotal;
    const target = plans.reduce((largest, plan) => (plan.amount > largest.amount ? plan : largest), plans[0]);
    target.amount += adjustment;
    addUnique(
      warnings,
      `Afrondingscorrectie algemene kosten: ${adjustment >= 0 ? '+' : ''}€ ${adjustment} is aan “${target.timing.label}” toegerekend zodat de tijdlijn exact aansluit op de bestaande totale-kostenberekening.`,
    );
  }

  if (blockers.length === 0 && plans.reduce((sum, plan) => sum + plan.amount, 0) !== expectedTotal) {
    addUnique(blockers, 'Algemene kosten konden niet exact op de bestaande totale-kostenberekening worden aangesloten.');
  }

  return plans;
}

export function buildScenarioUnleveredCashflow(args: {
  scenario: Scenario;
  costs: ScenarioCost[];
  strategyUnits: SellOffUnit[];
  timeHorizonMonths: number | null | undefined;
  savedOutput: SavedScenarioCashflowOutput | null | undefined;
}): ScenarioUnleveredCashflowResult {
  const { scenario, costs, strategyUnits, savedOutput } = args;
  const blockers: string[] = [];
  const warnings: string[] = [];
  const discountingBlockers: string[] = [];
  const component = buildComponentPeriodicCashflow(strategyUnits, args.timeHorizonMonths);
  const horizonMonths = component.horizonMonths;

  component.blockers.forEach((blocker) => addUnique(blockers, blocker));
  component.warnings.forEach((warning) => addUnique(warnings, warning));
  component.discountingBlockers.forEach((blocker) => addUnique(discountingBlockers, blocker));

  const purchasePrice = finiteNumber(scenario.purchase_price);
  if (purchasePrice <= 0) addUnique(blockers, 'Vul een beoogde aankoopprijs in en sla het scenario op.');

  const transferTaxRaw = savedOutput?.total_transfer_tax;
  const acquisitionCostsRaw = savedOutput?.total_acquisition_costs;
  if (transferTaxRaw === null || transferTaxRaw === undefined) {
    addUnique(blockers, 'Berekende OVB ontbreekt in de opgeslagen scenario-output. Sla het scenario eerst op.');
  }
  if (acquisitionCostsRaw === null || acquisitionCostsRaw === undefined) {
    addUnique(blockers, 'Berekende aankoopkosten ontbreken in de opgeslagen scenario-output. Sla het scenario eerst op.');
  }

  if (horizonMonths === null) {
    return emptyResult(horizonMonths, blockers, discountingBlockers, warnings);
  }

  const costPlans = buildCostPlans(
    costs,
    finiteNumber(scenario.unforeseen_percentage),
    horizonMonths,
    blockers,
    warnings,
  );

  const financingCosts = finiteNumber(scenario.financing_costs);
  if (financingCosts > 0) {
    addUnique(
      warnings,
      `De bestaande indicatieve financieringskosten van € ${Math.round(financingCosts)} zijn bewust niet opgenomen. Fase financiering bouwt later rente, opnames en aflossing als afzonderlijke levered laag.`,
    );
  }

  if (blockers.length > 0 || !component.readyForPeriodicCashflow) {
    return emptyResult(horizonMonths, blockers, discountingBlockers, warnings);
  }

  const mutable: MutableMonth[] = component.monthly.map((row) => ({
    month: row.month,
    purchasePrice: 0,
    transferTax: 0,
    acquisitionCosts: 0,
    rentalIncome: row.rentalIncome,
    grossSaleProceeds: row.grossSaleProceeds,
    terminalValue: row.terminalValue,
    componentDevelopmentCosts: row.developmentCosts,
    sharedScenarioCosts: 0,
    dispositionCosts: row.dispositionCosts,
  }));

  mutable[0].purchasePrice = purchasePrice;
  mutable[0].transferTax = finiteNumber(transferTaxRaw);
  mutable[0].acquisitionCosts = finiteNumber(acquisitionCostsRaw);

  for (const plan of costPlans) {
    if (plan.timing.method === 'single' && plan.timing.paymentMonth !== null) {
      mutable[plan.timing.paymentMonth].sharedScenarioCosts += plan.amount;
    } else if (
      plan.timing.method === 'linear'
      && plan.timing.startMonth !== null
      && plan.timing.endMonth !== null
    ) {
      const spread = spreadIntegerAmount(plan.amount, plan.timing.startMonth, plan.timing.endMonth);
      spread.forEach((amount, index) => {
        mutable[plan.timing.startMonth! + index].sharedScenarioCosts += amount;
      });
    }
  }

  let cumulativeCashflow = 0;
  const monthly: ScenarioUnleveredCashflowMonth[] = mutable.map((row) => {
    const netCashflow = row.rentalIncome
      + row.grossSaleProceeds
      + row.terminalValue
      - row.purchasePrice
      - row.transferTax
      - row.acquisitionCosts
      - row.componentDevelopmentCosts
      - row.sharedScenarioCosts
      - row.dispositionCosts;
    cumulativeCashflow += netCashflow;
    return { ...row, netCashflow, cumulativeCashflow };
  });

  const totals = monthly.reduce<ScenarioUnleveredCashflowTotals>((sum, row) => ({
    purchasePrice: sum.purchasePrice + row.purchasePrice,
    transferTax: sum.transferTax + row.transferTax,
    acquisitionCosts: sum.acquisitionCosts + row.acquisitionCosts,
    rentalIncome: sum.rentalIncome + row.rentalIncome,
    grossSaleProceeds: sum.grossSaleProceeds + row.grossSaleProceeds,
    terminalValue: sum.terminalValue + row.terminalValue,
    componentDevelopmentCosts: sum.componentDevelopmentCosts + row.componentDevelopmentCosts,
    sharedScenarioCosts: sum.sharedScenarioCosts + row.sharedScenarioCosts,
    dispositionCosts: sum.dispositionCosts + row.dispositionCosts,
    netCashflow: sum.netCashflow + row.netCashflow,
  }), zeroTotals());

  const expectedUnleveredInvestment = totals.purchasePrice
    + totals.transferTax
    + totals.acquisitionCosts
    + totals.componentDevelopmentCosts
    + totals.sharedScenarioCosts;
  const reportedTotalInvestmentRaw = savedOutput?.total_investment;
  const reportedUnleveredInvestment = reportedTotalInvestmentRaw === null || reportedTotalInvestmentRaw === undefined
    ? null
    : finiteNumber(reportedTotalInvestmentRaw) - financingCosts;
  const difference = reportedUnleveredInvestment === null
    ? null
    : expectedUnleveredInvestment - reportedUnleveredInvestment;
  const reconciled = difference === null ? null : Math.abs(difference) <= 1;

  if (reportedUnleveredInvestment === null) {
    addUnique(warnings, 'Opgeslagen totale investering ontbreekt; aansluiting kan nog niet worden gecontroleerd.');
  } else if (!reconciled) {
    addUnique(
      warnings,
      `De ongefinancierde tijdlijn wijkt € ${Math.round(Math.abs(difference ?? 0))} af van de bestaande totale investering exclusief financieringskosten. Controleer dubbele of nog niet opgeslagen kosteninvoer.`,
    );
  }

  return {
    readyForPeriodicCashflow: true,
    readyForDiscounting: component.readyForDiscounting && discountingBlockers.length === 0,
    horizonMonths,
    monthly,
    periods: aggregatePeriods(monthly),
    totals,
    reconciliation: {
      expectedUnleveredInvestment,
      reportedUnleveredInvestment,
      difference,
      reconciled,
    },
    blockers: [],
    discountingBlockers,
    warnings,
  };
}
