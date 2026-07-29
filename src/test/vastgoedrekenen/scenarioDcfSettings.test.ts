import { describe, expect, it } from 'vitest';
import {
  clearScenarioDcfSettingsPatch,
  resolveScenarioDcfSettings,
  scenarioDcfSettingsPatch,
} from '@/lib/vastgoedrekenen/scenarioDcfSettings';

describe('scenario DCF settings', () => {
  it('behoudt een legacy scenario zonder DCF-velden als niet ingesteld', () => {
    const resolved = resolveScenarioDcfSettings({
      dcf_discount_rate_pct: null,
      dcf_discount_rate_source: null,
      dcf_discount_rate_notes: null,
      dcf_schema_version: null,
    });

    expect(resolved).toMatchObject({
      annualDiscountRatePct: null,
      source: null,
      notes: null,
      schemaVersion: null,
      explicit: false,
      valid: false,
    });
    expect(resolved.warnings.join(' ')).toMatch(/leg eerst.*disconteringsvoet/i);
  });

  it('accepteert Nederlandse decimale invoer en bouwt een atomair patch', () => {
    expect(scenarioDcfSettingsPatch({
      annualDiscountRatePct: '8,375',
      source: 'Interne rendementseis 2026',
      notes: 'Inclusief projectspecifieke risicopremie',
    })).toEqual({
      dcf_discount_rate_pct: 8.375,
      dcf_discount_rate_source: 'Interne rendementseis 2026',
      dcf_discount_rate_notes: 'Inclusief projectspecifieke risicopremie',
      dcf_schema_version: 1,
    });
  });

  it('weigert een voet buiten de bandbreedte of zonder bron', () => {
    expect(() => scenarioDcfSettingsPatch({
      annualDiscountRatePct: -1,
      source: 'test',
    })).toThrow(/tussen 0% en 100%/i);

    expect(() => scenarioDcfSettingsPatch({
      annualDiscountRatePct: 8,
      source: '   ',
    })).toThrow(/bron of onderbouwing/i);
  });

  it('markeert een gedeeltelijk of onbekend contract als ongeldig', () => {
    const resolved = resolveScenarioDcfSettings({
      dcf_discount_rate_pct: 8,
      dcf_discount_rate_source: 'Marktbenchmark',
      dcf_schema_version: 2,
    });

    expect(resolved.explicit).toBe(true);
    expect(resolved.valid).toBe(false);
    expect(resolved.warnings.join(' ')).toMatch(/schemaversie/i);
  });

  it('levert een expliciete clearpatch zonder default', () => {
    expect(clearScenarioDcfSettingsPatch()).toEqual({
      dcf_discount_rate_pct: null,
      dcf_discount_rate_source: null,
      dcf_discount_rate_notes: null,
      dcf_schema_version: null,
    });
  });
});
