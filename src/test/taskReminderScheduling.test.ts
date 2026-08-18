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
const deliveryMigration = read('supabase/migrations/20260818120600_notification_delivery_scheduling.sql');
const rescheduleMigration = read('supabase/migrations/20260818120700_notification_delivery_reschedule_sync.sql');
const engine = read('supabase/functions/notification-engine-tick/index.ts');
const sender = read('supabase/functions/notification-push-send/index.ts');
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

  it('prequeued device-deliveries wachten server-side tot hun beschikbare moment', () => {
    expect(deliveryMigration).toContain('available_at timestamptz');
    expect(engine).toContain('available_at: effectiveAtIso');
    expect(engine).toContain('const effectiveAtIso = e.scheduled_at ?? e.created_at');
    expect(engine).toContain("task_reminder: 'task_due_enabled'");
    expect(sender).toContain(".lte('available_at', nowIso)");
    expect(sender).toContain(".order('available_at', { ascending: true })");
    expect(repository).toContain('scheduled_at.lte');
  });

  it('schuift een nog niet verzonden delivery mee als scheduled_at wijzigt', () => {
    expect(rescheduleMigration).toContain('after update of scheduled_at on public.notification_events');
    expect(rescheduleMigration).toContain('set available_at = coalesce(new.scheduled_at, new.created_at)');
    expect(rescheduleMigration).toContain('and sent_at is null');
    expect(rescheduleMigration).toContain('and failed_at is null');
  });

  it('slaat taak en reminder in één databasewrite op', () => {
    expect(taskForm).toContain('createManualTaskWithReminder(data)');
    expect(taskForm).toContain('updateManualTaskWithReminder(taak.id, data)');
    expect(taskForm).toContain('Standaard (');
    expect(taskForm).toContain('TASK_REMINDER_OFFSETS');
  });
});
