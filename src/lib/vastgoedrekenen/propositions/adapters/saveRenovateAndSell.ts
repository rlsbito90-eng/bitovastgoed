import { supabase } from '@/integrations/supabase/client';
import type { Scenario } from '@/lib/vastgoedrekenen/types';
import type { RenovateAndSellInput } from './types';
import {
  OTHER_PROJECT_COST_KEY,
  RENOVATION_COST_KEY,
  RenovateAndSellInputAdapter,
  getRenovateAndSellNormalizedValues,
  type RenovateAndSellCostInput,
} from './renovateAndSell';

const OWNERSHIP_PREFIX = 'adapter-owned:';

export function renovateAndSellCostNote(cost: RenovateAndSellCostInput): string {
  return `${OWNERSHIP_PREFIX}${cost.ownershipKey}`;
}

export function isRenovateAndSellOwnedCost(row: { notes?: string | null }): boolean {
  return row.notes === `${OWNERSHIP_PREFIX}${RENOVATION_COST_KEY}`
    || row.notes === `${OWNERSHIP_PREFIX}${OTHER_PROJECT_COST_KEY}`;
}

/**
 * Past adapteroutput toe op de bestaande centrale scenario- en kostentabellen.
 * Handmatige kostenregels blijven onaangeroerd. Bij een mislukte kostenwrite wordt
 * de oude scenariopatch en de oude adapter-owned kostenset best-effort hersteld.
 */
export async function saveRenovateAndSellInput(
  scenario: Scenario,
  input: RenovateAndSellInput,
): Promise<{ ok: true; warnings: string[] } | { ok: false; message: string }> {
  const validation = RenovateAndSellInputAdapter.validate(input);
  if (!validation.valid) {
    return { ok: false, message: validation.issues.map((issue) => issue.message).join(' ') };
  }

  const normalized = getRenovateAndSellNormalizedValues(RenovateAndSellInputAdapter.normalize(input));
  const untyped = supabase as unknown as { from: (table: string) => any };

  const oldScenarioPatch = Object.fromEntries(
    Object.keys(normalized.scenarioPatch).map((key) => [key, (scenario as unknown as Record<string, unknown>)[key] ?? null]),
  );

  const existingCostsRes = await untyped.from('scenario_costs').select('*').eq('scenario_id', scenario.id);
  if (existingCostsRes.error) {
    return { ok: false, message: `Bestaande kosten laden mislukt: ${existingCostsRes.error.message}` };
  }
  const previousOwned = (existingCostsRes.data ?? []).filter(isRenovateAndSellOwnedCost);

  const scenarioRes = await untyped
    .from('calculation_scenarios')
    .update(normalized.scenarioPatch)
    .eq('id', scenario.id);
  if (scenarioRes.error) {
    return { ok: false, message: `Scenario opslaan mislukt: ${scenarioRes.error.message}` };
  }

  const rollback = async () => {
    await untyped.from('calculation_scenarios').update(oldScenarioPatch).eq('id', scenario.id);
    await untyped.from('scenario_costs').delete().eq('scenario_id', scenario.id).like('notes', `${OWNERSHIP_PREFIX}%`);
    if (previousOwned.length > 0) {
      const restore = previousOwned.map(({ id: _id, created_at: _createdAt, updated_at: _updatedAt, ...row }: Record<string, unknown>) => row);
      await untyped.from('scenario_costs').insert(restore);
    }
  };

  const deleteRes = await untyped
    .from('scenario_costs')
    .delete()
    .eq('scenario_id', scenario.id)
    .like('notes', `${OWNERSHIP_PREFIX}%`);
  if (deleteRes.error) {
    await rollback();
    return { ok: false, message: `Bestaande renovatiekosten vervangen mislukt: ${deleteRes.error.message}` };
  }

  if (normalized.scenarioCosts.length > 0) {
    const rows = normalized.scenarioCosts.map((cost) => ({
      scenario_id: scenario.id,
      cost_category: cost.category,
      description: cost.description,
      amount: cost.amount,
      calc_mode: 'fixed',
      vat_treatment: 'exclusive',
      notes: renovateAndSellCostNote(cost),
    }));
    const insertRes = await untyped.from('scenario_costs').insert(rows);
    if (insertRes.error) {
      await rollback();
      return { ok: false, message: `Renovatiekosten opslaan mislukt: ${insertRes.error.message}` };
    }
  }

  return { ok: true, warnings: normalized.warnings };
}
