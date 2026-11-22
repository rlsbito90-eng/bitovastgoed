// @vitest-environment jsdom
import {describe,it,expect,vi} from 'vitest';
import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type {ObjectVastgoed} from '@/data/mock-data';
import ObjectKerngegevensInline from './ObjectKerngegevensInline';

vi.mock('./RelatieKoppelveld',()=>({
  default:({onChange,label}:{onChange:(id:string|null)=>void;label:string})=>
    <button type="button" onClick={()=>onChange('nieuwe-relatie')}>{label}</button>,
}));
const object={id:'obj',titel:'Testobject',eigenaarRelatieId:'bestaand',
  verkoopmotivatie:'Eerder motief',status:'beschikbaar'} as ObjectVastgoed;

describe('Inline objectgegevens',()=>{
  it('bewaart een eigenaar als relatie-ID, zonder legacy verkopersnaam te overschrijven',async()=>{
    const save=vi.fn().mockResolvedValue(undefined);
    render(<MemoryRouter><ObjectKerngegevensInline object={object} onSave={save}/></MemoryRouter>);
    fireEvent.click(screen.getByRole('button',{name:'Eigenaar (bestaande koppeling)'}));
    await waitFor(()=>expect(save).toHaveBeenCalledWith({eigenaarRelatieId:'nieuwe-relatie'}));
    expect(save.mock.calls[0][0]).not.toHaveProperty('verkoperNaam');
  });
  it('bewaart verkoper en aanbieder apart zonder bestaande eigenaar-koppeling te wijzigen',async()=>{
    const save=vi.fn().mockResolvedValue(undefined);
    render(<MemoryRouter><ObjectKerngegevensInline object={object} onSave={save}/></MemoryRouter>);
    fireEvent.click(screen.getByRole('button',{name:'Verkoper / verkoopbevoegde partij'}));
    await waitFor(()=>expect(save).toHaveBeenCalledWith({verkoperRelatieId:'nieuwe-relatie'}));
    fireEvent.click(screen.getByRole('button',{name:'Aanbiedende makelaar / tussenpersoon'}));
    await waitFor(()=>expect(save).toHaveBeenCalledWith({aanbiederRelatieId:'nieuwe-relatie'}));
    expect(save.mock.calls.every(([patch])=>!('eigenaarRelatieId' in patch))).toBe(true);
  });
  it('laat verkoopmotivatie direct in het overzicht bewerken en slaat op bij verlaten',async()=>{
    const save=vi.fn().mockResolvedValue(undefined);
    render(<MemoryRouter><ObjectKerngegevensInline object={object} onSave={save}/></MemoryRouter>);
    fireEvent.click(screen.getByRole('button',{name:'Wijzig Verkoopmotivatie'}));
    const veld=screen.getByRole('textbox',{name:'Verkoopmotivatie'});
    fireEvent.change(veld,{target:{value:'Verkoper wil vóór einde jaar leveren'}});
    fireEvent.blur(veld);
    await waitFor(()=>expect(save).toHaveBeenCalledWith({
      verkoopmotivatie:'Verkoper wil vóór einde jaar leveren',
    }));
  });
  it('annuleert het inline bewerken met Escape',()=>{
    const save=vi.fn().mockResolvedValue(undefined);
    render(<MemoryRouter><ObjectKerngegevensInline object={object} onSave={save}/></MemoryRouter>);
    fireEvent.click(screen.getByRole('button',{name:'Wijzig Verkoopmotivatie'}));
    fireEvent.change(screen.getByRole('textbox',{name:'Verkoopmotivatie'}),
      {target:{value:'Niet bewaren'}});
    fireEvent.keyDown(screen.getByRole('textbox',{name:'Verkoopmotivatie'}),
      {key:'Escape'});
    expect(save).not.toHaveBeenCalled();
    expect(screen.getByText('Eerder motief')).toBeTruthy();
  });
});
