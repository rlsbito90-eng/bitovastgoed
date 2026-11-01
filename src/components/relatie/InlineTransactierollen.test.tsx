// @vitest-environment jsdom
import React from 'react';
import {describe,it,expect,vi} from 'vitest';
import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import type {Relatie} from '@/data/mock-data';
import InlineTransactierollen from './InlineTransactierollen';

const partij=(extra:Partial<Relatie>={}):Relatie=>({
 id:'test',bedrijfsnaam:'Voorbeeld BV',contactpersoon:'',
 type:'ontwikkelaar',partijprofiel:'ontwikkelaar',
 commercialRoles:['ontwikkelaar'],vastgoedStrategieen:null,
 telefoon:'',email:'',regio:[],assetClasses:[],
 ndaGetekend:false,leadStatus:'warm',laatsteContact:'',...extra,
} as Relatie);

describe('A15.4 — inline rollen zonder dubbele partijclassificatie',()=>{
 it('registreert bemiddeling naast ontwikkelaar en bewaart het historische veld',async()=>{
   const save=vi.fn().mockResolvedValue(undefined);
   render(<InlineTransactierollen relatie={partij()} onSave={save}/>);
   expect(screen.getByText('Ontwikkelaar')).toBeTruthy();
   fireEvent.click(screen.getByRole('button',{name:'Wijzig activiteiten'}));
   expect(screen.queryByRole('checkbox',{name:/Ontwikkelaar/})).toBeNull();
   fireEvent.click(screen.getByRole('checkbox',{name:/Bemiddelt voor derden/}));
   fireEvent.click(screen.getByRole('button',{name:'Opslaan'}));
   await waitFor(()=>expect(save).toHaveBeenCalledWith({
      commercialRoles:['ontwikkelaar','bemiddelaar'],
   }));
   expect(save.mock.calls[0][0]).not.toHaveProperty('partijprofiel');
 });
 it('behoudt de koperstatus afzonderlijk bij een ontwikkelende belegger',async()=>{
   const save=vi.fn().mockResolvedValue(undefined);
   render(<InlineTransactierollen relatie={partij({
     partijprofiel:'ontwikkelende_belegger',commercialRoles:null,
   })} onSave={save}/>);
   fireEvent.click(screen.getByRole('button',{name:'Wijzig activiteiten'}));
   fireEvent.click(screen.getByRole('checkbox',{name:/Koopt zelf vastgoed/}));
   fireEvent.click(screen.getByRole('button',{name:'Opslaan'}));
   await waitFor(()=>expect(save).toHaveBeenCalledWith({commercialRoles:['koper']}));
   expect(save.mock.calls[0][0]).not.toHaveProperty('partijprofiel');
   expect(save.mock.calls[0][0]).not.toHaveProperty('type');
 });
 it('schrijft niets wanneer er niet gewijzigd is',async()=>{
   const save=vi.fn();
   render(<InlineTransactierollen relatie={partij()} onSave={save}/>);
   fireEvent.click(screen.getByRole('button',{name:'Wijzig activiteiten'}));
   fireEvent.click(screen.getByRole('button',{name:'Opslaan'}));
   expect(save).not.toHaveBeenCalled();
 });
 it('blokkeert gelijktijdige wijziging en overschrijft oude rollen niet',async()=>{
   const save=vi.fn();
   const base=partij();
   const {rerender}=render(<InlineTransactierollen relatie={base} onSave={save}/>);
   fireEvent.click(screen.getByRole('button',{name:'Wijzig activiteiten'}));
   fireEvent.click(screen.getByRole('checkbox',{name:/Bemiddelt voor derden/}));
   rerender(<InlineTransactierollen relatie={{...base,commercialRoles:['ontwikkelaar','verkoper']}} onSave={save}/>);
   fireEvent.click(screen.getByRole('button',{name:'Opslaan'}));
   expect((await screen.findByRole('alert')).textContent).toContain('elders gewijzigd');
   expect(save).not.toHaveBeenCalled();
 });
});
