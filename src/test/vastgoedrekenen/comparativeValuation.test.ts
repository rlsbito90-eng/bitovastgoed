import { describe, expect, it } from 'vitest';
import {
  comparativeExitScenarioPatch,
  computeComparativeValuation,
  type ComparativeReferenceInput,
} from '@/lib/vastgoedrekenen/comparativeValuation';
import { PROPOSITION_DEFINITIONS } from '@/lib/vastgoedrekenen/propositions/definitions';
import { VALUATION_METHOD_IDS } from '@/lib/vastgoedrekenen/propositions/types';

const ref = (overrides: Partial<ComparativeReferenceInput> = {}): ComparativeReferenceInput => ({
  id: crypto.randomUUID(),
  included: true,
  price: 1_000_000,
  areaM2: 200,
  priceType: 'transaction_price',
  transactionDate: '2026-01-01',
  sourceReference: 'Koopakte',
  sourceReliability: 'high',
  weight: 1,
  ...overrides,
});

describe('comparative market registry', () => {
  it('registreert comparative_market', () => {
    expect(VALUATION_METHOD_IDS).toContain('comparative_market');
  });

  it.each(['vacant_commercial', 'renovate_and_sell', 'sell_off', 'transformation', 'mixed_use'])('%s ondersteunt comparative_market', (type) => {
    const definition = PROPOSITION_DEFINITIONS.find((item) => item.type === type);
    expect(definition?.leadingValuationMethods).toContain('comparative_market');
  });

  it('wijzigt legacy_generic niet', () => {
    const legacy = PROPOSITION_DEFINITIONS.find((item) => item.type === 'legacy_generic');
    expect(legacy?.leadingValuationMethods).toEqual(['manual_value']);
  });
});

describe('computeComparativeValuation', () => {
  it('vereist minimaal twee referenties', () => {
    const result = computeComparativeValuation({
      subjectAreaM2: 300,
      basis: 'per_m2',
      method: 'median',
      valuationDate: '2026-07-28',
      references: [ref()],
    });
    expect(result.valid).toBe(false);
    expect(result.centralUnitValue).toBeNull();
  });

  it('berekent mediaan bij oneven aantal', () => {
    const result = computeComparativeValuation({
      subjectAreaM2: 100,
      basis: 'per_m2',
      method: 'median',
      valuationDate: '2026-07-28',
      references: [
        ref({ price: 400_000, areaM2: 100 }),
        ref({ price: 500_000, areaM2: 100 }),
        ref({ price: 900_000, areaM2: 100 }),
      ],
    });
    expect(result.centralUnitValue).toBe(5_000);
    expect(result.indicatedTotalValue).toBe(500_000);
  });

  it('berekent mediaan bij even aantal', () => {
    const result = computeComparativeValuation({
      subjectAreaM2: 100,
      basis: 'per_m2',
      method: 'median',
      valuationDate: '2026-07-28',
      references: [ref({ unitPrice: 4_000 }), ref({ unitPrice: 6_000 })],
    });
    expect(result.centralUnitValue).toBe(5_000);
  });

  it('berekent gewogen gemiddelde', () => {
    const result = computeComparativeValuation({
      subjectAreaM2: 100,
      basis: 'per_m2',
      method: 'weighted_average',
      valuationDate: '2026-07-28',
      references: [ref({ unitPrice: 4_000, weight: 1 }), ref({ unitPrice: 6_000, weight: 3 })],
    });
    expect(result.centralUnitValue).toBe(5_500);
  });

  it('negeert uitgesloten referenties', () => {
    const result = computeComparativeValuation({
      subjectAreaM2: 100,
      basis: 'per_m2',
      method: 'median',
      valuationDate: '2026-07-28',
      references: [ref({ unitPrice: 4_000 }), ref({ unitPrice: 6_000 }), ref({ included: false, unitPrice: 100_000 })],
    });
    expect(result.centralUnitValue).toBe(5_000);
    expect(result.includedReferenceCount).toBe(2);
  });

  it('past correcties exact eenmaal toe', () => {
    const result = computeComparativeValuation({
      subjectAreaM2: 100,
      basis: 'per_m2',
      method: 'median',
      valuationDate: '2026-07-28',
      references: [
        ref({ unitPrice: 4_000, adjustments: { conditionPct: 10 } }),
        ref({ unitPrice: 4_000, adjustments: { conditionPct: 10 } }),
      ],
    });
    expect(result.centralUnitValue).toBeCloseTo(4_400);
  });

  it('houdt nulcorrectie gelijk', () => {
    const result = computeComparativeValuation({
      subjectAreaM2: 100,
      basis: 'per_m2',
      method: 'median',
      valuationDate: '2026-07-28',
      references: [ref({ unitPrice: 4_000 }), ref({ unitPrice: 4_000 })],
    });
    expect(result.centralUnitValue).toBe(4_000);
  });

  it('geeft correcte onder- en bovengrens', () => {
    const result = computeComparativeValuation({
      subjectAreaM2: 100,
      basis: 'per_m2',
      method: 'median',
      valuationDate: '2026-07-28',
      references: [ref({ unitPrice: 3_000 }), ref({ unitPrice: 5_000 }), ref({ unitPrice: 7_000 })],
    });
    expect(result.lowerUnitValue).toBe(3_000);
    expect(result.upperUnitValue).toBe(7_000);
    expect(result.lowerTotalValue).toBe(300_000);
    expect(result.upperTotalValue).toBe(700_000);
  });

  it('begrenst uitsluitend vraagprijzen tot maximaal medium', () => {
    const result = computeComparativeValuation({
      subjectAreaM2: 100,
      basis: 'per_m2',
      method: 'median',
      valuationDate: '2026-07-28',
      references: [
        ref({ priceType: 'asking_price' }),
        ref({ priceType: 'asking_price' }),
        ref({ priceType: 'asking_price' }),
      ],
    });
    expect(result.reliability).toBe('medium');
  });

  it('kan high geven bij drie sterke transactiereferenties', () => {
    const result = computeComparativeValuation({
      subjectAreaM2: 100,
      basis: 'per_m2',
      method: 'median',
      valuationDate: '2026-07-28',
      references: [ref(), ref(), ref()],
    });
    expect(result.reliability).toBe('high');
  });

  it('waarschuwt bij grote correcties', () => {
    const result = computeComparativeValuation({
      subjectAreaM2: 100,
      basis: 'per_m2',
      method: 'median',
      valuationDate: '2026-07-28',
      references: [ref({ adjustments: { locationPct: 30 } }), ref()],
    });
    expect(result.issues.some((issue) => issue.code === 'large_adjustment')).toBe(true);
  });

  it('mapt een bevestigde exitwaardering alleen naar verkoopinput', () => {
    const result = computeComparativeValuation({
      subjectAreaM2: 100,
      basis: 'per_m2',
      method: 'median',
      valuationDate: '2026-07-28',
      references: [ref({ unitPrice: 4_000 }), ref({ unitPrice: 6_000 })],
    });
    expect(comparativeExitScenarioPatch(result, 100)).toEqual({
      sale_price_source: 'per_m2',
      sale_price_per_m2: 5_000,
      sale_sellable_m2: 100,
    });
  });
});
