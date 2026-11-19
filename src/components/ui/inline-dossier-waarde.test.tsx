// @vitest-environment jsdom
import React from 'react';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import {InlineDossierTekst,InlineDossierKeuze} from './inline-dossier-waarde';

vi.mock('sonner',()=>({toast:{success:vi.fn(),error:vi.fn()}}));
afterEach(()=>vi.restoreAllMocks());

describe('Directe dossierwaarden Taken en Deals',()=>{
  it('slaat één gewijzigde taaktitel op met Enter, zonder extra bewerkformulier',async()=>{
    const onSave=vi.fn().mockResolvedValue(undefined);
    render(<InlineDossierTekst label="Taaktitel" value="Verkoper bellen"
      required onSave={onSave}/>);
    fireEvent.click(screen.getByRole('button',{name:'Wijzig Taaktitel'}));
    const field=screen.getByRole('textbox',{name:'Taaktitel'});
    fireEvent.change(field,{target:{value:'Eigenaar opnieuw bellen'}});
    fireEvent.keyDown(field,{key:'Enter'});
    await waitFor(()=>expect(onSave).toHaveBeenCalledWith('Eigenaar opnieuw bellen'));
    expect(screen.queryByRole('textbox',{name:'Taaktitel'})).toBeNull();
  });

  it('annuleert met Escape zonder wijzigingen',()=>{
    const onSave=vi.fn();
    render(<InlineDossierTekst label="Taaktitel" value="Bestaande tekst"
      required onSave={onSave}/>);
    fireEvent.click(screen.getByRole('button',{name:'Wijzig Taaktitel'}));
    const field=screen.getByRole('textbox',{name:'Taaktitel'});
    fireEvent.change(field,{target:{value:'Niet bewaren'}});
    fireEvent.keyDown(field,{key:'Escape'});
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole('button',{name:'Wijzig Taaktitel'}))
      .toHaveTextContent('Bestaande tekst');
  });

  it('bewaart meervoudige notities alleen bij Ctrl+Enter of verlaten veld',async()=>{
    const onSave=vi.fn().mockResolvedValue(undefined);
    render(<InlineDossierTekst label="Dealnotities" value="Eerste regel" multiline
      onSave={onSave}/>);
    fireEvent.click(screen.getByRole('button',{name:'Wijzig Dealnotities'}));
    const field=screen.getByRole('textbox',{name:'Dealnotities'});
    fireEvent.change(field,{target:{value:'Nieuwe context'}});
    fireEvent.keyDown(field,{key:'Enter'});
    expect(onSave).not.toHaveBeenCalled();
    fireEvent.keyDown(field,{key:'Enter',ctrlKey:true});
    await waitFor(()=>expect(onSave).toHaveBeenCalledWith('Nieuwe context'));
  });

  it('verwijdert bestaande tekst niet stilzwijgend na leegmaken',()=>{
    const onSave=vi.fn();
    render(<InlineDossierTekst label="Dealnotities" value="Bewaren" multiline
      onSave={onSave}/>);
    fireEvent.click(screen.getByRole('button',{name:'Wijzig Dealnotities'}));
    const field=screen.getByRole('textbox',{name:'Dealnotities'});
    fireEvent.change(field,{target:{value:''}});
    fireEvent.keyDown(field,{key:'Enter',ctrlKey:true});
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Gebruik Wissen');
  });

  it('zet prioriteit met één selectie zonder achterliggende status te veranderen',async()=>{
    const onSave=vi.fn().mockResolvedValue(undefined);
    render(<InlineDossierKeuze label="Prioriteit" value="normaal"
      options={[{value:'normaal',label:'Normaal'},{value:'hoog',label:'Hoog'}]}
      onSave={onSave}/>);
    fireEvent.click(screen.getByRole('button',{name:'Wijzig Prioriteit'}));
    fireEvent.change(screen.getByRole('combobox',{name:'Prioriteit'}),
      {target:{value:'hoog'}});
    await waitFor(()=>expect(onSave).toHaveBeenCalledWith('hoog'));
  });
});
