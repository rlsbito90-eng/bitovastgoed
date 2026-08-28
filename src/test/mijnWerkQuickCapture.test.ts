import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const capture = readFileSync(resolve(process.cwd(), 'src/components/tasks/QuickTaskCapture.tsx'), 'utf8');
const dock = readFileSync(resolve(process.cwd(), 'src/components/tasks/QuickTaskCaptureDock.tsx'), 'utf8');
const app = readFileSync(resolve(process.cwd(), 'src/CrmProtectedApp.tsx'), 'utf8');
const takenPage = readFileSync(resolve(process.cwd(), 'src/pages/TakenPage.tsx'), 'utf8');

describe('Mijn werk — quick capture', () => {
  it('maakt een taak aan via de bestaande reminder repository en plant hem apart van de deadline', () => {
    expect(capture).toContain('createManualTaskWithReminder');
    expect(capture).toContain('updateTaskPlanning');
    expect(capture).toContain("reminderSelection: 'default'");
    expect(capture).not.toContain('deadline:');
  });

  it('biedt rustige werkbestemmingen zonder deadline te wijzigen', () => {
    expect(capture).toContain('<option value="today">Vandaag</option>');
    expect(capture).toContain('<option value="inbox">Inbox</option>');
    expect(capture).toContain('<option value="open">Openstaand</option>');
    expect(capture).toContain('<option value="later">Later</option>');
    expect(capture).toContain("planningBucket: 'open'");
    expect(capture).toContain("planningBucket: 'inbox'");
    expect(capture).toContain("planningBucket: 'later'");
  });

  it('staat inline op Mijn werk en blijft elders compact beschikbaar via de CRM-shell', () => {
    expect(app).toContain('<QuickTaskCaptureDock />');
    expect(takenPage).toContain('<QuickTaskCapture');
    expect(dock).toContain("location.pathname === '/taken'");
    expect(dock).toContain('return null');
    expect(dock).toContain('data-testid="quick-task-capture-dock"');
    expect(capture).toContain('data-testid="quick-task-capture"');
  });
});
