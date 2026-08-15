import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_PROPOSITION_SCHEMA_VERSION,
  DEFAULT_PROPOSITION_TYPE,
  propositionPersistencePatch,
  resolveAnalysisPropositionMetadata,
  resolvePropositionSchemaVersion,
} from '@/lib/vastgoedrekenen/analysis';
import { createAnalysisWithFirstScenario } from '@/lib/vastgoedrekenen/analysis/createAnalysisFlow';

describe('Fase 2A.2 — persistente analysepropositie', () => {
  it('normaliseert bekende en legacy propositiewaarden centraal', () => {
    expect(resolveAnalysisPropositionMetadata({ proposition_type: 'transformation', proposition_schema_version: 2 }))
      .toMatchObject({ propositionType: 'transformation', propositionSchemaVersion: 2, fellBackToLegacy: false });

    for (const proposition_type of [null, undefined, '', 'onbekend_type']) {
      expect(resolveAnalysisPropositionMetadata({ proposition_type }).propositionType)
        .toBe(DEFAULT_PROPOSITION_TYPE);
    }
  });

  it('normaliseert een ontbrekende of ongeldige schemaversie naar 1', () => {
    for (const value of [null, undefined, '', 0, -1, Number.NaN, 'geen-getal']) {
      expect(resolvePropositionSchemaVersion(value)).toBe(DEFAULT_PROPOSITION_SCHEMA_VERSION);
    }
    expect(resolvePropositionSchemaVersion('3')).toBe(3);
  });

  it('maakt een metadata-only persistence patch zonder scenario- of rekenvelden', () => {
    expect(propositionPersistencePatch({ propositionType: 'leased_hotel', propositionSchemaVersion: 4 }))
      .toEqual({ proposition_type: 'leased_hotel', proposition_schema_version: 4 });
  });

  it('maakt analysis en eerste scenario in volgorde aan', async () => {
    const analysis = { id: 'analysis-1', object_id: 'object-1' };
    const scenario = { id: 'scenario-1', calculation_id: 'analysis-1', object_id: 'object-1' };
    const insertAnalysis = vi.fn().mockResolvedValue({ data: analysis, error: null });
    const insertFirstScenario = vi.fn().mockResolvedValue({ data: scenario, error: null });
    const deleteAnalysis = vi.fn().mockResolvedValue({ error: null });

    const result = await createAnalysisWithFirstScenario({ insertAnalysis, insertFirstScenario, deleteAnalysis });

    expect(result).toEqual({ ok: true, analysis, scenario });
    expect(insertFirstScenario).toHaveBeenCalledWith(analysis);
    expect(deleteAnalysis).not.toHaveBeenCalled();
  });

  it('rolt de analysis terug wanneer het eerste scenario mislukt', async () => {
    const analysis = { id: 'analysis-rollback' };
    const deleteAnalysis = vi.fn().mockResolvedValue({ error: null });

    const result = await createAnalysisWithFirstScenario({
      insertAnalysis: vi.fn().mockResolvedValue({ data: analysis, error: null }),
      insertFirstScenario: vi.fn().mockResolvedValue({ data: null, error: { message: 'scenariofout' } }),
      deleteAnalysis,
    });

    expect(result).toMatchObject({ ok: false, stage: 'scenario', rolledBack: true });
    expect(deleteAnalysis).toHaveBeenCalledWith(analysis.id);
  });

  it('legt het databaseschema additief en zonder scenario-propositiekolom vast', () => {
    const migration = readFileSync(
      `${process.cwd()}/supabase/migration-archive/pre-baseline-snapshot/20260727203744_e43e7fe1-3c6a-4944-9da1-b27d1a824910.sql`,
      'utf8',
    );

    expect(migration).toContain('ADD COLUMN IF NOT EXISTS proposition_type text');
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS proposition_schema_version integer');
    expect(migration).toContain("ALTER COLUMN proposition_type SET DEFAULT 'legacy_generic'");
    expect(migration).toContain('ALTER COLUMN proposition_type SET NOT NULL');
    expect(migration).toContain('ALTER COLUMN proposition_schema_version SET NOT NULL');
    expect(migration).toContain('CHECK (proposition_schema_version > 0)');
    expect(migration).not.toContain('ALTER TABLE public.calculation_scenarios');
  });
});
