import type { Database } from '@/integrations/supabase/types';
import type { PropositionType } from '@/lib/vastgoedrekenen/propositions';

export type LegacyCalculationRow = Database['public']['Tables']['real_estate_calculations']['Row'];

/** Persistente Analysis-laag; databasebron blijft real_estate_calculations. */
export type PersistedCalculationAnalysis = LegacyCalculationRow & {
  proposition_type: PropositionType;
  proposition_schema_version: number;
};

/** Backward-compatible domeinnaam voor bestaande consumers. */
export type Calculation = LegacyCalculationRow;
