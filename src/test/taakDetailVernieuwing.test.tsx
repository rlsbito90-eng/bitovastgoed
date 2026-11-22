// @vitest-environment jsdom
import React from 'react';
import {beforeEach,describe,expect,it,vi} from 'vitest';
import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import TaakPlanningDetail,{taskPlanDateLabel,taskReminderLabel,taskDeadlineLabel} from '@/components/tasks/TaakPlanningDetail';
import type {TaskPlanningMeta} from '@/lib/tasks/planning';
import type {Taak} from '@/data/mock-data';

const updatePlanning=vi.fn();
vi.mock('@/lib/tasks/planning',()=>({
  updateTaskPlanning:(...args:unknown[])=>updatePlanning(...args),
  WORK_REMINDER_OFFSETS:[5,10,15,30,60,120,1440,2880,10080],
}));
vi.mock('@/lib/tasks/reminders',()=>({
  getTaskReminderSelection:()=>Promise.resolve('default'),
  reminderSelectionToDb:(x:string)=>({reminder_policy:x}),
  formatReminderOffset:(n:number)=>n===0?'bij deadline':n+' minuten ervoor',
  TASK_REMINDER_OFFSETS:[0,15,60],
}));
vi.mock('@/integrations/supabase/client',()=>({
  supabase:{from:()=>({update:()=>({eq:()=>Promise.resolve({error:null})})})},
}));

const task={
  id:'task-123',titel:'Robin bellen',type:'Bellen',prioriteit:'normaal',
  status:'open',deadline:'',deadlineTijd:undefined,notities:'',
} as Taak;
const plan:TaskPlanningMeta={
  id:'task-123',planDatum:'2026-12-01',planTijd:null,
  planningBucket:'open',reminderMode:'none',
};

const source=readFileSync(resolve(process.cwd(),'src/pages/TaakDetailPage.tsx'),'utf8');
const picker=readFileSync(resolve(process.cwd(),'src/components/tasks/TaskLinksPickerDialog.tsx'),'utf8');

describe('Taakdetail: rustige directe interacties',()=>{
  beforeEach(()=>vi.clearAllMocks());
  it('gebruikt een enkele hoofdactie, full-width titel en een rustig menu',()=>{
    expect(source).toContain('displayClassName={`!text-2xl sm:!text-3xl');
    expect(source).toContain('showPencil={false}');
    expect(source).toContain('aria-label="Meer taakacties"');
    expect(source).toContain('Uitgebreid bewerken');
    expect(source).toContain('Taak verwijderen');
    expect(source).toContain('<TaakAfrondenDialog');
    expect(source).toContain('Voltooien');
    expect(source).not.toContain('Planning & koppelingen');
    expect(source).not.toContain('Notities & context');
    expect(source).not.toContain('section-card p-5');
  });

  it('bewaart zowel primaire als aanvullende koppelingen pas bij bevestigen',()=>{
    expect(source).toContain('listTaskLinks(taak.id)');
    expect(source).toContain('taskLinkSelectionFromLegacy(task)');
    expect(source).toContain('const openLinks=()=>');
    expect(source).toContain('if(linksLoading||linksError||!links||savingLinks)return;');
    expect(source).toContain('await updateTaak(taak.id,{');
    expect(source).toContain('await replaceTaskLinks(taak.id,linksForSave(next))');
    expect(source).toContain('onConfirm={next=>void saveLinks(next)}');
    expect(source).toContain('setLinksOpen(false)');
    expect(picker).toContain('onConfirm?: (selection: TaskLinkSelection) => void');
    expect(picker).toContain('if (onConfirm) onConfirm(next);');
    expect(picker).toContain('getRelatieNaamCompact(r, contactpersonen)');
  });

  it('toont correcte natuurlijke planningslabels en deadline',()=>{
    expect(taskPlanDateLabel(null)).toBe('Niet ingepland');
    expect(taskReminderLabel('none',false)).toBe('Geen');
    expect(taskReminderLabel('at_time',true)).toBe('Op de gekozen tijd');
    expect(taskDeadlineLabel(undefined,undefined)).toBe('Toevoegen');
    expect(taskDeadlineLabel('2026-12-01','10:30')).toContain('10:30');
  });

  it('laat een datum rechtstreeks aanpassen zonder harde deadline te wijzigen',async()=>{
    updatePlanning.mockResolvedValue(undefined);
    const refresh=vi.fn().mockResolvedValue(undefined);
    render(<TaakPlanningDetail task={task} planning={plan} loading={false}
      loadError={null} refreshPlanning={refresh} updateTask={vi.fn()}/>);
    fireEvent.click(screen.getByRole('button',{name:'Datum wijzigen'}));
    fireEvent.change(screen.getByLabelText('Planningdatum'),{target:{value:'2026-12-03'}});
    fireEvent.click(screen.getByRole('button',{name:'Opslaan'}));
    await waitFor(()=>expect(updatePlanning).toHaveBeenCalledWith('task-123',expect.objectContaining({
      planDatum:'2026-12-03',planningBucket:'open',
    })));
    await waitFor(()=>expect(refresh).toHaveBeenCalledTimes(1));
  });

  it('kan een herinnering instellen zonder werktijd',async()=>{
    updatePlanning.mockResolvedValue(undefined);
    const refresh=vi.fn().mockResolvedValue(undefined);
    render(<TaakPlanningDetail task={task} planning={plan} loading={false}
      loadError={null} refreshPlanning={refresh} updateTask={vi.fn()}/>);
    const select=screen.getByLabelText('Herinnering') as HTMLSelectElement;
    expect(select.disabled).toBe(false);
    fireEvent.change(select,{target:{value:'on_day'}});
    await waitFor(()=>expect(updatePlanning).toHaveBeenCalledWith('task-123',{reminderMode:'on_day'}));
    await waitFor(()=>expect(refresh).toHaveBeenCalledTimes(1));
  });

  it('houdt datum-/deadlinewijzigingen onafhankelijk van elkaar',async()=>{
    const updateTask=vi.fn().mockResolvedValue(undefined);
    render(<TaakPlanningDetail task={task} planning={plan} loading={false}
      loadError={null} refreshPlanning={vi.fn()} updateTask={updateTask}/>);
    fireEvent.click(screen.getByRole('button',{name:'Deadline wijzigen'}));
    fireEvent.change(screen.getByLabelText('Deadline datum'),{target:{value:'2026-12-12'}});
    fireEvent.change(screen.getByLabelText('Deadline tijd'),{target:{value:'16:00'}});
    fireEvent.click(screen.getByRole('button',{name:'Opslaan'}));
    await waitFor(()=>expect(updateTask).toHaveBeenCalledWith({
      deadline:'2026-12-12',deadlineTijd:'16:00',
    }));
    expect(updatePlanning).not.toHaveBeenCalled();
  });

  it('blokkeert planwijzigingen als de bestaande gegevens nog niet geladen zijn',()=>{
    render(<TaakPlanningDetail task={task} planning={null} loading={true}
      loadError={null} refreshPlanning={vi.fn()} updateTask={vi.fn()}/>);
    expect((screen.getByRole('button',{name:'Datum wijzigen'}) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button',{name:'Deadline wijzigen'}) as HTMLButtonElement).disabled).toBe(true);
  });
});
