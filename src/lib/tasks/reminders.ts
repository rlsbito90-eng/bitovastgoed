import { supabase } from '@/integrations/supabase/client';

export type TaskReminderPolicy = 'default' | 'none' | 'custom';
export type TaskReminderSelection = 'default' | 'none' | `${number}`;

export const TASK_REMINDER_OFFSETS = [0, 5, 10, 15, 30, 60, 120, 1440, 2880, 10080] as const;

export function formatReminderOffset(minutes: number | null): string {
  if (minutes == null) return 'geen melding';
  if (minutes === 0) return 'bij deadline';
  if (minutes < 60) return `${minutes} minuten ervoor`;
  if (minutes === 60) return '1 uur ervoor';
  if (minutes === 120) return '2 uur ervoor';
  if (minutes === 1440) return '1 dag ervoor';
  if (minutes === 2880) return '2 dagen ervoor';
  if (minutes === 10080) return '1 week ervoor';
  return `${minutes} minuten ervoor`;
}

export function reminderSelectionLabel(selection: TaskReminderSelection, defaultMinutes: number | null): string {
  if (selection === 'default') return `Standaard (${formatReminderOffset(defaultMinutes)})`;
  if (selection === 'none') return 'Geen';
  return formatReminderOffset(Number(selection));
}

export function reminderSelectionToDb(selection: TaskReminderSelection): {
  reminder_policy: TaskReminderPolicy;
  reminder_offset_minutes: number | null;
} {
  if (selection === 'default') return { reminder_policy: 'default', reminder_offset_minutes: null };
  if (selection === 'none') return { reminder_policy: 'none', reminder_offset_minutes: null };
  return { reminder_policy: 'custom', reminder_offset_minutes: Number(selection) };
}

export function reminderDbToSelection(policy: TaskReminderPolicy | null | undefined, offset: number | null | undefined): TaskReminderSelection {
  if (policy === 'custom' && offset != null) return `${offset}`;
  if (policy === 'default') return 'default';
  return 'none';
}

export interface ManualTaskInput {
  titel: string;
  relatieId?: string;
  dealId?: string;
  objectId?: string;
  offMarketSignaalId?: string;
  type: string;
  deadline?: string;
  deadlineTijd?: string;
  prioriteit: string;
  status: string;
  notities?: string;
  reminderSelection: TaskReminderSelection;
}

function taskPayload(input: ManualTaskInput) {
  return {
    titel: input.titel.trim() || 'Naamloze taak',
    relatie_id: input.relatieId || null,
    deal_id: input.dealId || null,
    object_id: input.objectId || null,
    off_market_signaal_id: input.offMarketSignaalId || null,
    type_taak: input.type || null,
    deadline: input.deadline || null,
    deadline_tijd: input.deadline ? (input.deadlineTijd || null) : null,
    prioriteit: input.prioriteit,
    status: input.status,
    notities: input.notities || null,
    ...reminderSelectionToDb(input.reminderSelection),
  };
}

const db = supabase as any;

export async function createManualTaskWithReminder(input: ManualTaskInput): Promise<string> {
  const { data, error } = await db.from('taken').insert(taskPayload(input)).select('id').single();
  if (error) throw error;
  return data.id as string;
}

export async function updateManualTaskWithReminder(id: string, input: ManualTaskInput): Promise<void> {
  const { error } = await db.from('taken').update(taskPayload(input)).eq('id', id);
  if (error) throw error;
}

export async function getTaskReminderSelection(taskId: string): Promise<TaskReminderSelection> {
  const { data, error } = await db
    .from('taken')
    .select('reminder_policy,reminder_offset_minutes')
    .eq('id', taskId)
    .single();
  if (error) throw error;
  return reminderDbToSelection(data?.reminder_policy, data?.reminder_offset_minutes);
}
