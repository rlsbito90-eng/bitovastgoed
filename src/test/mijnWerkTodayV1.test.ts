import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const page = readFileSync(resolve(process.cwd(), 'src/pages/TakenPage.tsx'), 'utf8');
const state = readFileSync(resolve(process.cwd(), 'src/lib/takenViewState.ts'), 'utf8');
const workView = readFileSync(resolve(process.cwd(), 'src/lib/tasks/workView.ts'), 'utf8');

describe('Taken — Today v1', () => {
  it('start standaard op Vandaag en behoudt de rustige werkweergaven', () => {
    expect(state).toContain("tab: 'vandaag'");
    expect(state).toContain("'inbox' | 'vandaag' | 'komend' | 'openstaand' | 'later' | 'wachten' | 'alles' | 'afgerond'");
    expect(page).toContain('title="Taken"');
    expect(page).toContain("{ value: 'vandaag', label: 'Vandaag' }");
    expect(page).toContain("{ value: 'komend', label: 'Komend' }");
    expect(page).toContain("{ value: 'openstaand', label: 'Openstaand' }");
  });

  it('scheidt geplande dagfocus van achterstallige deadlines en groepeert Vandaag op dagdelen', () => {
    expect(workView).toContain('export function isTaskOverdue');
    expect(workView).toContain('export function isTaskPlannedToday');
    expect(workView).toContain('export function isTaskInTodayView');
    expect(page).toContain("renderSection('Ochtend'");
    expect(page).toContain("renderSection('Middag'");
    expect(page).toContain("renderSection('Later vandaag'");
    expect(page).toContain("renderSection('Achterstallig'");
    expect(page.indexOf("renderSection('Later vandaag'")).toBeLessThan(page.indexOf("renderSection('Achterstallig'"));
    expect(page).toContain("showAllOverdue ? 'Toon minder' : 'Bekijk alles'");
  });

  it('houdt snelle acties, CRM-context, selectie en mobiele taakrij intact', () => {
    expect(page).toContain('data-testid="taken-lijstregel"');
    expect(page).toContain('grid grid-cols-[auto,minmax(0,1fr)]');
    expect(page).toContain('col-start-2 row-start-2 flex min-w-0 flex-wrap');
    expect(page).toContain('Op wachten zetten');
    expect(page).toContain('Open relatie');
    expect(page).toContain('Open object');
    expect(page).toContain('Open deal');
    expect(page).toContain('Selecteer alles');
    expect(page).toContain('geselecteerd');
    expect(page).toContain('h-[calc(8rem+env(safe-area-inset-bottom))] sm:hidden');
    expect(page).toContain("selectionMode ? 'pb-[calc(12rem+env(safe-area-inset-bottom))]' : 'pb-24'");
  });

  it('verwijdert stil na bevestiging en beschermt onderliggende CRM- en Radar-data in de uitleg', () => {
    expect(page).toContain('Alleen deze taak wordt verwijderd. Onderliggende Radar-signalen, relaties, objecten, deals en overige historie blijven bestaan.');
    expect(page).not.toContain("toast.success('Taak verwijderd')");
    expect(page).not.toContain("}, 'Taken verwijderd');");
  });
});
