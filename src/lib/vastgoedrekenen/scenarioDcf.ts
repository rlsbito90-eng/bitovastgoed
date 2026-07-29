import type {
  ScenarioUnleveredCashflowMonth,
  ScenarioUnleveredCashflowResult,
} from './scenarioUnleveredCashflow';
import type { ResolvedScenarioDcfSettings } from './scenarioDcfSettings';

export type ScenarioDcfIrrStatus = 'ok' | 'not_applicable' | 'ambiguous' | 'no_solution';

export type ScenarioDcfMonth = {
  month: number;
  nominalCashflow: number;
  discountFactor: number;
  presentValue: number;
  cumulativePresentValue: number;
};

export type ScenarioDcfPeriod = {
  periodIndex: number;
  label: string;
  fromMonth: number;
  toMonth: number;
  nominalCashflow: number;
  presentValue: number;
  cumulativePresentValue: number;
};

export type ScenarioDcfResult = {
  readyForDcf: boolean;
  annualDiscountRatePct: number | null;
  monthlyDiscountRatePct: number | null;
  netPresentValue: number | null;
  unleveredIrrAnnualPct: number | null;
  unleveredIrrMonthlyPct: number | null;
  irrStatus: ScenarioDcfIrrStatus;
  totalInflows: number;
  totalOutflows: number;
  investmentMultiple: number | null;
  peakCapitalRequirement: number;
  paybackMonth: number | null;
  discountedPaybackMonth: number | null;
  terminalValueSharePct: number | null;
  durationMonths: number | null;
  monthly: ScenarioDcfMonth[];
  periods: ScenarioDcfPeriod[];
  blockers: string[];
  warnings: string[];
};

function addUnique(target: string[], message: string): void {
  if (!target.includes(message)) target.push(message);
}

function emptyResult(blockers: string[], warnings: string[]): ScenarioDcfResult {
  return {
    readyForDcf: false,
    annualDiscountRatePct: null,
    monthlyDiscountRatePct: null,
    netPresentValue: null,
    unleveredIrrAnnualPct: null,
    unleveredIrrMonthlyPct: null,
    irrStatus: 'not_applicable',
    totalInflows: 0,
    totalOutflows: 0,
    investmentMultiple: null,
    peakCapitalRequirement: 0,
    paybackMonth: null,
    discountedPaybackMonth: null,
    terminalValueSharePct: null,
    durationMonths: null,
    monthly: [],
    periods: [],
    blockers,
    warnings,
  };
}

function periodMeta(month: number): Pick<ScenarioDcfPeriod, 'periodIndex' | 'label' | 'fromMonth' | 'toMonth'> {
  if (month === 0) return { periodIndex: 0, label: 'Maand 0', fromMonth: 0, toMonth: 0 };
  const periodIndex = Math.ceil(month / 12);
  const fromMonth = (periodIndex - 1) * 12 + 1;
  const toMonth = periodIndex * 12;
  return { periodIndex, label: `Jaar ${periodIndex} · maand ${fromMonth}–${toMonth}`, fromMonth, toMonth };
}

function aggregatePeriods(monthly: ScenarioDcfMonth[]): ScenarioDcfPeriod[] {
  const periods = new Map<number, Omit<ScenarioDcfPeriod, 'cumulativePresentValue'>>();
  for (const row of monthly) {
    const meta = periodMeta(row.month);
    const current = periods.get(meta.periodIndex) ?? {
      ...meta,
      nominalCashflow: 0,
      presentValue: 0,
    };
    current.nominalCashflow += row.nominalCashflow;
    current.presentValue += row.presentValue;
    periods.set(meta.periodIndex, current);
  }

  let cumulativePresentValue = 0;
  return Array.from(periods.values())
    .filter((period) => period.nominalCashflow !== 0 || Math.abs(period.presentValue) > 0.005)
    .sort((left, right) => left.periodIndex - right.periodIndex)
    .map((period) => {
      cumulativePresentValue += period.presentValue;
      return { ...period, cumulativePresentValue };
    });
}

function countSignChanges(values: number[]): number {
  const signs = values
    .filter((value) => Math.abs(value) > 1e-9)
    .map((value) => Math.sign(value));
  let changes = 0;
  for (let index = 1; index < signs.length; index += 1) {
    if (signs[index] !== signs[index - 1]) changes += 1;
  }
  return changes;
}

function npvAtMonthlyRate(rows: ScenarioUnleveredCashflowMonth[], monthlyRate: number): number {
  if (monthlyRate <= -1) return Number.POSITIVE_INFINITY;
  let total = 0;
  for (const row of rows) {
    const divisor = Math.pow(1 + monthlyRate, row.month);
    const contribution = row.netCashflow / divisor;
    if (!Number.isFinite(contribution)) {
      return contribution > 0 ? Number.MAX_VALUE : -Number.MAX_VALUE;
    }
    total += contribution;
  }
  return total;
}

function solveMonthlyIrr(rows: ScenarioUnleveredCashflowMonth[]): {
  status: ScenarioDcfIrrStatus;
  monthlyRate: number | null;
} {
  const nonZero = rows.filter((row) => Math.abs(row.netCashflow) > 1e-9);
  const hasNegative = nonZero.some((row) => row.netCashflow < 0);
  const hasPositive = nonZero.some((row) => row.netCashflow > 0);
  if (!hasNegative || !hasPositive || nonZero.length < 2) {
    return { status: 'not_applicable', monthlyRate: null };
  }

  const signChanges = countSignChanges(nonZero.map((row) => row.netCashflow));
  if (signChanges > 1) return { status: 'ambiguous', monthlyRate: null };
  if (nonZero[0].netCashflow >= 0 || nonZero[nonZero.length - 1].netCashflow <= 0) {
    return { status: 'not_applicable', monthlyRate: null };
  }

  let low = -0.999999;
  let high = 1;
  let lowValue = npvAtMonthlyRate(rows, low);
  let highValue = npvAtMonthlyRate(rows, high);

  while (Math.sign(lowValue) === Math.sign(highValue) && high < 1_000_000) {
    high *= 2;
    highValue = npvAtMonthlyRate(rows, high);
  }

  if (!Number.isFinite(lowValue)) lowValue = Number.MAX_VALUE;
  if (!Number.isFinite(highValue)) highValue = -Number.MAX_VALUE;
  if (Math.sign(lowValue) === Math.sign(highValue)) {
    return { status: 'no_solution', monthlyRate: null };
  }

  for (let iteration = 0; iteration < 250; iteration += 1) {
    const midpoint = (low + high) / 2;
    const value = npvAtMonthlyRate(rows, midpoint);
    if (Math.abs(value) < 1e-8 || Math.abs(high - low) < 1e-12) {
      return { status: 'ok', monthlyRate: midpoint };
    }
    if (Math.sign(value) === Math.sign(lowValue)) {
      low = midpoint;
      lowValue = value;
    } else {
      high = midpoint;
      highValue = value;
    }
  }

  return { status: 'ok', monthlyRate: (low + high) / 2 };
}

function firstPaybackMonth(rows: Array<{ month: number; value: number }>): number | null {
  let cumulative = 0;
  let hasBeenNegative = false;
  for (const row of rows) {
    cumulative += row.value;
    if (cumulative < 0) hasBeenNegative = true;
    if (hasBeenNegative && cumulative >= 0) return row.month;
  }
  return null;
}

export function buildScenarioDcf(
  cashflow: ScenarioUnleveredCashflowResult,
  settings: ResolvedScenarioDcfSettings,
): ScenarioDcfResult {
  const blockers: string[] = [];
  const warnings: string[] = [...cashflow.warnings];

  if (!cashflow.readyForPeriodicCashflow) {
    cashflow.blockers.forEach((blocker) => addUnique(blockers, blocker));
  }
  if (!cashflow.readyForDiscounting) {
    cashflow.discountingBlockers.forEach((blocker) => addUnique(blockers, blocker));
  }
  if (!settings.valid) settings.warnings.forEach((warning) => addUnique(blockers, warning));
  if (cashflow.monthly.length === 0) addUnique(blockers, 'Er is geen volledige maandkasstroom beschikbaar voor DCF.');

  if (blockers.length > 0 || settings.annualDiscountRatePct === null) {
    return emptyResult(blockers, warnings);
  }

  const annualRate = settings.annualDiscountRatePct / 100;
  const monthlyRate = Math.pow(1 + annualRate, 1 / 12) - 1;
  if (annualRate === 0) {
    addUnique(warnings, 'De disconteringsvoet is 0%; de NCW is daardoor gelijk aan het nominale projectresultaat.');
  }

  let cumulativePresentValue = 0;
  const monthly: ScenarioDcfMonth[] = cashflow.monthly.map((row) => {
    const discountFactor = Math.pow(1 + annualRate, -row.month / 12);
    const presentValue = row.netCashflow * discountFactor;
    cumulativePresentValue += presentValue;
    return {
      month: row.month,
      nominalCashflow: row.netCashflow,
      discountFactor,
      presentValue,
      cumulativePresentValue,
    };
  });

  const totalInflows = cashflow.totals.rentalIncome
    + cashflow.totals.grossSaleProceeds
    + cashflow.totals.terminalValue;
  const totalOutflows = cashflow.totals.purchasePrice
    + cashflow.totals.transferTax
    + cashflow.totals.acquisitionCosts
    + cashflow.totals.componentDevelopmentCosts
    + cashflow.totals.sharedScenarioCosts
    + cashflow.totals.dispositionCosts;
  const investmentMultiple = totalOutflows > 0 ? totalInflows / totalOutflows : null;

  let cumulativeNominal = 0;
  let peakCapitalRequirement = 0;
  for (const row of cashflow.monthly) {
    cumulativeNominal += row.netCashflow;
    peakCapitalRequirement = Math.max(peakCapitalRequirement, -cumulativeNominal);
  }

  const irr = solveMonthlyIrr(cashflow.monthly);
  let unleveredIrrAnnualPct: number | null = null;
  let unleveredIrrMonthlyPct: number | null = null;
  if (irr.status === 'ok' && irr.monthlyRate !== null) {
    unleveredIrrMonthlyPct = irr.monthlyRate * 100;
    unleveredIrrAnnualPct = (Math.pow(1 + irr.monthlyRate, 12) - 1) * 100;
  } else if (irr.status === 'ambiguous') {
    addUnique(
      warnings,
      'De kasstroom wisselt meer dan één keer van teken. Er kunnen meerdere IRR-oplossingen bestaan; daarom wordt geen unlevered IRR getoond.',
    );
  } else if (irr.status === 'no_solution') {
    addUnique(warnings, 'Voor deze kasstroom kon binnen het ondersteunde bereik geen betrouwbare IRR-oplossing worden gevonden.');
  } else {
    addUnique(warnings, 'De kasstroom heeft geen conventioneel patroon van eerst investeren en later ontvangen; unlevered IRR is niet toepasbaar.');
  }

  const terminalValueSharePct = totalInflows > 0
    ? cashflow.totals.terminalValue / totalInflows * 100
    : null;
  if (terminalValueSharePct !== null && terminalValueSharePct > 50) {
    addUnique(warnings, 'Meer dan 50% van de nominale instroom komt uit de terminale waarde. De uitkomst is daardoor sterk exit-afhankelijk.');
  }

  const nonZeroMonths = cashflow.monthly.filter((row) => Math.abs(row.netCashflow) > 1e-9);
  const durationMonths = nonZeroMonths.length > 0
    ? nonZeroMonths[nonZeroMonths.length - 1].month
    : null;

  return {
    readyForDcf: true,
    annualDiscountRatePct: settings.annualDiscountRatePct,
    monthlyDiscountRatePct: monthlyRate * 100,
    netPresentValue: cumulativePresentValue,
    unleveredIrrAnnualPct,
    unleveredIrrMonthlyPct,
    irrStatus: irr.status,
    totalInflows,
    totalOutflows,
    investmentMultiple,
    peakCapitalRequirement,
    paybackMonth: firstPaybackMonth(cashflow.monthly.map((row) => ({ month: row.month, value: row.netCashflow }))),
    discountedPaybackMonth: firstPaybackMonth(monthly.map((row) => ({ month: row.month, value: row.presentValue }))),
    terminalValueSharePct,
    durationMonths,
    monthly,
    periods: aggregatePeriods(monthly),
    blockers: [],
    warnings: Array.from(new Set(warnings)),
  };
}
