import { describe, expect, it } from 'vitest';
import type { ScenarioKengetalSnapshot, VastgoedrekenenKengetal } from '@/lib/vastgoedrekenen/kengetallen';
import {
  buildProfileApplicationCandidates,
  deriveScenarioInputContextSuggestion,
  matchKengetalToContext,
  rankKengetallenForContext,
  type ScenarioInputContextDraft,
} from '@/lib/vastgoedrekenen/inputProfiles';

function context(patch: Partial<ScenarioInputContextDraft> = {}): ScenarioInputContextDraft {
  return {
    scenario_id: 'scenario-1',
    asset_type_code: 'office',
    strategy_code: 'transform',
    project_phase_code: 'quickscan',
    risk_class_code: 'high',
    quality_level_code: 'average',
    complexity_code: 'high',
    location_type_code: 'urban_neighbourhood',
    market_condition_code: 'normal',
    scenario_profile_code: 'base',
    location_keys: ['GM0518', 'WK051801'],
    derivation_notes: {},
    schema_version: 1,
    ...patch,
  };
}

function kengetal(patch: Partial<VastgoedrekenenKengetal> = {}): VastgoedrekenenKengetal {
  return {
    id: 'kg-1',
    code: 'transformatiemarge',
    naam: 'Doelwinst transformatie',
    categorie: 'rendement',
    eenheid: '%',
    minimum_waarde: 10,
    basis_waarde: 15,
    maximum_waarde: 20,
    conservative_band: 'maximum',
    optimistic_band: 'minimum',
    scenario_veld: 'sale_target_margin_percentage',
    bron_type: 'intern',
    bron_naam: 'Bito register',
    bron_referentie: null,
    bron_peildatum: '2026-07-01',
    geldig_vanaf: '2026-07-01',
    vervaldatum: '2027-07-01',
    toepassingsgebied: [],
    regio: [],
    projectfase: [],
    risicoklasse: [],
    betrouwbaarheid: 'hoog',
    toelichting: null,
    actief: true,
    versie: 2,
    created_by: null,
    created_at: '2026-07-01T00:00:00Z',
    updated_at: '2026-07-01T00:00:00Z',
    asset_type_codes: ['office'],
    strategy_codes: ['transform'],
    project_phase_codes: ['quickscan'],
    risk_class_codes: ['high'],
    quality_level_codes: [],
    complexity_codes: ['high'],
    location_type_codes: [],
    market_condition_codes: [],
    scenario_profile_codes: [],
    location_keys: ['GM0518'],
    unit_code: 'percent',
    vat_treatment_code: null,
    classification_schema_version: 1,
    ...patch,
  };
}

function snapshot(patch: Partial<ScenarioKengetalSnapshot> = {}): ScenarioKengetalSnapshot {
  return {
    id: 'snapshot-1',
    scenario_id: 'scenario-1',
    kengetal_id: 'kg-1',
    kengetal_code: 'transformatiemarge',
    kengetal_naam: 'Doelwinst transformatie',
    categorie: 'rendement',
    eenheid: '%',
    gekozen_band: 'basis',
    gekozen_waarde: 15,
    minimum_waarde: 10,
    basis_waarde: 15,
    maximum_waarde: 20,
    scenario_veld: 'sale_target_margin_percentage',
    bron_type: 'intern',
    bron_naam: 'Bito register',
    bron_referentie: null,
    bron_peildatum: '2026-07-01',
    vervaldatum: '2027-07-01',
    toepassingsgebied: [],
    regio: [],
    projectfase: [],
    risicoklasse: [],
    betrouwbaarheid: 'hoog',
    register_versie: 2,
    overschreven: false,
    override_reden: null,
    snapshot_op: '2026-07-20T00:00:00Z',
    created_by: null,
    created_at: '2026-07-20T00:00:00Z',
    updated_at: '2026-07-20T00:00:00Z',
    asset_type_codes: ['office'],
    strategy_codes: ['transform'],
    project_phase_codes: ['quickscan'],
    risk_class_codes: ['high'],
    quality_level_codes: [],
    complexity_codes: ['high'],
    location_type_codes: [],
    market_condition_codes: [],
    scenario_profile_codes: [],
    location_keys: ['GM0518'],
    unit_code: 'percent',
    vat_treatment_code: null,
    classification_schema_version: 1,
    ...patch,
  };
}

describe('gecontroleerde invoerprofielen', () => {
  it('rangschikt een specifieke kantoortransformatie boven een algemeen kengetal', () => {
    const specific = kengetal();
    const broad = kengetal({
      id: 'kg-2',
      code: 'algemeen',
      naam: 'Algemeen kengetal',
      asset_type_codes: [],
      strategy_codes: [],
      project_phase_codes: [],
      risk_class_codes: [],
      complexity_codes: [],
      location_keys: [],
    });

    const ranked = rankKengetallenForContext([broad, specific], context(), '2026-07-30');

    expect(ranked[0].kengetal.code).toBe('transformatiemarge');
    expect(ranked[0]).toMatchObject({ status: 'exact', applicable: true, selectedBand: 'basis', selectedValue: 15 });
    expect(ranked[1].status).toBe('broad');
    expect(ranked[0].scorePercentage).toBeGreaterThan(ranked[1].scorePercentage);
  });

  it('blokkeert een inhoudelijke mismatch en benoemt de afwijkende dimensie', () => {
    const result = matchKengetalToContext(kengetal({ asset_type_codes: ['logistics'] }), context(), '2026-07-30');

    expect(result.status).toBe('mismatch');
    expect(result.applicable).toBe(false);
    expect(result.mismatches).toContain('assettype wijkt af');
  });

  it('vraagt ontbrekende context op voordat een specifiek kengetal wordt toegepast', () => {
    const result = matchKengetalToContext(kengetal(), context({ risk_class_code: null }), '2026-07-30');

    expect(result.status).toBe('incomplete');
    expect(result.applicable).toBe(false);
    expect(result.missingContext).toContain('risicoklasse');
  });

  it('kiest expliciet maximum voor conservatief en minimum voor optimistisch', () => {
    const conservative = matchKengetalToContext(kengetal(), context({ scenario_profile_code: 'conservative' }), '2026-07-30');
    const optimistic = matchKengetalToContext(kengetal(), context({ scenario_profile_code: 'optimistic' }), '2026-07-30');

    expect(conservative).toMatchObject({ selectedBand: 'maximum', selectedValue: 20, applicable: true });
    expect(optimistic).toMatchObject({ selectedBand: 'minimum', selectedValue: 10, applicable: true });
  });

  it('past een conservatief profiel niet automatisch toe zonder ingerichte profielband', () => {
    const result = matchKengetalToContext(
      kengetal({ conservative_band: null }),
      context({ scenario_profile_code: 'conservative' }),
      '2026-07-30',
    );

    expect(result.applicable).toBe(false);
    expect(result.blocker).toMatch(/profielband.*niet ingericht/i);
  });

  it('selecteert een bestaande handmatige scenariowaarde niet standaard voor overschrijving', () => {
    const matches = [matchKengetalToContext(kengetal(), context(), '2026-07-30')];
    const [candidate] = buildProfileApplicationCandidates({
      matches,
      scenario: { sale_target_margin_percentage: 17 },
      snapshots: [],
    });

    expect(candidate).toMatchObject({
      currentValue: 17,
      conflict: 'untracked_value',
      selectedByDefault: false,
    });
  });

  it('herkent een bestaande snapshot als getraceerde vervanging', () => {
    const matches = [matchKengetalToContext(kengetal(), context(), '2026-07-30')];
    const [candidate] = buildProfileApplicationCandidates({
      matches,
      scenario: { sale_target_margin_percentage: 15 },
      snapshots: [snapshot()],
    });

    expect(candidate).toMatchObject({ conflict: 'tracked_snapshot', selectedByDefault: true });
  });

  it('leidt alleen een voorstel af en schrijft geen profiel of waarde terug', () => {
    const suggestion = deriveScenarioInputContextSuggestion({
      scenarioId: 'scenario-1',
      scenario: { intervention: 'transform', strategy_type: 'buy_transform_sell' },
      objectType: 'kantoren',
      locationKeys: ['GM0518', 'WK051801'],
    });

    expect(suggestion.context).toMatchObject({
      scenario_id: 'scenario-1',
      asset_type_code: 'office',
      strategy_code: 'transform',
      project_phase_code: 'quickscan',
      complexity_code: 'high',
      scenario_profile_code: 'base',
      location_keys: ['GM0518', 'WK051801'],
    });
    expect(suggestion.reasons.join(' ')).toMatch(/pas actief na opslaan/i);
  });
});
