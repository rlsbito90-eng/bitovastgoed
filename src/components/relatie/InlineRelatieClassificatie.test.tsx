// @vitest-environment jsdom
import React from 'react';
import {describe,it,expect,vi} from 'vitest';
import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import type {Relatie} from '@/data/mock-data';
import InlineRelatieClassificatie from './InlineRelatieClassificatie';

const relatie=(override:Partial<Relatie>={}):Relatie=>({
  id:'r1',bedrijfsnaam:'Voorbeeldpartij',contactpersoon:'',
  type:'ontwikkelaar',partijprofiel:null,
  commercialRoles:null,vastgoedStrategieen:null,
  telefoon:'',email:'',regio:[],assetClasses:[],
  ndaGetekend:false,leadStatus:'warm',laatsteContact:'',
  ...override,
} as Relatie);

describe('A15.10 — één inline classificatie, één gerichte opslagpatch',()=>{
  it('legt hoofdprofiel Bemiddelaar en aanvullende ontwikkelaarsactiviteit tegelijk vast',async()=>{
    const save=vi.fn().mockResolvedValue(undefined);
    render(<InlineRelatieClassificatie relatie={relatie()} onSave={save}/>);
    fireEvent.click(screen.getByRole('button',{name:'Wijzig classificatie'}));
    fireEvent.change(screen.getByRole('combobox',{name:'Partijprofiel'}),{
      target:{value:'bemiddelaar'},
    });
    fireEvent.click(screen.getByRole('checkbox',{name:/Ontwikkelt vastgoed/}));
    fireEvent.click(screen.getByRole('button',{name:'Opslaan'}));
    await waitFor(()=>expect(save).toHaveBeenCalledTimes(1));
    expect(save).toHaveBeenCalledWith({
      partijprofiel:'bemiddelaar',commercialRoles:['ontwikkelaar'],
    });
    for(const f of ['type','investeerderSubtype','zoekprofielen','pipelineKandidaten','budgetMax']){
      expect(save.mock.calls[0][0]).not.toHaveProperty(f);
    }
  });
  it('houdt ontwikkelende belegger en koperrol in één patch',async()=>{
    const save=vi.fn().mockResolvedValue(undefined);
    render(<InlineRelatieClassificatie relatie={relatie()} onSave={save}/>);
    fireEvent.click(screen.getByRole('button',{name:'Wijzig classificatie'}));
    fireEvent.change(screen.getByRole('combobox',{name:'Partijprofiel'}),{
      target:{value:'ontwikkelende_belegger'},
    });
    expect(screen.queryByRole('checkbox',{name:/Ontwikkelt vastgoed/})).toBeNull();
    fireEvent.click(screen.getByRole('checkbox',{name:/Koopt zelf vastgoed/}));
    fireEvent.click(screen.getByRole('button',{name:'Opslaan'}));
    await waitFor(()=>expect(save).toHaveBeenCalledWith({
      partijprofiel:'ontwikkelende_belegger',commercialRoles:['koper'],
    }));
  });
  it('bewaart oude commerciële rollen wanneer alleen hoofdprofiel verandert',async()=>{
    const save=vi.fn().mockResolvedValue(undefined);
    render(<InlineRelatieClassificatie relatie={relatie({
      commercialRoles:['ontwikkelaar'],partijprofiel:null,
    })} onSave={save}/>);
    fireEvent.click(screen.getByRole('button',{name:'Wijzig classificatie'}));
    fireEvent.change(screen.getByRole('combobox',{name:'Partijprofiel'}),{
      target:{value:'bemiddelaar'},
    });
    fireEvent.click(screen.getByRole('button',{name:'Opslaan'}));
    await waitFor(()=>expect(save).toHaveBeenCalledWith({partijprofiel:'bemiddelaar'}));
    expect(save.mock.calls[0][0]).not.toHaveProperty('commercialRoles');
  });
  it('kan meerdere soorten velden in één keer wijzigen zonder nieuwe relatie aan te maken',async()=>{
    const save=vi.fn().mockResolvedValue(undefined);
    render(<InlineRelatieClassificatie relatie={relatie({
      partijprofiel:'belegger',commercialRoles:['koper'],vastgoedStrategieen:['value_add'],
    })} onSave={save}/>);
    fireEvent.click(screen.getByRole('button',{name:'Wijzig classificatie'}));
    fireEvent.change(screen.getByRole('combobox',{name:'Partijprofiel'}),{
      target:{value:'fonds'},
    });
    fireEvent.click(screen.getByRole('checkbox',{name:'Transformatie'}));
    fireEvent.click(screen.getByRole('checkbox',{name:/Adviseert partijen/}));
    fireEvent.click(screen.getByRole('button',{name:'Opslaan'}));
    await waitFor(()=>expect(save).toHaveBeenCalledTimes(1));
    expect(save).toHaveBeenCalledWith({
      partijprofiel:'fonds',vastgoedStrategieen:['value_add','transformatie'],
      commercialRoles:['koper','adviseur'],
    });
  });
  it('schrijft niet zonder wijzigingen of bij annuleren',()=>{
    const save=vi.fn();
    render(<InlineRelatieClassificatie relatie={relatie()} onSave={save}/>);
    fireEvent.click(screen.getByRole('button',{name:'Wijzig classificatie'}));
    fireEvent.click(screen.getByRole('button',{name:'Opslaan'}));
    expect(save).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button',{name:'Wijzig classificatie'}));
    fireEvent.change(screen.getByRole('combobox',{name:'Partijprofiel'}),{
      target:{value:'makelaar'},
    });
    const confirm=vi.spyOn(window,'confirm').mockReturnValue(true);
    fireEvent.click(screen.getByRole('button',{name:'Annuleren'}));
    expect(save).not.toHaveBeenCalled();
    confirm.mockRestore();
  });
  it('weigert stale edit wanneer rollen elders zijn gewijzigd',async()=>{
    const save=vi.fn();
    const r=relatie({partijprofiel:'bemiddelaar'});
    const {rerender}=render(<InlineRelatieClassificatie relatie={r} onSave={save}/>);
    fireEvent.click(screen.getByRole('button',{name:'Wijzig classificatie'}));
    fireEvent.click(screen.getByRole('checkbox',{name:/Ontwikkelt vastgoed/}));
    rerender(<InlineRelatieClassificatie relatie={{...r,commercialRoles:['koper']}} onSave={save}/>);
    fireEvent.click(screen.getByRole('button',{name:'Opslaan'}));
    expect((await screen.findByRole('alert')).textContent).toContain('elders gewijzigd');
    expect(save).not.toHaveBeenCalled();
  });
  it('behoudt invoer wanneer de database-opslag mislukt',async()=>{
    const save=vi.fn().mockRejectedValue(new Error('Opslag niet toegestaan'));
    render(<InlineRelatieClassificatie relatie={relatie()} onSave={save}/>);
    fireEvent.click(screen.getByRole('button',{name:'Wijzig classificatie'}));
    fireEvent.change(screen.getByRole('combobox',{name:'Partijprofiel'}),{
      target:{value:'bemiddelaar'},
    });
    fireEvent.click(screen.getByRole('checkbox',{name:/Ontwikkelt vastgoed/}));
    fireEvent.click(screen.getByRole('button',{name:'Opslaan'}));
    expect((await screen.findByRole('alert')).textContent).toContain('Opslag niet toegestaan');
    expect((screen.getByRole('combobox',{name:'Partijprofiel'}) as HTMLSelectElement).value)
      .toBe('bemiddelaar');
    expect(screen.getByRole('checkbox',{name:/Ontwikkelt vastgoed/}))
      .toHaveProperty('checked',true);
  });
});
