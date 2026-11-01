// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Relatie } from '@/data/mock-data';
import InlinePartijprofiel from './InlinePartijprofiel';

const relatie:Relatie={
  id:'synthetisch-1',bedrijfsnaam:'Voorbeeld',contactpersoon:'',
  type:'belegger',partijprofiel:'ontwikkelende_belegger',
  vastgoedStrategieen:['value_add'],commercialRoles:['koper'],
  telefoon:'',email:'',regio:[],assetClasses:[],
  ndaGetekend:false,leadStatus:'warm',laatsteContact:'',
} as Relatie;

describe('Inline editing relatieprofiel — synthetisch',()=>{
 it('toont huidige waarde op relatiepagina en laat direct aanpassen zonder pop-up',async()=>{
   const save=vi.fn().mockResolvedValue(undefined);
   render(<InlinePartijprofiel relatie={relatie} onSave={save}/>);
   expect(screen.getByText('Ontwikkelende belegger')).toBeTruthy();
   expect(screen.getByText('Value-add')).toBeTruthy();
   fireEvent.click(screen.getByRole('button',{name:'Wijzig hier'}));
   fireEvent.change(screen.getByRole('combobox',{name:'Partijprofiel'}),{
     target:{value:'family_office'}
   });
   fireEvent.click(screen.getByRole('checkbox',{name:'Transformatie'}));
   fireEvent.click(screen.getByRole('button',{name:'Opslaan'}));
   await waitFor(()=>expect(save).toHaveBeenCalledTimes(1));
   expect(save).toHaveBeenCalledWith({
     partijprofiel:'family_office',
     vastgoedStrategieen:['value_add','transformatie'],
   });
 });
 it('wijzigt uitsluitend de geselecteerde velden en geen rollen of criteria',async()=>{
   const save=vi.fn().mockResolvedValue(undefined);
   render(<InlinePartijprofiel relatie={relatie} onSave={save}/>);
   fireEvent.click(screen.getByRole('button',{name:'Wijzig hier'}));
   fireEvent.change(screen.getByRole('combobox',{name:'Partijprofiel'}),{
     target:{value:'fonds'}
   });
   fireEvent.click(screen.getByRole('button',{name:'Opslaan'}));
   await waitFor(()=>expect(save).toHaveBeenCalledWith({partijprofiel:'fonds'}));
   expect(save.mock.calls[0][0]).not.toHaveProperty('commercialRoles');
   expect(save.mock.calls[0][0]).not.toHaveProperty('type');
   expect(save.mock.calls[0][0]).not.toHaveProperty('budgetMin');
 });
 it('sluit bij annuleren zonder writes',()=>{
   const save=vi.fn();
   render(<InlinePartijprofiel relatie={relatie} onSave={save}/>);
   fireEvent.click(screen.getByRole('button',{name:'Wijzig hier'}));
   fireEvent.change(screen.getByRole('combobox',{name:'Partijprofiel'}),{
     target:{value:'buitenlandse_belegger'}
   });
   const bevestig=vi.spyOn(window,'confirm').mockReturnValue(true);
   fireEvent.click(screen.getByRole('button',{name:'Annuleren'}));
   expect(bevestig).toHaveBeenCalled();
   bevestig.mockRestore();
   expect(save).not.toHaveBeenCalled();
   expect(screen.getByText('Ontwikkelende belegger')).toBeTruthy();
 });
 it('houdt waarden beschikbaar voor correctie als opslaan faalt',async()=>{
   const save=vi.fn().mockRejectedValue(new Error('Testfout bij opslaan'));
   render(<InlinePartijprofiel relatie={relatie} onSave={save}/>);
   fireEvent.click(screen.getByRole('button',{name:'Wijzig hier'}));
   fireEvent.change(screen.getByRole('combobox',{name:'Partijprofiel'}),{
     target:{value:'buitenlandse_belegger'}
   });
   fireEvent.click(screen.getByRole('button',{name:'Opslaan'}));
   expect(await screen.findByRole('alert')).toHaveProperty('textContent','Testfout bij opslaan');
   expect((screen.getByRole('combobox',{name:'Partijprofiel'}) as HTMLSelectElement).value)
     .toBe('buitenlandse_belegger');
 });
 it('behoudt onopgeslagen wijzigingen wanneer verwijderen niet is bevestigd',()=>{
   const save=vi.fn();
   const bevestig=vi.spyOn(window,'confirm').mockReturnValue(false);
   render(<InlinePartijprofiel relatie={relatie} onSave={save}/>);
   fireEvent.click(screen.getByRole('button',{name:'Wijzig hier'}));
   fireEvent.change(screen.getByRole('combobox',{name:'Partijprofiel'}),{
     target:{value:'fonds'}
   });
   fireEvent.click(screen.getByRole('button',{name:'Annuleren'}));
   expect(bevestig).toHaveBeenCalled();
   expect((screen.getByRole('combobox',{name:'Partijprofiel'}) as HTMLSelectElement).value)
     .toBe('fonds');
   expect(save).not.toHaveBeenCalled();
   bevestig.mockRestore();
 });
 it('blokkeert overschrijven als hetzelfde profiel tussentijds elders is gewijzigd',async()=>{
   const save=vi.fn();
   const {rerender}=render(<InlinePartijprofiel relatie={relatie} onSave={save}/>);
   fireEvent.click(screen.getByRole('button',{name:'Wijzig hier'}));
   fireEvent.change(screen.getByRole('combobox',{name:'Partijprofiel'}),{
     target:{value:'fonds'}
   });
   rerender(<InlinePartijprofiel relatie={{...relatie,partijprofiel:'makelaar'}} onSave={save}/>);
   fireEvent.click(screen.getByRole('button',{name:'Opslaan'}));
   expect((await screen.findByRole('alert')).textContent).toContain('elders gewijzigd');
   expect(save).not.toHaveBeenCalled();
 });

});
