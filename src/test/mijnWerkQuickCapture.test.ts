import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const capture = readFileSync(resolve(process.cwd(), 'src/components/tasks/QuickTaskCapture.tsx'), 'utf8');
const dock = readFileSync(resolve(process.cwd(), 'src/components/tasks/QuickTaskCaptureDock.tsx'), 'utf8');
const taskForm = readFileSync(resolve(process.cwd(), 'src/components/forms/TaakFormDialog.tsx'), 'utf8');
const taskLinksPicker = readFileSync(resolve(process.cwd(), 'src/components/tasks/TaskLinksPickerDialog.tsx'), 'utf8');
const app = readFileSync(resolve(process.cwd(), 'src/CrmProtectedApp.tsx'), 'utf8');
const takenPage = readFileSync(resolve(process.cwd(), 'src/pages/TakenPage.tsx'), 'utf8');
const planning = readFileSync(resolve(process.cwd(), 'src/lib/tasks/planning.ts'), 'utf8');
const links = readFileSync(resolve(process.cwd(), 'src/lib/tasks/links.ts'), 'utf8');

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
    expect(capture).toContain('Harde deadline toevoegen');
    expect(capture).toContain('PickerField');
    expect(capture).toContain('opacity-0');
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
