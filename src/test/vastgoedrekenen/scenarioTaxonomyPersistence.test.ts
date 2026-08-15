import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  clearScenarioTaxonomyPersistencePatch,
  resolvePersistedScenarioTaxonomy,
  scenarioTaxonomyPersistencePatch,
  ScenarioTaxonomyPersistenceError,
} from '@/lib/vastgoedrekenen/taxonomy';
import {
  analysisMetadataPersistencePatch,
  AnalysisMetadataValidationError,
  resolveAnalysisMetadata,
} from '@/lib/vastgoedrekenen/analysis';

const migrationPath = `${process.cwd()}/supabase/migration-archive/pre-baseline-snapshot/20260728013000_vastgoedrekenen_scenario_taxonomy_fase_2.sql`;

describe('scenario-taxonomie Fase 2 — dual read en persistence', () => {
  it('houdt een bestaand scenario zonder canonieke velden volledig op legacy-read', () => {
    const result = resolvePersistedScenarioTaxonomy({ strategy_type: 'buy_fix_sell' });
    expect(result.source).toBe('legacy');
    expect(result.schemaVersion).toBeNull();
    expect(result.value).toEqual({ businessCase: 'value_add', intervention: 'renovate', expansionSubtype: null, exploitation: 'vacant', disposition: 'sell_as_whole' });
  });

  it('geeft een volledig en gemarkeerd canoniek record voorrang op legacy', () => {
    const result = resolvePersistedScenarioTaxonomy({ strategy_type: 'buy_fix_sell', business_case: 'income_investment', intervention: 'none', expansion_subtype: null, exploitation_mode: 'rental', disposition: 'hold', taxonomy_schema_version: 1 });
    expect(result.source).toBe('canonical');
    expect(result.confidence).toBe('exact');
    expect(result.value).toEqual({ businessCase: 'income_investment', intervention: 'none', expansionSubtype: null, exploitation: 'rental', disposition: 'hold' });
  });

  it('normaliseert een intern inconsistent canoniek record defensief naar mixed-read', () => {
    const result = resolvePersistedScenarioTaxonomy({ strategy_type: 'belegging', business_case: 'value_add', intervention: 'renovate', expansion_subtype: 'rooftop_addition', exploitation_mode: 'rental', disposition: 'hold', taxonomy_schema_version: 1 });
    expect(result.source).toBe('mixed');
    expect(result.confidence).toBe('ambiguous');
    expect(result.value.intervention).toBe('renovate');
    expect(result.value.expansionSubtype).toBeNull();
    expect(result.warnings).toEqual(expect.arrayContaining([expect.stringContaining('intern inconsistent'), expect.stringContaining('genegeerd')]));
  });

  it('vult een gedeeltelijk record per veld veilig aan vanuit legacy zonder write', () => {
    const record = { strategy_type: 'belegging', business_case: 'redevelopment' };
    const before = structuredClone(record);
    const result = resolvePersistedScenarioTaxonomy(record);
    expect(record).toEqual(before);
    expect(result.source).toBe('mixed');
    expect(result.confidence).toBe('ambiguous');
    expect(result.value.businessCase).toBe('redevelopment');
    expect(result.value.intervention).toBe('none');
    expect(result.value.exploitation).toBe('rental');
    expect(result.value.disposition).toBe('hold');
    expect(result.warnings.some((warning) => warning.includes('schemaversie'))).toBe(true);
  });

  it('maakt één volledige atomaire snake_case persistence patch', () => {
    expect(scenarioTaxonomyPersistencePatch({ businessCase: 'redevelopment', intervention: 'expand', expansionSubtype: 'rooftop_addition', exploitation: 'rental', disposition: 'hold' })).toEqual({ business_case: 'redevelopment', intervention: 'expand', expansion_subtype: 'rooftop_addition', exploitation_mode: 'rental', disposition: 'hold', taxonomy_schema_version: 1 });
  });

  it('weigert in strict mode uitbreiden zonder uitbreidingstype', () => {
    expect(() => scenarioTaxonomyPersistencePatch({ businessCase: 'redevelopment', intervention: 'expand', expansionSubtype: null, exploitation: 'rental', disposition: 'hold' })).toThrow(ScenarioTaxonomyPersistenceError);
  });

  it('reset uitsluitend via een expliciete volledige clear-patch naar legacy-read', () => {
    expect(clearScenarioTaxonomyPersistencePatch()).toEqual({ business_case: null, intervention: null, expansion_subtype: null, exploitation_mode: null, disposition: null, taxonomy_schema_version: null });
  });
});

describe('Quickscan-metadata Fase 2', () => {
  it('maakt uitsluitend genormaliseerde metadata-kolommen', () => {
    expect(analysisMetadataPersistencePatch({ analysisQuestion: '  Wat is de maximale aankoopprijs?  ', valuationDate: '2026-07-28', timeHorizonMonths: '36' })).toEqual({ analysis_question: 'Wat is de maximale aankoopprijs?', valuation_date: '2026-07-28', time_horizon_months: 36 });
  });

  it('laat undefined onaangeraakt en behandelt leeg als expliciete clear', () => {
    expect(analysisMetadataPersistencePatch({})).toEqual({});
    expect(analysisMetadataPersistencePatch({ analysisQuestion: '   ', valuationDate: '', timeHorizonMonths: null })).toEqual({ analysis_question: null, valuation_date: null, time_horizon_months: null });
  });

  it('weigert ongeldige peildata en tijdshorizonnen', () => {
    expect(() => analysisMetadataPersistencePatch({ valuationDate: '2026-02-30' })).toThrow(AnalysisMetadataValidationError);
    expect(() => analysisMetadataPersistencePatch({ timeHorizonMonths: 0 })).toThrow(AnalysisMetadataValidationError);
    expect(() => analysisMetadataPersistencePatch({ timeHorizonMonths: 1201 })).toThrow(AnalysisMetadataValidationError);
  });

  it('leest oude of ongeldige metadata defensief zonder records te muteren', () => {
    const record = { analysis_question: 123, valuation_date: 'geen-datum', time_horizon_months: -5 };
    const before = structuredClone(record);
    const result = resolveAnalysisMetadata(record);
    expect(record).toEqual(before);
    expect(result).toEqual({ analysisQuestion: null, valuationDate: null, timeHorizonMonths: null, warnings: expect.arrayContaining([expect.stringContaining('analysevraag'), expect.stringContaining('peildatum'), expect.stringContaining('tijdshorizon')]) });
  });
});

describe('additieve databasescope', () => {
  it('voegt nullable velden en atomaire constraints toe zonder backfill', () => {
    const migration = readFileSync(migrationPath, 'utf8');
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS analysis_question text');
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS valuation_date date');
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS time_horizon_months integer');
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS business_case text');
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS intervention text');
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS expansion_subtype text');
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS exploitation_mode text');
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS disposition text');
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS taxonomy_schema_version integer');
    expect(migration).toContain('calculation_scenarios_taxonomy_atomic_check');
    expect(migration).not.toMatch(/\bUPDATE\s+public\./i);
    expect(migration).not.toContain('ALTER COLUMN business_case SET NOT NULL');
    expect(migration).not.toContain('ALTER COLUMN taxonomy_schema_version SET DEFAULT');
  });
});
