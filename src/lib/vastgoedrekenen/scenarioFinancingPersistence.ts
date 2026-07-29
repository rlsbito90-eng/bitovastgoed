import type {
  FinancingDrawMethod,
  FinancingFacilityType,
  FinancingInterestMethod,
  FinancingRepaymentMethod,
  ScenarioFinancingFacility,
} from './scenarioFinancing';

export type FinancingFacilityDraft = {
  id?: string | null;
  scenarioId: string;
  facilityName: string;
  facilityType: FinancingFacilityType;
  commitmentAmount: string | number | null | undefined;
  drawMethod: FinancingDrawMethod;
  drawStartMonth: string | number | null | undefined;
  annualInterestRatePct: string | number | null | undefined;
  interestMethod: FinancingInterestMethod;
  arrangementFeePct?: string | number | null;
  arrangementFeeAmount?: string | number | null;
  repaymentMethod: FinancingRepaymentMethod;
  amortizationStartMonth?: string | number | null;
  maturityMonth: string | number | null | undefined;
  source: string;
  notes?: string | null;
  sortOrder?: number | null;
};

export type FinancingFacilityPersistencePayload = Omit<
  ScenarioFinancingFacility,
  'id' | 'created_at' | 'updated_at'
>;

function parseNumber(value: string | number | null | undefined, label: string): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error(`${label} is geen geldig getal.`);
    return value;
  }
  const normalized = value.trim().replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
  if (!normalized) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) throw new Error(`${label} is geen geldig getal.`);
  return parsed;
}

function parseInteger(value: string | number | null | undefined, label: string): number | null {
  const parsed = parseNumber(value, label);
  if (parsed === null) return null;
  if (!Number.isInteger(parsed)) throw new Error(`${label} moet een hele maand zijn.`);
  return parsed;
}

function assertMonth(value: number | null, label: string): number {
  if (value === null) throw new Error(`${label} is verplicht.`);
  if (value < 0 || value > 1200) throw new Error(`${label} moet tussen maand 0 en maand 1.200 liggen.`);
  return value;
}

export function buildFinancingFacilityPayload(
  draft: FinancingFacilityDraft,
): FinancingFacilityPersistencePayload {
  const facilityName = draft.facilityName.trim();
  const source = draft.source.trim();
  if (!facilityName) throw new Error('Geef de financiering een herkenbare naam.');
  if (!source) throw new Error('Leg de bron of onderbouwing van de financiering vast.');

  const commitmentAmount = parseNumber(draft.commitmentAmount, 'Maximaal leenbedrag');
  if (commitmentAmount === null || commitmentAmount <= 0) {
    throw new Error('Vul een positief maximaal leenbedrag in.');
  }

  const annualInterestRatePct = parseNumber(draft.annualInterestRatePct, 'Jaarlijkse rente');
  if (annualInterestRatePct === null || annualInterestRatePct < 0 || annualInterestRatePct > 100) {
    throw new Error('De jaarlijkse rente moet tussen 0% en 100% liggen.');
  }

  const drawStartMonth = assertMonth(parseInteger(draft.drawStartMonth, 'Eerste opnamemaand'), 'Eerste opnamemaand');
  const maturityMonth = assertMonth(parseInteger(draft.maturityMonth, 'Eindmaand'), 'Eindmaand');
  if (maturityMonth <= drawStartMonth) throw new Error('De eindmaand moet later zijn dan de eerste opnamemaand.');

  const arrangementFeePct = parseNumber(draft.arrangementFeePct ?? null, 'Afsluitkostenpercentage');
  const arrangementFeeAmount = parseNumber(draft.arrangementFeeAmount ?? null, 'Vaste afsluitkosten');
  if (arrangementFeePct !== null && (arrangementFeePct < 0 || arrangementFeePct > 100)) {
    throw new Error('Het afsluitkostenpercentage moet tussen 0% en 100% liggen.');
  }
  if (arrangementFeeAmount !== null && arrangementFeeAmount < 0) {
    throw new Error('Vaste afsluitkosten kunnen niet negatief zijn.');
  }
  if (arrangementFeePct !== null && arrangementFeeAmount !== null) {
    throw new Error('Gebruik afsluitkosten als percentage óf als vast bedrag, niet allebei.');
  }

  let amortizationStartMonth: number | null = null;
  if (draft.repaymentMethod === 'linear') {
    amortizationStartMonth = assertMonth(
      parseInteger(draft.amortizationStartMonth ?? null, 'Startmaand aflossing'),
      'Startmaand aflossing',
    );
    if (amortizationStartMonth < drawStartMonth || amortizationStartMonth > maturityMonth) {
      throw new Error('De startmaand van aflossing moet tussen de eerste opnamemaand en de eindmaand liggen.');
    }
  }

  return {
    scenario_id: draft.scenarioId,
    facility_name: facilityName,
    facility_type: draft.facilityType,
    commitment_amount: commitmentAmount,
    draw_method: draft.drawMethod,
    draw_start_month: drawStartMonth,
    annual_interest_rate_pct: annualInterestRatePct,
    interest_method: draft.interestMethod,
    arrangement_fee_pct: arrangementFeePct,
    arrangement_fee_amount: arrangementFeeAmount,
    repayment_method: draft.repaymentMethod,
    amortization_start_month: amortizationStartMonth,
    maturity_month: maturityMonth,
    source,
    notes: draft.notes?.trim() || null,
    sort_order: draft.sortOrder ?? 0,
    schema_version: 1,
  };
}
