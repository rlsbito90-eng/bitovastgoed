import { describe, expect, it } from 'vitest';
import {
  legacyUnitValue,
  taxonomyLabels,
  taxonomyOptionsFor,
  validateTaxonomyCodes,
  type TaxonomyOptionLike,
} from '@/lib/vastgoedrekenen/controlledTaxonomy';

const options: TaxonomyOptionLike[] = [
  { dimension_code: 'asset_type', option_code: 'office', label: 'Kantoor', active: true, sort_order: 20 },
  { dimension_code: 'asset_type', option_code: 'residential', label: 'Wonen', active: true, sort_order: 10 },
  { dimension_code: 'asset_type', option_code: 'old', label: 'Oud', active: false, sort_order: 30 },
  { dimension_code: 'strategy', option_code: 'transform', label: 'Transformeren', active: true, sort_order: 10 },
];

describe('controlled taxonomy', () => {
  it('filtert per dimensie, sorteert stabiel en verbergt inactieve opties', () => {
    expect(taxonomyOptionsFor(options, 'asset_type').map((item) => item.option_code)).toEqual([
      'residential',
      'office',
    ]);
    expect(taxonomyOptionsFor(options, 'asset_type', true).map((item) => item.option_code)).toEqual([
      'residential',
      'office',
      'old',
    ]);
  });

  it('houdt technische codes vergelijkbaar en vertaalt ze alleen voor de gebruiker', () => {
    expect(taxonomyLabels(options, 'asset_type', ['office', 'residential'])).toEqual(['Kantoor', 'Wonen']);
    expect(validateTaxonomyCodes({ options, dimension: 'asset_type', codes: ['office', 'unknown'] })).toEqual(['unknown']);
  });

  it('vertaalt een vaste eenheid naar het bestaande leesbare opslagveld', () => {
    expect(legacyUnitValue('eur_m2_bvo')).toBe('€/m² BVO');
    expect(legacyUnitValue('custom', 'vrije eenheid')).toBe('vrije eenheid');
  });
});
