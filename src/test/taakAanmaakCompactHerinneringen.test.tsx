// @vitest-environment jsdom
import React,{useState} from 'react';
import {describe,it,expect,vi} from 'vitest';
import {fireEvent,render,screen} from '@testing-library/react';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import TaakWerkplanningVelden from '@/components/tasks/TaakWerkplanningVelden';
import WorkPlanReminderSelect from '@/components/tasks/WorkPlanReminderSelect';
import {reminderAfterTimeChange,WORK_REMINDER_OFFSETS,workReminderIsValid} from '@/lib/tasks/planning';
import type {ManualTaskPlanning} from '@/lib/tasks/reminders';

const read=(p:string)=>readFileSync(resolve(process.cwd(),p),'utf8');

describe('Taak aanmaken: compact en herinnering op gekozen tijd',()=>{
  it('kiest automatisch op gekozen tijd, maar overschrijft bewust Geen nooit',()=>{
    expect(reminderAfterTimeChange('none',null,'14:30',false)).toBe('at_time');
    expect(reminderAfterTimeChange('none',null,'14:30',true)).toBe('none');
    expect(reminderAfterTimeChange('at_time','14:30','15:30',false)).toBe('at_time');
    expect(reminderAfterTimeChange('at_time','14:30',null,false)).toBe('none');
    expect(reminderAfterTimeChange('offset_15','14:30',null,false)).toBe('none');
    expect(reminderAfterTimeChange('offset_1440','14:30',null,false)).toBe('offset_1440');
  });
  it('toont 5,10,15,30 min en 1,2 uur en dagen tot een week in Planning',()=>{
    const change=vi.fn();
    render(<WorkPlanReminderSelect hasDate hasTime value="at_time" onChange={change}/>);
    const menu=screen.getByLabelText('Herinnering') as HTMLSelectElement;
    expect(menu.value).toBe('at_time');
    for(const offset of WORK_REMINDER_OFFSETS){
      expect(menu.querySelector(`option[value="offset_${offset}"]`)).not.toBeNull();
    }
    fireEvent.change(menu,{target:{value:'offset_30'}});
    expect(change).toHaveBeenCalledWith('offset_30');
  });
  it('zonder werktijd alleen dagherinneringen, met vaste dag/tijd in Nederland',()=>{
    render(<WorkPlanReminderSelect hasDate hasTime={false} value="none" onChange={vi.fn()}/>);
    const menu=screen.getByLabelText('Herinnering') as HTMLSelectElement;
    expect(menu.querySelector('option[value="offset_5"]')).toBeNull();
    expect(menu.querySelector('option[value="offset_1440"]')).not.toBeNull();
    expect(menu.querySelector('option[value="offset_10080"]')).not.toBeNull();
    expect(workReminderIsValid('offset_5',true,false)).toBe(false);
    expect(workReminderIsValid('offset_1440',true,false)).toBe(true);
    expect(workReminderIsValid('none',false,false)).toBe(true);
  });
  it('automatische herinnering werkt ook in echte formulierbediening',()=>{
    function Harness(){
      const [plan,setPlan]=useState<ManualTaskPlanning>({
        planDatum:null,planTijd:null,planningBucket:'open',reminderMode:'none',
      });
      const [touched,setTouched]=useState(false);
      return <TaakWerkplanningVelden value={plan} onChange={setPlan}
        autoReminderOnTime={!touched} onReminderTouched={()=>setTouched(true)}/>;
    }
    render(<Harness/>);
    fireEvent.click(screen.getByRole('button',{name:'Vandaag'}));
    fireEvent.change(screen.getByLabelText('Tijd (optioneel)'),{target:{value:'14:30'}});
    expect((screen.getByLabelText('Herinnering') as HTMLSelectElement).value).toBe('at_time');
    fireEvent.change(screen.getByLabelText('Herinnering'),{target:{value:'none'}});
    fireEvent.change(screen.getByLabelText('Tijd (optioneel)'),{target:{value:'15:30'}});
    expect((screen.getByLabelText('Herinnering') as HTMLSelectElement).value).toBe('none');
  });
  it('compacte aanmaak heeft bereikbare koppelingen en een vaste knop onder de scrollinhoud',()=>{
    const form=read('src/components/forms/TaakFormDialog.tsx');
    expect(form).toContain('overscroll-contain');
    expect(form).toContain('shrink-0 flex-wrap items-center');
    expect(form).toContain('safe-area-inset-bottom');
    expect(form).toContain("'Taak aanmaken'");
    expect(form.indexOf('overflow-y-auto overscroll-contain')).toBeLessThan(form.indexOf('z-10 flex shrink-0'));
    expect(form).toContain("linkedSummary||'Relatie, object of deal toevoegen'");
    expect(form).toContain('deadlineExpanded');
    expect(form).toContain('notesExpanded');
  });
  it('backend verwerkt minuten/uren en kalenderdagen zonder DST-verschuiving',()=>{
    const sql=read('supabase/migrations/20261122014709_task_planning_reminder_offsets.sql');
    expect(sql).toContain('v_offset_minutes := substring(v_mode from 8)::integer');
    expect(sql).toContain("coalesce(t.plan_tijd, time '09:00')");
    expect(sql).toContain("make_interval(mins => v_offset_minutes)");
    expect(sql).toContain("v_offset_minutes / 1440");
    expect(sql).toContain("v_mode = 'none'");
    expect(sql).toContain("on conflict (user_id, occurrence_key) do update");
    expect(sql).toContain('revoke all on function public.sync_task_plan_reminder_event(uuid)');
  });
});
