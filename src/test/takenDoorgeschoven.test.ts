import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Taak } from '@/data/mock-data';
import type { TaskPlanningMeta } from '@/lib/tasks/planning';
import { isTaskOverdue, isTaskPlannedToday, isTaskRolledOver, planDateLabel } from '@/lib/tasks/workView';

const now = new Date('2026-11-03T10:00:00');

const taak = (over: Partial<Taak> = {}): Taak =>
  ({ id: 't1', titel: 'Test', status: 'open', deadline: null, deadlineTijd: null, ...over }) as unknown as Taak;

const plan = (planDatum: string | null, planningBucket: TaskPlanningMeta['planningBucket'] = 'open'): TaskPlanningMeta =>
  ({ id: 't1', planDatum, planTijd: null, planningBucket }) as TaskPlanningMeta;

describe('Taken — Doorgeschoven', () => {
  it('plandatum in het verleden zonder deadline = doorgeschoven, niet achterstallig', () => {
    const t = taak();
    const p = plan('2026-11-01');
    expect(isTaskRolledOver(t, p, now)).toBe(true);
    expect(isTaskPlannedToday(t, p, now)).toBe(true);
    expect(isTaskOverdue(t, now)).toBe(false);
  });

  it('plandatum vandaag is gewoon gepland, niet doorgeschoven', () => {
    expect(isTaskRolledOver(taak(), plan('2026-11-03'), now)).toBe(false);
  });

  it('verstreken deadline blijft achterstallig en is niet doorgeschoven', () => {
    const t = taak({ deadline: '2026-11-02' } as Partial<Taak>);
    expect(isTaskOverdue(t, now)).toBe(true);
    expect(isTaskRolledOver(t, plan('2026-11-01'), now)).toBe(false);
  });

  it('deadline vandaag gaat voor op een oude plandatum', () => {
    const t = taak({ deadline: '2026-11-03', deadlineTijd: '17:00' } as Partial<Taak>);
    expect(isTaskRolledOver(t, plan('2026-11-01'), now)).toBe(false);
  });

  it('afgeronde, wachtende of naar Later/Inbox geparkeerde taken schuiven niet door', () => {
    expect(isTaskRolledOver(taak({ status: 'afgerond' } as Partial<Taak>), plan('2026-11-01'), now)).toBe(false);
    expect(isTaskRolledOver(taak({ status: 'wacht_op_reactie' } as Partial<Taak>), plan('2026-11-01'), now)).toBe(false);
    expect(isTaskRolledOver(taak(), plan('2026-11-01', 'later'), now)).toBe(false);
    expect(isTaskRolledOver(taak(), plan('2026-11-01', 'inbox'), now)).toBe(false);
  });

  it('toont Doorgeschoven als eerste sectie in Vandaag met een duidelijk label', () => {
    const page = readFileSync(resolve(process.cwd(), 'src/pages/TakenPage.tsx'), 'utf8');
    expect(page).toContain("renderSection('Doorgeschoven'");
    expect(page.indexOf("renderSection('Doorgeschoven'")).toBeLessThan(page.indexOf("renderSection('Ochtend'"));
  });
});

describe('Taken — label plandatum', () => {
  const today = '2026-11-03';
  const label = (t: Taak, p: TaskPlanningMeta) => planDateLabel(p.planDatum as string, today, isTaskRolledOver(t, p, now));

  it('toont de pijl bij een echt doorgeschoven taak', () => {
    expect(label(taak(), plan('2026-11-01'))).toBe('1 nov → vandaag');
  });

  it('toont geen pijl bij een achterstallige taak (deadline verstreken)', () => {
    const l = label(taak({ deadline: '2026-11-02' } as Partial<Taak>), plan('2026-11-01'));
    expect(l).not.toContain('→');
    expect(l).toBe('Gepland 1 nov');
  });

  it('toont geen pijl bij een harde deadline vandaag', () => {
    const l = label(taak({ deadline: '2026-11-03', deadlineTijd: '17:00' } as Partial<Taak>), plan('2026-11-01'));
    expect(l).not.toContain('→');
  });

  it('toont geen pijl bij een taak die op reactie wacht', () => {
    const l = label(taak({ status: 'wacht_op_reactie' } as Partial<Taak>), plan('2026-11-01'));
    expect(l).not.toContain('→');
  });

  it('laat vandaag, morgen en toekomstige plandata ongewijzigd', () => {
    expect(planDateLabel('2026-11-03', today, false)).toBe('Gepland vandaag');
    expect(planDateLabel('2026-11-04', today, false)).toBe('Gepland morgen');
    expect(planDateLabel('2026-11-10', today, false)).toBe('Gepland 10 nov');
  });

  it('de taakrij geeft de doorschuifstatus mee aan het label', () => {
    const page = readFileSync(resolve(process.cwd(), 'src/components/tasks/TaskRow.tsx'), 'utf8');
    expect(page).toContain('planDateLabel(planning.planDatum, today, isTaskRolledOver(task, planning, now))');
    expect(page).not.toContain('if (value < today)');
  });
});
