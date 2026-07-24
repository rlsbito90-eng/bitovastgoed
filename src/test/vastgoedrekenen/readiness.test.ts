import { describe, expect, it } from 'vitest';
import type { ComputedOutputs } from '@/lib/vastgoedrekenen/types';
import { buildScenarioReadiness } from '@/lib/vastgoedrekenen/readiness';

function outputs(overrides: Partial<ComputedOutputs> = {}): ComputedOutputs {
  return {
    inputReliability: 'middel',
    riskScore: 'middel',
    scoreAttentionPoints: [],
    warnings: [],
    residual: null,
    ...overrides,
  } as ComputedOutputs;
}

describe('buildScenarioReadiness', () => {
  it('classificeert ontbrekende invoer, betrouwbaarheid en fiscale controle', () => {
    const result = buildScenarioReadiness(outputs({
      inputReliability: 'laag',
      scoreAttentionPoints: [
        'Verkoopscenario zonder verkoopopbrengst. Vul verkoopprijs in.',
        'Niet alle algemene projectkosten hebben betrouwbaarheid hoog.',
        'Biedingsrisico: mixed-use object zonder OVB-toerekening per component.',
      ],
    }));

    expect(result.status).toBe('indicatief');
    expect(result.items.map((item) => item.category)).toEqual(['invoer', 'betrouwbaarheid', 'fiscaal']);
    expect(result.summary).toContain('verplichte invoer ontbreekt');
    expect(result.summary).toContain('fiscale behandeling vraagt controle');
  });

  it('dedupliceert dezelfde melding uit meerdere outputbronnen', () => {
    const message = 'Bouwkosten zijn nog indicatief; leg bron en peildatum vast.';
    const result = buildScenarioReadiness(outputs({
      scoreAttentionPoints: [message],
      warnings: [message],
    }));

    expect(result.items).toHaveLength(1);
    expect(result.items[0].category).toBe('betrouwbaarheid');
  });

  it('markeert een compleet residueel scenario als voor bieding', () => {
    const result = buildScenarioReadiness(outputs({
      inputReliability: 'hoog',
      residual: {
        status: 'voor_bieding',
        criticalIssues: [],
      } as ComputedOutputs['residual'],
    }));

    expect(result.status).toBe('voor_bieding');
    expect(result.shortLabel).toBe('Voor bieding');
    expect(result.title).toContain('Geschikt');
  });

  it('voegt bij lage betrouwbaarheid een concrete onderbouwingsactie toe', () => {
    const result = buildScenarioReadiness(outputs({ inputReliability: 'laag' }));

    expect(result.items).toHaveLength(1);
    expect(result.items[0].category).toBe('betrouwbaarheid');
    expect(result.items[0].message).toContain('bron en peildatum');
  });
});
