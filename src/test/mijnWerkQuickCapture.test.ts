import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const capture = readFileSync(resolve(process.cwd(), 'src/components/tasks/QuickTaskCapture.tsx'), 'utf8');
const dock = readFileSync(resolve(process.cwd(), 'src/components/tasks/QuickTaskCaptureDock.tsx'), 'utf8');
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

  it('biedt Things/Any.do-achtige planning vanuit de balk', () => {
    expect(capture).toContain("['today', 'Vandaag']");
    expect(capture).toContain("['tomorrow', 'Morgen']");
    expect(capture).toContain("['open', 'Openstaand']");
    expect(capture).toContain("['later', 'Later']");
    expect(capture).toContain('type="date"');
    expect(capture).toContain('type="time"');
    expect(capture).toContain('Optionele deadline');
  });

  it('ondersteunt meerdere CRM-koppelingen zonder legacy primaire koppelingen te breken', () => {
    expect(capture).toContain('replaceTaskLinks');
    expect(capture).toContain('links.relatie[0]');
    expect(capture).toContain('links.deal[0]');
    expect(capture).toContain('links.object[0]');
    expect(capture).toContain('links.signaal[0]');
    expect(capture).toContain('Selecteer één of meerdere relaties, deals, objecten of Radar-signalen.');
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
