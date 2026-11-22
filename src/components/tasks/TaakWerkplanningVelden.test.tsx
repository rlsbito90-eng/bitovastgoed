// @vitest-environment jsdom
import React from 'react';
import {describe,expect,it,vi} from 'vitest';
import {fireEvent,render,screen} from '@testing-library/react';
import type {ManualTaskPlanning} from '@/lib/tasks/reminders';
import TaakWerkplanningVelden, {
  selectedWorkPlanChoice,
  workPlanForChoice,
} from './TaakWerkplanningVelden';

const now=new Date(2026,10,21,15,30); // lokale datum, geen UTC-verschil

describe('Werkplanning is geen harde deadline',()=>{
  it('vereenvoudigt plankeuzes zonder bestaande inbox-/latergegevens te verwijderen',()=>{
    expect(workPlanForChoice('today',now)).toEqual({
      planDatum:'2026-11-21',planTijd:null,planningBucket:'open',
    });
    expect(workPlanForChoice('tomorrow',now)).toEqual({
      planDatum:'2026-11-22',planTijd:null,planningBucket:'open',
    });
    expect(workPlanForChoice('none',now)).toEqual({
      planDatum:null,planTijd:null,planningBucket:'open',reminderMode:'none',
    });
    expect(selectedWorkPlanChoice({planDatum:null,planTijd:null,planningBucket:'inbox'},now)).toBe('none');
    expect(selectedWorkPlanChoice({planDatum:null,planTijd:null,planningBucket:'later'},now)).toBe('none');
  });

  it('behoudt de actuele planning als de gebruiker alleen het formulier opent',()=>{
    const plan:ManualTaskPlanning={
      planDatum:'2026-12-03',planTijd:'15:20:00',planningBucket:'open',
    };
    expect(selectedWorkPlanChoice(plan,now)).toBeNull();
    const changed=vi.fn();
    render(<TaakWerkplanningVelden value={plan} onChange={changed}/>);
    expect(screen.getByLabelText('Datum')).toHaveValue('2026-12-03');
    expect(screen.getByLabelText('Tijd (optioneel)')).toHaveValue('15:20');
    expect(changed).not.toHaveBeenCalled();
  });

  it('selecteert Vandaag zonder kunstmatige deadline en laat werktijd pas met datum toe',()=>{
    const change=vi.fn();
    const plan:ManualTaskPlanning={planDatum:null,planTijd:null,planningBucket:'open'};
    const {rerender}=render(<TaakWerkplanningVelden value={plan} onChange={change}/>);
    expect(screen.getByLabelText('Tijd (optioneel)')).toBeDisabled();
    fireEvent.click(screen.getByRole('button',{name:'Vandaag'}));
    const next=change.mock.calls[0][0] as ManualTaskPlanning;
    expect(next.planDatum).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect('deadline' in next).toBe(false);
    rerender(<TaakWerkplanningVelden value={next} onChange={change}/>);
    expect(screen.getByLabelText('Tijd (optioneel)')).not.toBeDisabled();
    fireEvent.change(screen.getByLabelText('Tijd (optioneel)'),{
      target:{value:'14:30'},
    });
    expect(change).toHaveBeenLastCalledWith({...next,planTijd:'14:30',reminderMode:'none'});
  });

  it('maakt werktijd leeg als de werkdatum wordt gewist',()=>{
    const change=vi.fn();
    render(<TaakWerkplanningVelden
      value={{planDatum:'2026-11-25',planTijd:'10:45',planningBucket:'open'}}
      onChange={change}/>);
    fireEvent.change(screen.getByLabelText('Datum'),{target:{value:''}});
    expect(change).toHaveBeenCalledWith({
      planDatum:null,planTijd:null,planningBucket:'open',reminderMode:'none',
    });
  });
});
