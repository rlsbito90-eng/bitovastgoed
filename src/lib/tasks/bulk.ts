import { supabase } from '@/integrations/supabase/client';
import type { TaakPrioriteit, TaakStatus } from '@/data/mock-data';
import type { TaskPlanningBucket } from './planning';

const db = supabase as any;

function uniqueIds(ids: string[]): string[] {
  return Array.from(new Set(ids.filter(Boolean)));
}

export async function bulkUpdateTaskPlanning(
  ids: string[],
  patch: { planDatum?: string | null; planningBucket?: TaskPlanningBucket },
): Promise<void> {
  const taskIds = uniqueIds(ids);
  if (taskIds.length === 0) return;
  const payload: Record<string, unknown> = {};
  if (patch.planDatum !== undefined) payload.plan_datum = patch.planDatum;
  if (patch.planningBucket !== undefined) payload.planning_bucket = patch.planningBucket;
  if (Object.keys(payload).length === 0) return;

  const { error } = await db.from('taken').update(payload).in('id', taskIds).is('soft_deleted_at', null);
  if (error) throw error;
}

export async function bulkUpdateTaskStatus(ids: string[], status: TaakStatus): Promise<void> {
  const taskIds = uniqueIds(ids);
  if (taskIds.length === 0) return;
  const { error } = await db.from('taken').update({ status }).in('id', taskIds).is('soft_deleted_at', null);
  if (error) throw error;
}

export async function bulkUpdateTaskPriority(ids: string[], prioriteit: TaakPrioriteit): Promise<void> {
  const taskIds = uniqueIds(ids);
  if (taskIds.length === 0) return;
  const { error } = await db.from('taken').update({ prioriteit }).in('id', taskIds).is('soft_deleted_at', null);
  if (error) throw error;
}
