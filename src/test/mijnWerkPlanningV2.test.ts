import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function read(rel: string): string {
  return fs.readFileSync(path.join(process.cwd(), rel), 'utf8');
}

const page = read('src/pages/TakenPage.tsx');
const viewState = read('src/lib/takenViewState.ts');
const planning = read('src/lib/tasks/planning.ts');
const workView = read('src/lib/tasks/workView.ts');
const migration = read('supabase/migrations/20260828104500_task_work_planning_fields.sql');

describe('Mijn werk planning v2', () => {
  it('heeft Inbox, Vandaag, Komend, Openstaand en Later als aparte werkbakken', () => {
    expect(viewState).toContain("'inbox'");
    expect(viewState).toContain("'vandaag'");
    expect(viewState).toContain("'komend'");
    expect(viewState).toContain("'openstaand'");
    expect(viewState).toContain("'later'");
    expect(viewState).toContain("tab: 'vandaag'");
  });

  it('houdt werkdatum en harde deadline technisch gescheiden', () => {
    expect(migration).toContain('plan_datum date');
    expect(migration).toContain('planning_bucket text');
    expect(migration).toContain("check (planning_bucket in ('open', 'inbox', 'later'))");
    expect(planning).toContain('plan_datum');
    expect(planning).toContain('planning_bucket');
    expect(page).toContain('updateTaskPlanning(task.id, patch)');
    expect(page).not.toContain("updateTaak(task.id, { deadline: iso })");
  });

  it('scheidt gepland Vandaag van achterstallige harde deadlines', () => {
    expect(workView).toContain('export function isTaskOverdue');
    expect(workView).toContain('export function isTaskPlannedToday');
    expect(workView).toContain('if (isTaakTeLaat(task, now)) return false');
    expect(workView).toContain("planning.planningBucket === 'open'");
    expect(workView).toContain('planning.planDatum <= today');
    expect(page).toContain('Deadline {deadlineLabel(task, now)}');
    expect(page).toContain('achterstallig');
  });

  it('biedt snelle planning zonder de deadline te verschuiven', () => {
    expect(page).toContain('Planning</DropdownMenuLabel>');
    expect(page).toContain("planningBucket: 'inbox'");
    expect(page).toContain("planningBucket: 'later'");
    expect(page).toContain("planningBucket: 'open', planDatum: null");
    expect(page).toContain('planAfterDays(event as any, task, 1)');
  });

  it('behoudt het mobiele taakrij-contract', () => {
    expect(page).toContain('data-testid="taken-lijstregel"');
    expect(page).toContain('grid grid-cols-[auto,minmax(0,1fr)]');
    expect(page).toContain('col-start-2 row-start-2 flex min-w-0 flex-wrap');
  });
});
