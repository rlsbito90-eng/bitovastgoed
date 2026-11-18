// @vitest-environment jsdom
import {describe,it,expect,vi} from 'vitest';
import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import type {ObjectVastgoed} from '@/data/mock-data';
import ObjectOnderhoudInline from './ObjectOnderhoudInline';

const object={
  id:'obj',onderhoudsstaat:'MJOP niet beschikbaar',
  technischeStaatOmschrijving:'Oorspronkelijk rapport',
  onderhoudsstaatNiveau:undefined,
} as ObjectVastgoed;

describe('Onderhoud direct aanpassen op tab Pand',()=>{
  it('laat bestaande vrije onderhoudsomschrijving ongemoeid tot expliciete keuze',async()=>{
    const save=vi.fn().mockResolvedValue(undefined);
    render(<ObjectOnderhoudInline object={object} onSave={save}/>);
    expect(screen.getByText(/Eerder vastgelegd: MJOP niet beschikbaar/)).toBeTruthy();
    expect(save).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Onderhoudsstaat'),{target:{value:'redelijk'}});
    await waitFor(()=>expect(save).toHaveBeenCalledWith({onderhoudsstaatNiveau:'redelijk'}));
    expect(save.mock.calls[0][0]).not.toHaveProperty('onderhoudsstaat');
  });
  it('kan technische toelichting autosaven met Ctrl+Enter',async()=>{
    const save=vi.fn().mockResolvedValue(undefined);
    render(<ObjectOnderhoudInline object={object} onSave={save}/>);
    fireEvent.click(screen.getByRole('button',{name:'Wijzig Technische staat / MJOP'}));
    const input=screen.getByRole('textbox',{name:'Technische staat / MJOP'});
    fireEvent.change(input,{target:{value:'Nieuwe inspectie benodigd'}});
    fireEvent.keyDown(input,{key:'Enter',ctrlKey:true});
    await waitFor(()=>expect(save).toHaveBeenCalledWith({
      technischeStaatOmschrijving:'Nieuwe inspectie benodigd',
    }));
  });
  it('Escape annuleert zonder wijziging',()=>{
    const save=vi.fn();
    render(<ObjectOnderhoudInline object={object} onSave={save}/>);
    fireEvent.click(screen.getByRole('button',{name:'Wijzig Technische staat / MJOP'}));
    const input=screen.getByRole('textbox',{name:'Technische staat / MJOP'});
    fireEvent.change(input,{target:{value:'Niet bewaren'}});
    fireEvent.keyDown(input,{key:'Escape'});
    expect(save).not.toHaveBeenCalled();
  });
});