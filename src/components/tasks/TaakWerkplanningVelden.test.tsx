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
  it('scheidt vandaag, morgen, openstaand, later en inbox',()=>{
    expect(workPlanForChoice('today',now)).toEqual({
      planDatum:'2026-11-21',planTijd:null,planningBucket:'open',
    });
    expect(workPlanForChoice('tomorrow',now)).toEqual({
      planDatum:'2026-11-22',planTijd:null,planningBucket:'open',
    });
    expect(workPlanForChoice('open',now)).toEqual({
      planDatum:null,planTijd:null,planningBucket:'open',
    });
    expect(workPlanForChoice('later',now).planningBucket).toBe('later');
    expect(workPlanForChoice('inbox',now).planningBucket).toBe('inbox');
  });

  it('behoudt de actuele planning als de gebruiker alleen het formulier opent',()=>{
    const plan:ManualTaskPlanning={
      planDatum:'2026-12-03',planTijd:'15:20:00',planningBucket:'open',
    };
    expect(selectedWorkPlanChoice(plan,now)).toBeNull();
    const changed=vi.fn();
    render(<TaakWerkplanningVelden value={plan} onChange={changed}/>);
    expect(screen.getByLabelText('Werkdatum')).toHaveValue('2026-12-03');
    expect(screen.getByLabelText('Werktijd (optioneel)')).toHaveValue('15:20');
    expect(changed).not.toHaveBeenCalled();
  });

  it('selecteert Vandaag zonder kunstmatige deadline en laat werktijd pas met datum toe',()=>{
    const change=vi.fn();
    const plan:ManualTaskPlanning={planDatum:null,planTijd:null,planningBucket:'open'};
    const {rerender}=render(<TaakWerkplanningVelden value={plan} onChange={change}/>);
    expect(screen.getByLabelText('Werktijd (optioneel)')).toBeDisabled();
    fireEvent.click(screen.getByRole('button',{name:'Vandaag'}));
    const next=change.mock.calls[0][0] as ManualTaskPlanning;
    expect(next.planDatum).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect('deadline' in next).toBe(false);
    rerender(<TaakWerkplanningVelden value={next} onChange={change}/>);
    expect(screen.getByLabelText('Werktijd (optioneel)')).not.toBeDisabled();
    fireEvent.change(screen.getByLabelText('Werktijd (optioneel)'),{
      target:{value:'14:30'},
    });
    expect(change).toHaveBeenLastCalledWith({...next,planTijd:'14:30'});
  });

  it('maakt werktijd leeg als de werkdatum wordt gewist',()=>{
    const change=vi.fn();
    render(<TaakWerkplanningVelden
      value={{planDatum:'2026-11-25',planTijd:'10:45',planningBucket:'open'}}
      onChange={change}/>);
    fireEvent.change(screen.getByLabelText('Werkdatum'),{target:{value:''}});
    expect(change).toHaveBeenCalledWith({
      planDatum:null,planTijd:null,planningBucket:'open',
    });
  });
});
