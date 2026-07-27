import { supabase } from '@/integrations/supabase/client';
import { getPropositionDefinition, resolvePropositionType } from '@/lib/vastgoedrekenen/propositions';
import type { PropositionType } from '@/lib/vastgoedrekenen/propositions';
import type { PersistedCalculationAnalysis } from '@/lib/vastgoedrekenen/analysis/persistedTypes';

export interface CreateAnalysisInput {
  objectId: string;
  name: string;
  propositionType: PropositionType;
}

export interface AnalysisMetadataPatch {
  calculation_name?: string;
  proposition_type?: PropositionType;
  proposition_schema_version?: number;
}

const table = () => (supabase as unknown as { from: (name: string) => any }).from('real_estate_calculations');
const scenarioTable = () => (supabase as unknown as { from: (name: string) => any }).from('calculation_scenarios');

export async function createAnalysisWithInitialScenario(
  input: CreateAnalysisInput,
): Promise<PersistedCalculationAnalysis> {
  const propositionType = resolvePropositionType(input.propositionType);
  const definition = getPropositionDefinition(propositionType);
  const { data: userData } = await supabase.auth.getUser();

  const { data: analysis, error: analysisError } = await table()
    .insert({
      object_id: input.objectId,
      calculation_name: input.name.trim() || 'Nieuwe analyse',
      status: 'concept',
      main_strategy: 'belegging',
      object_type: 'enkelvoudig',
      input_reliability: 'laag',
      notes: null,
      created_by: userData.user?.id ?? null,
      proposition_type: propositionType,
      proposition_schema_version: definition.schemaVersion,
    })
    .select('*')
    .single();

  if (analysisError || !analysis) {
    throw new Error(analysisError?.message ?? 'Analyse aanmaken mislukt');
  }

  const calculation = analysis as PersistedCalculationAnalysis;
  const { defaultNotaryProfileFor } = await import('@/lib/vastgoedrekenen/fees/notaryProfile');
  const defaultProfile = defaultNotaryProfileFor(calculation.main_strategy, calculation.object_type);

  const { error: scenarioError } = await scenarioTable().insert({
    calculation_id: calculation.id,
    object_id: calculation.object_id,
    scenario_name: 'Scenario 1',
    strategy_type: calculation.main_strategy,
    status: 'concept',
    buyer_fee_method: 'staffel',
    notary_costs_method: 'profile',
    notary_costs_profile: defaultProfile,
  });

  if (scenarioError) {
    const { error: rollbackError } = await table().delete().eq('id', calculation.id);
    if (rollbackError) {
      throw new Error(`Scenario aanmaken mislukt en lege analyse kon niet worden verwijderd: ${scenarioError.message}`);
    }
    throw new Error(`Scenario aanmaken mislukt; analyse is teruggedraaid: ${scenarioError.message}`);
  }

  return calculation;
}

export async function updateAnalysisMetadata(
  analysisId: string,
  patch: AnalysisMetadataPatch,
): Promise<void> {
  const safePatch: AnalysisMetadataPatch = {};
  if (typeof patch.calculation_name === 'string' && patch.calculation_name.trim()) {
    safePatch.calculation_name = patch.calculation_name.trim();
  }
  if (patch.proposition_type) {
    safePatch.proposition_type = resolvePropositionType(patch.proposition_type);
    safePatch.proposition_schema_version = getPropositionDefinition(safePatch.proposition_type).schemaVersion;
  } else if (patch.proposition_schema_version && patch.proposition_schema_version > 0) {
    safePatch.proposition_schema_version = patch.proposition_schema_version;
  }

  const { error } = await table().update(safePatch).eq('id', analysisId);
  if (error) throw new Error(error.message);
}
