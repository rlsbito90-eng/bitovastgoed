import { supabase } from '@/integrations/supabase/client';

export type TaskPlanningBucket = 'open' | 'inbox' | 'later';
export const WORK_REMINDER_OFFSETS = [5,10,15,30,60,120,1440,2880,10080] as const;
export type WorkReminderOffset = typeof WORK_REMINDER_OFFSETS[number];
export type WorkReminderMode = 'none' | 'on_day' | 'day_before' | 'at_time' | `offset_${WorkReminderOffset}`;

/** De tijdkeuze geeft standaard een herinnering, tenzij Geen bewust is geselecteerd. */
export function reminderAfterTimeChange(
  mode:WorkReminderMode,timeBefore:string|null|undefined,timeAfter:string|null|undefined,
  userExplicitlyChoseReminder:boolean,
):WorkReminderMode{
  if(!timeAfter){
    if(mode==='at_time'||(mode.startsWith('offset_')&&Number(mode.slice(7))<1440))return 'none';
    return mode;
  }
  if(!timeBefore&&mode==='none'&&!userExplicitlyChoseReminder)return 'at_time';
  return mode;
}
export function workReminderIsValid(mode:WorkReminderMode,hasDate:boolean,hasTime:boolean):boolean {
  if(!hasDate)return mode==='none';
  if(mode==='at_time')return hasTime;
  if(mode.startsWith('offset_'))return hasTime||Number(mode.slice(7))>=1440;
  return true;
}

export interface TaskPlanningMeta {
  id: string;
  planDatum: string | null;
  planTijd: string | null;
  planningBucket: TaskPlanningBucket;
  reminderMode: WorkReminderMode;
}

const db = supabase as any;

export async function listTaskPlanning(): Promise<TaskPlanningMeta[]> {
  const { data, error } = await db
    .from('taken')
    .select('id,plan_datum,plan_tijd,planning_bucket,plan_reminder_mode')
    .is('soft_deleted_at', null);
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    id: row.id,
    planDatum: row.plan_datum ?? null,
    planTijd: row.plan_tijd ?? null,
    planningBucket: (row.planning_bucket ?? 'open') as TaskPlanningBucket,
    reminderMode: (row.plan_reminder_mode ?? 'at_time') as WorkReminderMode,
  }));
}

export async function getTaskPlanning(taskId: string): Promise<TaskPlanningMeta> {
  const { data, error } = await db
    .from('taken')
    .select('id,plan_datum,plan_tijd,planning_bucket,plan_reminder_mode')
    .eq('id', taskId)
    .single();
  if (error) throw error;
  return {
    id: data.id,
    planDatum: data.plan_datum ?? null,
    planTijd: data.plan_tijd ?? null,
    planningBucket: (data.planning_bucket ?? 'open') as TaskPlanningBucket,
    reminderMode: (data.plan_reminder_mode ?? 'at_time') as WorkReminderMode,
  };
}

export async function updateTaskPlanning(
  taskId: string,
  patch: { planDatum?: string | null; planTijd?: string | null; planningBucket?: TaskPlanningBucket; reminderMode?: WorkReminderMode },
): Promise<void> {
  const payload: Record<string, unknown> = {};
  if (patch.planDatum !== undefined) {
    payload.plan_datum = patch.planDatum;
    if(patch.planDatum===null && patch.planTijd===undefined) payload.plan_tijd = null;
  }
  if (patch.planTijd !== undefined) payload.plan_tijd = patch.planTijd;
  if (patch.planningBucket !== undefined) payload.planning_bucket = patch.planningBucket;
  if (patch.reminderMode !== undefined) payload.plan_reminder_mode = patch.reminderMode;
  if (Object.keys(payload).length === 0) return;

  const { error } = await db.from('taken').update(payload).eq('id', taskId);
  if (error) throw error;
}

export function taskPlanningMap(rows: TaskPlanningMeta[]): Map<string, TaskPlanningMeta> {
  return new Map(rows.map(row => [row.id, row]));
}
