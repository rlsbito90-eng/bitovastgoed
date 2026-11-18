// @vitest-environment jsdom
import {describe,it,expect,vi,beforeEach} from 'vitest';
import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import type {ObjectVastgoed} from '@/data/mock-data';
import ObjectStatusInline from './ObjectStatusInline';

const mocks=vi.hoisted(()=>({
  updateObject:vi.fn().mockResolvedValue(undefined),
  unarchiveObject:vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/hooks/useDataStore',()=>({
  useDataStore:()=>({
    updateObject:mocks.updateObject,unarchiveObject:mocks.unarchiveObject,
  }),
}));
vi.mock('@/components/ArchiveerDialog',()=>({
  default:({open,requireReasonSelection,onConfirm}:{
    open:boolean;requireReasonSelection:boolean;
    onConfirm:(v:{reason:string;note:string})=>Promise<void>;
  })=>open?<div>
    <p>Archiefreden verplicht: {String(requireReasonSelection)}</p>
    <button type="button" onClick={()=>void onConfirm({
      reason:'sold_external',note:'Externe transactie bevestigd',
    })}>Archiveren met reden</button>
  </div>:null,
}));
const object={id:'o',status:'beschikbaar'} as ObjectVastgoed;
beforeEach(()=>{
  mocks.updateObject.mockClear();
  mocks.unarchiveObject.mockClear();
});

describe('Een beschikbaarheidsstatus in Overzicht en Dealflow',()=>{
  it('wijzigt een gewone status direct zonder archiveren',async()=>{
    render(<ObjectStatusInline object={object}/>);
    fireEvent.change(screen.getByLabelText('Objectstatus'),{target:{value:'on_hold'}});
    await waitFor(()=>expect(mocks.updateObject).toHaveBeenCalledWith('o',{status:'on_hold'}));
    expect(mocks.unarchiveObject).not.toHaveBeenCalled();
  });
  it('schrijft nooit terminale status zonder de bestaande archiefreden',async()=>{
    render(<ObjectStatusInline object={object}/>);
    fireEvent.change(screen.getByLabelText('Objectstatus'),{target:{value:'verkocht'}});
    expect(mocks.updateObject).not.toHaveBeenCalled();
    expect(screen.getByText('Archiefreden verplicht: true')).toBeTruthy();
    fireEvent.click(screen.getByRole('button',{name:'Archiveren met reden'}));
    await waitFor(()=>expect(mocks.updateObject).toHaveBeenCalledWith('o',{
      status:'verkocht',archivedReason:'sold_external',archivedNote:'Externe transactie bevestigd',
    }));
  });
  it('reactiveert een eerder gearchiveerd object wanneer een actieve status gekozen wordt',async()=>{
    render(<ObjectStatusInline object={{...object,isArchived:true,status:'ingetrokken'}}/>);
    fireEvent.change(screen.getByLabelText('Objectstatus'),{target:{value:'beschikbaar'}});
    await waitFor(()=>expect(mocks.unarchiveObject).toHaveBeenCalledWith('o'));
  });
  it('converteert oude processtatussen niet ongemerkt',()=>{
    render(<ObjectStatusInline object={{...object,status:'afgevallen'}}/>);
    expect(screen.getByText(/oudere status, kies een actuele/)).toBeTruthy();
    expect(mocks.updateObject).not.toHaveBeenCalled();
  });
});
