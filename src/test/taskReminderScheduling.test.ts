import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  formatReminderOffset,
  reminderDbToSelection,
  reminderSelectionToDb,
} from '@/lib/tasks/reminders';

function read(rel: string): string {
  return fs.readFileSync(path.join(process.cwd(), rel), 'utf8');
}

const migration = read('supabase/migrations/20260818120500_task_reminder_scheduling.sql');
const engine = read('supabase/functions/notification-engine-tick/index.ts');
const repository = read('src/lib/notifications/repository.ts');
const taskForm = read('src/components/forms/TaakFormDialog.tsx');

 describe('task reminder scheduling', () => {
  it('ondersteunt default, geen en expliciete offsets', () => {
    expect(reminderSelectionToDb('default')).toEqual({ reminder_policy: 'default', reminder_offset_minutes: null });
    expect(reminderSelectionToDb('none')).toEqual({ reminder_policy: 'none', reminder_offset_minutes: null });
    expect(reminderSelectionToDb('60')).toEqual({ reminder_policy: 'custom', reminder_offset_minutes: 60 });
    expect(reminderDbToSelection('custom', 15)).toBe('15');
    expect(formatReminderOffset(60)).toBe('1 uur ervoor');
    expect(formatReminderOffset(10080)).toBe('1 week ervoor');
  });

  it('plant een reminder server-side met scheduled_at vóór de deadline', () => {
    expect(migration).toContain("'task_reminder'");
    expect(migration).toContain('v_deadline_at - make_interval(mins => v_offset)');
    expect(migration).toContain('scheduled_at');
    expect(migration).toContain('trg_sync_task_reminder_event');
    expect(migration).toContain('task_default_reminder_minutes integer default 60');
  });

  it('laat timed taken niet meer via de oude dagmelding lopen', () => {
    expect(migration).toContain('and t.deadline_tijd is null');
    expect(migration).toContain("e.event_type in ('task_due_today', 'task_overdue', 'high_priority_task')");
  });

  it('dispatcht alleen events waarvan scheduled_at is bereikt', () => {
    expect(engine).toContain('scheduled_at.lte');
    expect(engine).toContain('const effectiveAt = new Date(e.scheduled_at ?? e.created_at).getTime()');
    expect(engine).toContain("task_reminder: 'task_due_enabled'");
    expect(repository).toContain('scheduled_at.lte');
  });

  it('slaat taak en reminder in één databasewrite op', () => {
    expect(taskForm).toContain('createManualTaskWithReminder(data)');
    expect(taskForm).toContain('updateManualTaskWithReminder(taak.id, data)');
    expect(taskForm).toContain('Standaard (');
    expect(taskForm).toContain('TASK_REMINDER_OFFSETS');
  });
});
