import type { TaakStatus } from '@/data/mock-data';

export const TASK_SOURCE_KINDS = {
  DEAL: 'deal',
  OBJECT_PIPELINE: 'object_pipeline',
  VASTGOEDKANS: 'vastgoedkans',
  OFF_MARKET_SIGNAAL: 'off_market_signaal',
  CONTACTMOMENT: 'contactmoment',
  ACQUISITIE: 'acquisitie',
} as const;

export const TASK_SOURCE_SLOTS = {
  FOLLOW_UP: 'follow_up',
  VOLGENDE_ACTIE: 'volgende_actie',
  POST_OPVOLGING: 'post_opvolging',
} as const;

export type TaskSourceKind = typeof TASK_SOURCE_KINDS[keyof typeof TASK_SOURCE_KINDS];
export type TaskSourceSlot = typeof TASK_SOURCE_SLOTS[keyof typeof TASK_SOURCE_SLOTS];

export interface TaskSourceIdentity {
  sourceKind: TaskSourceKind;
  sourceId: string;
  sourceSlot: TaskSourceSlot;
}

export interface SourceBoundTaskLike {
  id: string;
  status: TaakStatus;
  softDeletedAt?: string | null;
  sourceKind?: string | null;
  sourceId?: string | null;
  sourceSlot?: string | null;
  deadline?: string | null;
  createdAt?: string | null;
}

export const ACTIVE_TASK_STATUSES: ReadonlySet<TaakStatus> = new Set([
  'open',
  'in_uitvoering',
  'wacht_op_reactie',
]);

export function hasCompleteTaskSourceIdentity(identity: Partial<TaskSourceIdentity>): identity is TaskSourceIdentity {
  return Boolean(identity.sourceKind && identity.sourceId && identity.sourceSlot);
}

export function isActiveSourceTask(task: Pick<SourceBoundTaskLike, 'status' | 'softDeletedAt'>): boolean {
  return !task.softDeletedAt && ACTIVE_TASK_STATUSES.has(task.status);
}

export function matchesTaskSourceIdentity(
  task: Pick<SourceBoundTaskLike, 'sourceKind' | 'sourceId' | 'sourceSlot'>,
  identity: TaskSourceIdentity,
): boolean {
  return task.sourceKind === identity.sourceKind
    && task.sourceId === identity.sourceId
    && task.sourceSlot === identity.sourceSlot;
}

/**
 * Selecteert deterministisch de bestaande actieve taak voor een domein-actieslot.
 * Normaal hoort de database-unique-index maximaal één resultaat toe te laten.
 * De deterministische fallback voorkomt willekeurig gedrag bij legacy/voor-migratiedata.
 */
export function findActiveTaskForSource<T extends SourceBoundTaskLike>(
  tasks: T[],
  identity: TaskSourceIdentity,
): T | null {
  const matches = tasks
    .filter((task) => isActiveSourceTask(task) && matchesTaskSourceIdentity(task, identity))
    .sort((a, b) => {
      const aDeadline = a.deadline || '9999-12-31';
      const bDeadline = b.deadline || '9999-12-31';
      if (aDeadline !== bDeadline) return aDeadline.localeCompare(bDeadline);
      const aCreated = a.createdAt || '';
      const bCreated = b.createdAt || '';
      if (aCreated !== bCreated) return aCreated.localeCompare(bCreated);
      return a.id.localeCompare(b.id);
    });

  return matches[0] ?? null;
}

export function dealFollowUpIdentity(dealId: string): TaskSourceIdentity {
  return {
    sourceKind: TASK_SOURCE_KINDS.DEAL,
    sourceId: dealId,
    sourceSlot: TASK_SOURCE_SLOTS.FOLLOW_UP,
  };
}

export function pipelineNextActionIdentity(pipelineId: string): TaskSourceIdentity {
  return {
    sourceKind: TASK_SOURCE_KINDS.OBJECT_PIPELINE,
    sourceId: pipelineId,
    sourceSlot: TASK_SOURCE_SLOTS.VOLGENDE_ACTIE,
  };
}

export function vastgoedkansNextActionIdentity(vastgoedkansId: string): TaskSourceIdentity {
  return {
    sourceKind: TASK_SOURCE_KINDS.VASTGOEDKANS,
    sourceId: vastgoedkansId,
    sourceSlot: TASK_SOURCE_SLOTS.VOLGENDE_ACTIE,
  };
}
