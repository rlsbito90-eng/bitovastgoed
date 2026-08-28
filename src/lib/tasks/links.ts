import { supabase } from '@/integrations/supabase/client';

export type TaskLinkEntityType = 'relatie' | 'deal' | 'object' | 'signaal';

export interface TaskLinkInput {
  entityType: TaskLinkEntityType;
  entityId: string;
  isPrimary?: boolean;
}

export interface TaskLinkRow extends TaskLinkInput {
  id: string;
  taskId: string;
}

const db = supabase as any;

export async function replaceTaskLinks(taskId: string, links: TaskLinkInput[]): Promise<void> {
  const { error: deleteError } = await db.from('task_links').delete().eq('task_id', taskId);
  if (deleteError) throw deleteError;
  if (links.length === 0) return;

  const unique = Array.from(
    new Map(links.map(link => [`${link.entityType}:${link.entityId}`, link])).values(),
  );
  const { error } = await db.from('task_links').insert(unique.map(link => ({
    task_id: taskId,
    entity_type: link.entityType,
    entity_id: link.entityId,
    is_primary: Boolean(link.isPrimary),
  })));
  if (error) throw error;
}

export async function listTaskLinks(taskId: string): Promise<TaskLinkRow[]> {
  const { data, error } = await db
    .from('task_links')
    .select('id,task_id,entity_type,entity_id,is_primary')
    .eq('task_id', taskId)
    .order('is_primary', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    id: row.id,
    taskId: row.task_id,
    entityType: row.entity_type as TaskLinkEntityType,
    entityId: row.entity_id,
    isPrimary: Boolean(row.is_primary),
  }));
}
