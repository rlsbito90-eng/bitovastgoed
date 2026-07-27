import { describe, expect, it } from 'vitest';
import { resolveAnalysisProposition, resolvePropositionSchemaVersion } from '@/lib/vastgoedrekenen/propositions/analysisResolver';

const knownTypes = [
  'legacy_generic', 'leased_investment', 'vacant_commercial', 'renovate_and_sell',
  'sell_off', 'transformation', 'demolition_newbuild', 'rooftop_extension',
  'mixed_use', 'portfolio', 'leased_hotel', 'operating_hotel', 'land_development',
] as const;

describe('analysis proposition persistence contract', () => {
  it.each(knownTypes)('behoudt bekende propositiewaarde %s', (value) => {
    expect(resolveAnalysisProposition({ proposition_type: value, proposition_schema_version: 1 })).toEqual({
      propositionType: value,
      propositionSchemaVersion: 1,
    });
  });

  it.each([null, undefined, '', 'unknown'])('valt voor %p veilig terug op legacy_generic', (value) => {
    expect(resolveAnalysisProposition({ proposition_type: value })).toEqual({
      propositionType: 'legacy_generic',
      propositionSchemaVersion: 1,
    });
  });

  it.each([undefined, null, 0, -1, 1.5, '2'])('normaliseert ongeldige schemaversie %p naar 1', (value) => {
    expect(resolvePropositionSchemaVersion(value)).toBe(1);
  });

  it('behoudt een positieve gehele schemaversie', () => {
    expect(resolvePropositionSchemaVersion(3)).toBe(3);
  });
});
