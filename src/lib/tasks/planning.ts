import { supabase } from '@/integrations/supabase/client';

export type TaskPlanningBucket = 'open' | 'inbox' | 'later';

export interface TaskPlanningMeta {
  id: string;
  planDatum: string | null;
  planningBucket: TaskPlanningBucket;
}

const db = supabase as any;

export async function listTaskPlanning(): Promise<TaskPlanningMeta[]> {
  const { data, error } = await db
    .from('taken')
    .select('id,plan_datum,planning_bucket')
    .is('soft_deleted_at', null);
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    id: row.id,
    planDatum: row.plan_datum ?? null,
    planningBucket: (row.planning_bucket ?? 'open') as TaskPlanningBucket,
  }));
}

export async function getTaskPlanning(taskId: string): Promise<TaskPlanningMeta> {
  const { data, error } = await db
    .from('taken')
    .select('id,plan_datum,planning_bucket')
    .eq('id', taskId)
    .single();
  if (error) throw error;
  return {
    id: data.id,
    planDatum: data.plan_datum ?? null,
    planningBucket: (data.planning_bucket ?? 'open') as TaskPlanningBucket,
  };
}

export async function updateTaskPlanning(
  taskId: string,
  patch: { planDatum?: string | null; planningBucket?: TaskPlanningBucket },
): Promise<void> {
  const payload: Record<string, unknown> = {};
  if (patch.planDatum !== undefined) payload.plan_datum = patch.planDatum;
  if (patch.planningBucket !== undefined) payload.planning_bucket = patch.planningBucket;
  if (Object.keys(payload).length === 0) return;

  const { error } = await db.from('taken').update(payload).eq('id', taskId);
  if (error) throw error;
}

export function taskPlanningMap(rows: TaskPlanningMeta[]): Map<string, TaskPlanningMeta> {
  return new Map(rows.map(row => [row.id, row]));
}
