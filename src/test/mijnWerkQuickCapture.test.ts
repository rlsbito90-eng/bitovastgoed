import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const capture = readFileSync(resolve(process.cwd(), 'src/components/tasks/QuickTaskCapture.tsx'), 'utf8');
const dock = readFileSync(resolve(process.cwd(), 'src/components/tasks/QuickTaskCaptureDock.tsx'), 'utf8');
const taskForm = readFileSync(resolve(process.cwd(), 'src/components/forms/TaakFormDialog.tsx'), 'utf8');
const taskLinksPicker = readFileSync(resolve(process.cwd(), 'src/components/tasks/TaskLinksPickerDialog.tsx'), 'utf8');
const taskDetail = readFileSync(resolve(process.cwd(), 'src/pages/TaakDetailPage.tsx'), 'utf8');
const app = readFileSync(resolve(process.cwd(), 'src/CrmProtectedApp.tsx'), 'utf8');
const takenPage = readFileSync(resolve(process.cwd(), 'src/pages/TakenPage.tsx'), 'utf8');
const planning = readFileSync(resolve(process.cwd(), 'src/lib/tasks/planning.ts'), 'utf8');
const links = readFileSync(resolve(process.cwd(), 'src/lib/tasks/links.ts'), 'utf8');
const planReminderMigration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20260829183000_task_plan_time_notifications.sql'), 'utf8');
const notificationEngine = readFileSync(resolve(process.cwd(), 'supabase/functions/notification-engine-tick/index.ts'), 'utf8');

describe('Taken — Quick Capture v2', () => {
  it('maakt een taak aan via de bestaande reminder repository en houdt werkplanning los van deadline', () => {
    expect(capture).toContain('createManualTaskWithReminder');
    expect(capture).toContain('updateTaskPlanning');
    expect(capture).toContain("reminderSelection: 'default'");
    expect(capture).toContain('deadline: deadline || undefined');
    expect(capture).toContain('planTijd');
    expect(planning).toContain('plan_tijd');
  });

  it('biedt compacte planning vanuit de balk zonder native datumvelden zichtbaar te maken', () => {
    expect(capture).toContain("['today', 'Vandaag']");
    expect(capture).toContain("['tomorrow', 'Morgen']");
    expect(capture).toContain("['open', 'Openstaand']");
    expect(capture).toContain("['later', 'Later']");
    expect(capture).toContain('label="Datum"');
    expect(capture).toContain('label="Tijd"');
    expect(capture).not.toContain('label="Werkdatum"');
    expect(capture).not.toContain('label="Werktijd"');
    expect(capture).toContain('Harde deadline toevoegen');
    expect(capture).toContain('PickerField');
    expect(capture).toContain('opacity-0');
  });

  it('maakt plan_datum + plan_tijd notificerend zonder er een deadline van te maken', () => {
    expect(planReminderMigration).toContain('sync_task_plan_reminder_event');
    expect(planReminderMigration).toContain("'task_plan_reminder'");
    expect(planReminderMigration).toContain('(t.plan_datum + t.plan_tijd) at time zone v_timezone');
    expect(planReminderMigration).toContain("'Tijd voor je taak'");
    expect(planReminderMigration).toContain('plan_datum,');
    expect(planReminderMigration).toContain('plan_tijd');
    expect(notificationEngine).toContain("task_plan_reminder: 'task_due_enabled'");
  });

  it('toont op taakdetail de planning neutraal en een harde deadline afzonderlijk', () => {
    expect(taskDetail).toContain('getTaskPlanning');
    expect(taskDetail).toContain('planningDateLabel');
    expect(taskDetail).toContain("return 'Gepland vandaag'");
    expect(taskDetail).toContain('planning?.planDatum');
    expect(taskDetail).toContain('Deadline {deadlineLabel');
    expect(taskDetail).toContain("teLaat ? 'text-destructive font-medium' : ''");
    expect(taskDetail).not.toContain("'Zonder datum'");
  });

  it('houdt Quick Capture eenvoudig en verplaatst meervoudige CRM-koppelingen naar taak bewerken', () => {
    expect(capture).not.toContain('CRM-context koppelen');
    expect(capture).not.toContain('replaceTaskLinks');
    expect(taskForm).toContain('TaskLinksPickerDialog');
    expect(taskForm).toContain('replaceTaskLinks');
    expect(taskForm).toContain('taskLinkCount');
    expect(taskLinksPicker).toContain('Koppelingen bewerken');
    expect(taskLinksPicker).toContain('Radar-signalen');
    expect(links).toContain("'relatie' | 'deal' | 'object' | 'signaal'");
  });

  it('blijft op Taken beschikbaar en elders compact via de CRM-shell', () => {
    expect(app).toContain('<QuickTaskCaptureDock />');
    expect(takenPage).toContain('<QuickTaskCapture');
    expect(dock).toContain("location.pathname === '/taken'");
    expect(dock).toContain('return null');
    expect(capture).toContain('data-testid="quick-task-capture"');
  });
});
