import type { Taak, TaakStatus } from '@/data/mock-data';
import { isTaakTeLaat, isTaakVandaag } from '@/lib/taakHelpers';
import type { TaskPlanningMeta } from './planning';

export const isOpenTaskStatus = (status: TaakStatus) => status !== 'afgerond' && status !== 'geannuleerd';

export function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function planningForTask(
  task: Taak,
  planningById: Map<string, TaskPlanningMeta>,
): TaskPlanningMeta {
  return planningById.get(task.id) ?? {
    id: task.id,
    planDatum: null,
    planTijd: null,
    planningBucket: 'open',
  };
}

export function isTaskOverdue(task: Taak, now: Date): boolean {
  return isOpenTaskStatus(task.status) && task.status !== 'wacht_op_reactie' && isTaakTeLaat(task, now);
}

/**
 * Werk dat de gebruiker nu bewust in Vandaag hoort te zien, exclusief harde achterstand.
 * Een harde deadline vandaag telt mee, net als een plan_datum van vandaag of eerder.
 */
export function isTaskPlannedToday(
  task: Taak,
  planning: TaskPlanningMeta,
  now: Date,
): boolean {
  if (!isOpenTaskStatus(task.status) || task.status === 'wacht_op_reactie') return false;
  if (isTaakTeLaat(task, now)) return false;
  if (isTaakVandaag(task, now)) return true;
  const today = localDateKey(now);
  return planning.planningBucket === 'open' && !!planning.planDatum && planning.planDatum <= today;
}

export function isTaskInTodayView(
  task: Taak,
  planning: TaskPlanningMeta,
  now: Date,
): boolean {
  return isTaskOverdue(task, now) || isTaskPlannedToday(task, planning, now);
}

export function taskWorkDate(task: Taak, planning: TaskPlanningMeta): string | null {
  if (planning.planningBucket !== 'open') return null;
  return planning.planDatum || task.deadline || null;
}

export function isTaskUpcoming(
  task: Taak,
  planning: TaskPlanningMeta,
  now: Date,
): boolean {
  if (!isOpenTaskStatus(task.status) || task.status === 'wacht_op_reactie') return false;
  if (isTaskInTodayView(task, planning, now)) return false;
  const today = localDateKey(now);
  const date = taskWorkDate(task, planning);
  return !!date && date > today;
}

export function taskSourceLabel(task: Taak): string {
  if (task.offMarketSignaalId) return 'Radar';
  if (task.dealId) return 'Deal';
  if (task.objectId) return 'Object';
  if (task.relatieId) return 'Relatie';
  return 'Handmatig';
}
