// @vitest-environment jsdom
import { describe,expect,it,vi } from 'vitest';
import { fireEvent,render,screen,waitFor } from '@testing-library/react';
import type { ObjectVastgoed } from '@/data/mock-data';
import { deriveVerhuurMetrics } from '@/lib/derivations/verhuur';
import ObjectCommercieelInline from './ObjectCommercieelInline';

vi.mock('./ObjectStatusInline',()=>({
  default:()=> <div>Objectstatus gedeelde bediening</div>,
}));

const obj={
  id:'o-1',titel:'Testobject',status:'beschikbaar',
  vraagprijs:850000,huurinkomsten:66000,prijsindicatie:'In overleg',
} as ObjectVastgoed;

function view(save=vi.fn().mockResolvedValue(undefined),o:ObjectVastgoed=obj){
  return {save,...render(<ObjectCommercieelInline object={o}
    verhuur={deriveVerhuurMetrics(o,[])}
    onSave={save}/>)};
}

describe('Objecten: financiële kerngegevens inline',()=>{
  it('wijzigt alleen de vraagprijs bij verlaten, niet BAR/huurders/andere velden',async()=>{
    const {save}=view();
    fireEvent.click(screen.getByRole('button',{name:'Wijzig Vraagprijs'}));
    const input=screen.getByRole('textbox',{name:'Vraagprijs'});
    fireEvent.change(input,{target:{value:'975.000'}});
    fireEvent.blur(input);
    await waitFor(()=>expect(save).toHaveBeenCalledWith({vraagprijs:975000}));
    expect(save.mock.calls[0][0]).not.toHaveProperty('brutoAanvangsrendement');
    expect(save.mock.calls[0][0]).not.toHaveProperty('huurinkomsten');
  });
  it('kan de jaarhuur als objectindicatie wijzigen, zonder contracten te muteren',async()=>{
    const {save}=view();
    fireEvent.click(screen.getByRole('button',{name:'Wijzig Jaarhuur (objectniveau)'}));
    const input=screen.getByRole('textbox',{name:'Jaarhuur (objectniveau)'});
    fireEvent.change(input,{target:{value:'70.500,50'}});
    fireEvent.keyDown(input,{key:'Enter'});
    await waitFor(()=>expect(save).toHaveBeenCalledWith({huurinkomsten:70500.5}));
    expect(save.mock.calls[0][0]).not.toHaveProperty('huurders');
  });
  it('een leeg bedrag wist een beschermde waarde niet; wissen is aparte bewuste handeling',async()=>{
    const {save}=view();
    fireEvent.click(screen.getByRole('button',{name:'Wijzig Vraagprijs'}));
    const input=screen.getByRole('textbox',{name:'Vraagprijs'});
    fireEvent.change(input,{target:{value:''}});
    fireEvent.blur(input);
    expect(save).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button',{name:'Wis Vraagprijs'}));
    expect(screen.getByText('Vraagprijs wissen?')).toBeTruthy();
    expect(save).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button',{name:'Waarde wissen'}));
    await waitFor(()=>expect(save).toHaveBeenCalledWith({
      vraagprijs:null,__allowClearFields:['vraagprijs'],
    }));
  });
  it('laat prijsindicatie tekstueel en slaat op bij Ctrl+Enter',async()=>{
    const {save}=view();
    fireEvent.click(screen.getByRole('button',{name:'Wijzigen'}));
    const input=screen.getByRole('textbox',{name:'Prijsindicatie'});
    fireEvent.change(input,{target:{value:'Onder € 900.000 bespreekbaar'}});
    fireEvent.keyDown(input,{key:'Enter',ctrlKey:true});
    await waitFor(()=>expect(save).toHaveBeenCalledWith({
      prijsindicatie:'Onder € 900.000 bespreekbaar',
    }));
  });
  it('vermeldt dat huurdersregels leidend zijn en signaleert afwijkingen',()=>{
    const huurders=[
      {jaarhuur:40000},{jaarhuur:40000},
    ];
    render(<ObjectCommercieelInline object={obj}
      verhuur={deriveVerhuurMetrics(obj,huurders)}
      onSave={vi.fn().mockResolvedValue(undefined)}/>);
    expect(screen.getByText(/Jaarhuur volgens huurdersregels:/)).toBeTruthy();
    expect(screen.getByText(/wijkt af van de optelsom/)).toBeTruthy();
  });
});
