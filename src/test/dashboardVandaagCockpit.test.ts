import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Taak } from '@/data/mock-data';
import type { TaskPlanningMeta } from '@/lib/tasks/planning';
import { groupTodayWork, isTaskRolledOver } from '@/lib/tasks/workView';

const page = readFileSync(resolve(process.cwd(), 'src/pages/DashboardPage.tsx'), 'utf8');

const now = new Date('2026-11-03T10:00:00');
const taak = (id: string, over: Partial<Taak> = {}): Taak =>
  ({ id, titel: id, status: 'open', prioriteit: 'normaal', deadline: null, deadlineTijd: null, ...over }) as unknown as Taak;
const plannen: Record<string, Partial<TaskPlanningMeta>> = {};
const planningFor = (t: Taak): TaskPlanningMeta =>
  ({ id: t.id, planDatum: null, planTijd: null, planningBucket: 'open', ...(plannen[t.id] ?? {}) }) as TaskPlanningMeta;

describe('Dashboard D2 — werklijst met dezelfde regels als Taken', () => {
  const taken = [
    taak('te-laat-oud', { deadline: '2026-10-20' } as Partial<Taak>),
    taak('te-laat-nieuw', { deadline: '2026-11-02' } as Partial<Taak>),
    taak('door-1nov'),
    taak('door-30okt'),
    taak('vandaag-plan'),
    taak('vandaag-deadline', { deadline: '2026-11-03', deadlineTijd: '17:00' } as Partial<Taak>),
    taak('komend'),
    taak('wacht', { status: 'wacht_op_reactie' } as Partial<Taak>),
    taak('klaar', { status: 'afgerond' } as Partial<Taak>),
    taak('later-geparkeerd'),
    taak('door-maar-te-laat', { deadline: '2026-11-01' } as Partial<Taak>),
  ];
  Object.assign(plannen, {
    'door-1nov': { planDatum: '2026-11-01' },
    'door-30okt': { planDatum: '2026-10-30' },
    'vandaag-plan': { planDatum: '2026-11-03', planTijd: '14:00' },
    'komend': { planDatum: '2026-11-10' },
    'wacht': { planDatum: '2026-11-01' },
    'later-geparkeerd': { planDatum: '2026-11-01', planningBucket: 'later' },
    'door-maar-te-laat': { planDatum: '2026-10-28' },
  });
  const groups = groupTodayWork(taken, planningFor, now);
  const ids = (list: Taak[]) => list.map(t => t.id);

  it('deelt in drie groepen en sorteert ze', () => {
    expect(ids(groups.achterstallig)).toEqual(['te-laat-oud', 'door-maar-te-laat', 'te-laat-nieuw']);
    expect(ids(groups.doorgeschoven)).toEqual(['door-30okt', 'door-1nov']);
    expect(ids(groups.vandaag)).toEqual(['vandaag-plan', 'vandaag-deadline']);
  });

  it('elke taak staat in hoogstens één groep; wachtend, afgerond, komend en Later vallen erbuiten', () => {
    const alle = [...groups.achterstallig, ...groups.doorgeschoven, ...groups.vandaag].map(t => t.id);
    expect(new Set(alle).size).toBe(alle.length);
    for (const uit of ['komend', 'wacht', 'klaar', 'later-geparkeerd']) expect(alle).not.toContain(uit);
  });

  it('doorgeschoven = exact isTaskRolledOver, dus gelijk aan de Taken-module', () => {
    const verwacht = taken.filter(t => t.status !== 'wacht_op_reactie' && isTaskRolledOver(t, planningFor(t), now)).map(t => t.id).sort();
    expect(ids(groups.doorgeschoven).sort()).toEqual(verwacht);
  });

  it('dashboard gebruikt de werklijst en TaskRow, zonder de oude Vandaag-strip, hero en KPI-kaarten', () => {
    expect(page).toContain('listTaskPlanning');
    expect(page).toContain('groupTodayWork(taken, planningFor, nu)');
    expect(page).toContain('<DashboardWerklijst');
    expect(page).toContain('<TaskRow');
    expect(page).toContain('<TaakAfrondenDialog');
    expect(page).not.toContain('<VandaagStrip');
    expect(page).not.toContain('<KPICard');
    expect(page).toContain('berekenAanbodvolume(actieveObjecten)');
    expect(page).toContain('aanbodvolume={aanbodvolume}');
    expect(page).not.toContain('kpi-hero');
    expect(page.indexOf('<DashboardKengetallen')).toBeLessThan(page.indexOf('<DashboardWerklijst'));
    expect(page.indexOf('<DashboardWerklijst')).toBeLessThan(page.indexOf('Object Pipeline momentum'));
  });

  it('achterstallig-kengetal komt uit dezelfde werklijst', () => {
    expect(page).toContain('achterstallig={werklijst.achterstallig.length}');
  });

  it('de vier kengetallen komen niet nog eens elders op het dashboard terug', () => {
    expect(page).not.toContain('label="Actieve objecten"');
    expect(page).not.toContain('Actief aanbodvolume');
  });
});

describe('Dashboard D3 — Aandacht nodig', () => {
  it('staat naast Mijn werkzaamheden en gebruikt de gedeelde logica', () => {
    expect(page).toContain('<DashboardAandacht');
    expect(page).toContain('bepaalAandacht(');
    expect(page).toContain('useBiedingen({ all: true })');
    expect(page).toContain('lg:grid-cols-2');
    expect(page.indexOf('<DashboardWerklijst')).toBeLessThan(page.indexOf('<DashboardAandacht'));
  });

  it('leest live uit de store, zodat nieuwe taken en contactmomenten direct doorwerken', () => {
    expect(page).toContain('store.contactMoments');
    expect(page).toContain('store.pipelineKandidaten');
    expect(page).toContain('planningById.get(taak.id)?.planDatum');
  });

  it('plannen legt een plandatum vast (geen harde deadline) en werkt de planning direct bij', () => {
    expect(page).toContain('<OpvolgingPlannenDialog');
    expect(page).not.toContain('defaultDeadline={vandaagKey}');
    expect(page).toContain("{ id, planDatum, planTijd: null, planningBucket: 'open' }");
  });

  it('geeft de partij van een bieding door via de bestaande relatienaam', () => {
    expect(page).toContain('relatieNaam: id =>');
    expect(page).toContain('getRelatieNaamCompact(rel, store.contactpersonen)');
  });

  it('bestaande onderdelen blijven tot D4 staan', () => {
    for (const s of ['Object Pipeline momentum', 'Nieuwe kansen', '<CommissieWidget']) expect(page).toContain(s);
  });
});
