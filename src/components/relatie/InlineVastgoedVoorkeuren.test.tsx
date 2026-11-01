// @vitest-environment jsdom
import React from 'react';
import { beforeEach, describe,expect,it,vi } from 'vitest';
import { render,screen,fireEvent,waitFor } from '@testing-library/react';
import type { Relatie } from '@/data/mock-data';
import InlineVastgoedVoorkeuren from './InlineVastgoedVoorkeuren';

const soorten=[
  {id:'wonen',name:'Wonen'},
  {id:'winkels',name:'Winkels'},
];
const subs=[
  {id:'appartement',name:'Appartement',propertyTypeId:'wonen'},
  {id:'retail',name:'Retail',propertyTypeId:'winkels'},
];
vi.mock('@/hooks/usePropertyTaxonomie',()=>({
  usePropertyTaxonomie:()=>({
    propertyTypes:soorten,propertySubtypes:subs,
    dealTypes:[{id:'belegging',name:'Belegging'}],
    propertyTypeById:(id:string)=>soorten.find(x=>x.id===id),
    propertySubtypeById:(id:string)=>subs.find(x=>x.id===id),
    dealTypeById:(id:string)=>id==='belegging'?{id,name:'Belegging'}:undefined,
  }),
}));
vi.mock('@/components/TaxonomieBadges',()=>({
  ClassificatieRij:()=> <div>Overzicht bestaande vastgoedvoorkeuren</div>,
}));
const relatie={
  id:'synthetisch',bedrijfsnaam:'Voorbeeld',type:'belegger',contactpersoon:'',
  email:'',telefoon:'',regio:[],assetClasses:['wonen'],
  propertyTypeIds:['wonen'],propertySubtypeIds:['appartement'],
  dealTypeIds:['belegging'],
  ndaGetekend:false,leadStatus:'warm',laatsteContact:'',
} as Relatie;
beforeEach(()=>vi.restoreAllMocks());

describe('A14 vastgoedtaxonomie rechtstreeks op relatiepagina',()=>{
 it('toont bestaande voorkeuren zonder ze direct te wijzigen',()=>{
  render(<InlineVastgoedVoorkeuren relatie={relatie} onSave={vi.fn()}/>);
  expect(screen.getByText('Overzicht bestaande vastgoedvoorkeuren')).toBeTruthy();
  expect(screen.getByText(/Historische vastgoedklassen: Wonen/)).toBeTruthy();
 });
 it('wijzigt alleen gekozen vastgoed- of dealtype en laat legacy plus budget onaangeroerd',async()=>{
  const onSave=vi.fn().mockResolvedValue(undefined);
  render(<InlineVastgoedVoorkeuren relatie={relatie} onSave={onSave}/>);
  fireEvent.click(screen.getByRole('button',{name:'Wijzig hier'}));
  fireEvent.click(screen.getByRole('checkbox',{name:'Winkels'}));
  fireEvent.click(screen.getByRole('button',{name:'Opslaan'}));
  await waitFor(()=>expect(onSave).toHaveBeenCalledWith({propertyTypeIds:['wonen','winkels']}));
  expect(onSave.mock.calls[0][0]).not.toHaveProperty('assetClasses');
  expect(onSave.mock.calls[0][0]).not.toHaveProperty('propertySubtypeIds');
  expect(onSave.mock.calls[0][0]).not.toHaveProperty('budgetMax');
 });
 it('verwijdert afhankelijke subtypen niet stilzwijgend bij verwijderen hoofdtype',()=>{
  const onSave=vi.fn();
  render(<InlineVastgoedVoorkeuren relatie={relatie} onSave={onSave}/>);
  fireEvent.click(screen.getByRole('button',{name:'Wijzig hier'}));
  fireEvent.click(screen.getByRole('checkbox',{name:'Wonen'}));
  fireEvent.click(screen.getByRole('button',{name:'Opslaan'}));
  expect(screen.getByRole('alert').textContent).toContain('geselecteerde subtypen');
  expect(onSave).not.toHaveBeenCalled();
 });
 it('behoudt onbekende historische taxonomy IDs tijdens edit',()=>{
  const onSave=vi.fn();
  render(<InlineVastgoedVoorkeuren relatie={{...relatie,propertyTypeIds:['historisch']} as Relatie}
    onSave={onSave}/>);
  fireEvent.click(screen.getByRole('button',{name:'Wijzig hier'}));
  expect((screen.getByRole('checkbox',{name:/Historisch type \(historisch\)/}) as HTMLInputElement).checked).toBe(true);
  fireEvent.click(screen.getByRole('button',{name:'Annuleren'}));
  expect(onSave).not.toHaveBeenCalled();
 });
});
