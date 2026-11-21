// @vitest-environment jsdom
import React from 'react';
import {describe,it,expect,vi} from 'vitest';
import {fireEvent,render,screen} from '@testing-library/react';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import WorkPlanReminderSelect from '@/components/tasks/WorkPlanReminderSelect';
import {isTaskUnplanned,isTaskUpcoming,isTaskInTodayView} from '@/lib/tasks/workView';
import type {Taak} from '@/data/mock-data';
import type {TaskPlanningMeta} from '@/lib/tasks/planning';

const read=(path:string)=>readFileSync(resolve(process.cwd(),path),'utf8');
const migration=read('supabase/migrations/20261122010500_task_workday_reminder_without_time.sql');
const form=read('src/components/forms/TaakFormDialog.tsx');
const quick=read('src/components/tasks/QuickTaskCapture.tsx');
const planning=read('src/lib/tasks/planning.ts');
const repository=read('src/lib/tasks/reminders.ts');
const taken=read('src/pages/TakenPage.tsx');

describe('Planning in Bito CRM',()=>{
  const task={id:'t1',status:'open',deadline:null} as Taak;
  const now=new Date(2026,10,22,12,0);
  const legacy=(bucket:'open'|'inbox'|'later', deadline:string|null=null)=>{
    const t={...task,deadline} as Taak;
    const p:TaskPlanningMeta={id:'t1',planDatum:null,planTijd:null,planningBucket:bucket,reminderMode:'at_time'};
    return {t,p};
  };
  it('neemt Inbox, Later en Openstaand op in één Niet ingepland',()=>{
    for(const bucket of ['inbox','later','open'] as const){
      const {t,p}=legacy(bucket);
      expect(isTaskUnplanned(t,p,now)).toBe(true);
      expect(isTaskInTodayView(t,p,now)).toBe(false);
    }
    expect(taken).toContain("{ value: 'ongepland', label: 'Niet ingepland' }");
    expect(taken).not.toContain("{ value: 'later', label: 'Later' }");
    expect(taken).not.toContain("{ value: 'inbox', label: 'Inbox' }");
  });
  it('plaatst oude Inbox/Later taak met toekomstige deadline in Komend',()=>{
    const {t,p}=legacy('later','2026-12-01');
    expect(isTaskUpcoming(t,p,now)).toBe(true);
    expect(isTaskUnplanned(t,p,now)).toBe(false);
  });
  it('staat bij een werkdatum zonder werktijd een dagherinnering toe',()=>{
    const onChange=vi.fn();
    render(<WorkPlanReminderSelect value="none" onChange={onChange} hasDate hasTime={false}/>);
    const select=screen.getByLabelText('Herinnering bij werkplanning') as HTMLSelectElement;
    expect(select.disabled).toBe(false);
    fireEvent.change(select,{target:{value:'on_day'}});
    expect(onChange).toHaveBeenCalledWith('on_day');
    expect(screen.getByText('Op de werkdag om 09:00 uur')).toBeTruthy();
    expect(screen.queryByText('Op de gekozen werktijd')).toBeNull();
  });
  it('geen werkdatum: herinnering uitgeschakeld, zonder automatische melding',()=>{
    render(<WorkPlanReminderSelect value="on_day" onChange={()=>{}} hasDate={false} hasTime={false}/>);
    const select=screen.getByLabelText('Herinnering bij werkplanning') as HTMLSelectElement;
    expect(select.disabled).toBe(true);
    expect(select.value).toBe('none');
  });
  it('houdt herinneringsbeleid van bestaande taken en gebruikt geen werkdatum als deadline',()=>{
    expect(planning).toContain('plan_reminder_mode');
    expect(repository).toContain("plan_reminder_mode: planning.reminderMode ?? 'none'");
    expect(form).toContain('reminderMode:row.reminderMode');
    expect(form).toContain('getTaskPlanning(taak.id)');
    expect(form).toContain("if(workPlanDirty)await updateTaskPlanning(taak.id,workPlan)");
    expect(quick).toContain('workReminderMode');
    expect(quick).toContain('WorkPlanReminderSelect');
    expect(form).toContain('deadline: form.deadline || undefined');
  });
  it('backend plant 09:00 op werkdag of dag ervoor, volgens Europe/Amsterdam',()=>{
    expect(migration).toContain("when 'on_day' then (t.plan_datum + time '09:00') at time zone v_timezone");
    expect(migration).toContain("when 'day_before' then ((t.plan_datum - 1) + time '09:00') at time zone v_timezone");
    expect(migration).toContain("v_mode = 'none'");
    expect(migration).toContain("v_mode = 'at_time' and t.plan_tijd is null");
    expect(migration).toContain("old.plan_reminder_mode is distinct from new.plan_reminder_mode");
    expect(migration).toContain("  plan_reminder_mode\non public.taken");
    expect(migration).toContain("'at_time'");
    expect(migration).toContain("revoke all on function public.sync_task_plan_reminder_event(uuid)");
  });
});
