// @vitest-environment jsdom
import {describe,it,expect,vi} from 'vitest';
import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import type {ObjectVastgoed} from '@/data/mock-data';
import ObjectFysiekInline from './ObjectFysiekInline';

const obj={
  id:'o-1',oppervlakteVvo:522.7,oppervlakteBvo:700,
  eigendomssituatie:'Bestaande afwijkende eigendomstekst',
  erfpachtinformatie:'Oud erfpachtcommentaar',
} as ObjectVastgoed;

function show(o=obj,save=vi.fn().mockResolvedValue(undefined)){
  return {save,...render(<ObjectFysiekInline object={o} onSave={save}/>)};
}

describe('Objectkaart: fysieke objectgegevens inline aanpassen',()=>{
  it('bewerkt VVO in m² met Nederlandse scheiding zonder andere m² te wijzigen',async()=>{
    const {save}=show();
    fireEvent.click(screen.getByRole('button',{name:'Wijzig VVO (m²)'}));
    const veld=screen.getByRole('textbox',{name:'VVO (m²)'});
    fireEvent.change(veld,{target:{value:'525,25'}});
    fireEvent.blur(veld);
    await waitFor(()=>expect(save).toHaveBeenCalledWith({oppervlakteVvo:525.25}));
    expect(save.mock.calls[0][0]).not.toHaveProperty('oppervlakteBvo');
  });
  it('wist niet stilzwijgend een beschermd oppervlak als invoer leeg is',async()=>{
    const {save}=show();
    fireEvent.click(screen.getByRole('button',{name:'Wijzig VVO (m²)'}));
    const veld=screen.getByRole('textbox',{name:'VVO (m²)'});
    fireEvent.change(veld,{target:{value:''}});
    fireEvent.blur(veld);
    expect(save).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button',{name:'Wis VVO (m²)'}));
    expect(save).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button',{name:'Waarde wissen'}));
    await waitFor(()=>expect(save).toHaveBeenCalledWith({
      oppervlakteVvo:null,__allowClearFields:['oppervlakteVvo'],
    }));
  });
  it('behoudt oude juridische omschrijving tot expliciete keuze',async()=>{
    const {save}=show();
    expect(screen.getByText(/Bestaande omschrijving:/)).toBeTruthy();
    expect(save).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Eigendomssituatie'),{target:{value:'Erfpacht'}});
    await waitFor(()=>expect(save).toHaveBeenCalledWith({eigendomssituatie:'Erfpacht'}));
  });
  it('ondersteunt eigen omschrijving zonder gedwongen keuzewaarde',async()=>{
    const {save}=show();
    fireEvent.change(screen.getByLabelText('Eigendomssituatie'),{target:{value:'__anders__'}});
    const input=screen.getByRole('textbox',{name:'Andere eigendomssituatie'});
    fireEvent.change(input,{target:{value:'Erfpacht en opstalrecht in combinatie'}});
    fireEvent.blur(input);
    await waitFor(()=>expect(save).toHaveBeenCalledWith({
      eigendomssituatie:'Erfpacht en opstalrecht in combinatie',
    }));
  });
  it('kan erfpachttoelichting met Ctrl+Enter zonder groot objectformulier opslaan',async()=>{
    const {save}=show();
    fireEvent.click(screen.getByRole('button',{name:'Wijzigen'}));
    const input=screen.getByRole('textbox',{name:'Erfpacht- / eigendomstoelichting'});
    fireEvent.change(input,{target:{value:'Canon loopt tot 2050'}});
    fireEvent.keyDown(input,{key:'Enter',ctrlKey:true});
    await waitFor(()=>expect(save).toHaveBeenCalledWith({erfpachtinformatie:'Canon loopt tot 2050'}));
  });
});
