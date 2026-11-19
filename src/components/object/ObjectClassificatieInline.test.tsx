// @vitest-environment jsdom
import {describe,it,expect,vi} from 'vitest';
import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import type {ObjectVastgoed} from '@/data/mock-data';
import ObjectClassificatieInline from './ObjectClassificatieInline';

vi.mock('@/hooks/usePropertyTaxonomie',()=>({
  usePropertyTaxonomie:()=>({
    loading:false,
    propertyTypes:[
      {id:'t-woon',slug:'residentieel',name:'Wonen'},
      {id:'t-kantoor',slug:'kantoor',name:'Kantoren'},
    ],
    dealTypes:[{id:'d1',name:'Transformatie'}],
    propertyTypeById:(id:string)=>({
      't-woon':{id:'t-woon',slug:'residentieel',name:'Wonen'},
      't-kantoor':{id:'t-kantoor',slug:'kantoor',name:'Kantoren'},
    } as Record<string,unknown>)[id],
    subtypesForType:(id:string)=>id==='t-woon'?
      [{id:'s1',name:'Eengezinswoning'}]:[{id:'s2',name:'Kantoorpand'}],
  }),
}));
vi.mock('@/components/TaxonomieBadges',()=>({
  ClassificatieRij:({onEdit}:{onEdit?:()=>void})=><div>
    <button type="button" aria-label="Wijzig Vastgoedtypen" onClick={onEdit}
      disabled={!onEdit}>Huidige classificatie</button>
    <button type="button" aria-label="Wijzig Subcategorieën" onClick={onEdit}
      disabled={!onEdit}>Eengezinswoning</button>
  </div>,
}));
const obj={
  id:'obj',type:'wonen',propertyTypeId:'t-woon',
  propertySubtypeIds:['s1'],dealTypeIds:['d1'],subcategorieId:'oud',
} as ObjectVastgoed;
const show=(o=obj,save=vi.fn().mockResolvedValue(undefined))=>{
  const result=render(<ObjectClassificatieInline object={o} onSave={save}/>);
  fireEvent.click(screen.getByRole('button',{name:'Wijzig Vastgoedtypen'}));
  return {save,...result};
};

describe('Classificatie rechtstreeks op Objecten → Overzicht',()=>{
  it('opent bij klik op vastgoedtype of subtype, zonder aparte Wijzigen-knop',()=>{
    const {unmount}=render(<ObjectClassificatieInline object={obj} onSave={vi.fn()}/>);
    expect(screen.queryByRole('button',{name:'Wijzigen'})).toBeNull();
    fireEvent.click(screen.getByRole('button',{name:'Wijzig Subcategorieën'}));
    expect(screen.getByLabelText('Type vastgoed')).toBeTruthy();
    expect(screen.getByRole('button',{name:'Sluiten'})).toBeTruthy();
    unmount();
  });
  it('vraagt bevestiging vóór subcategorieën verdwijnen door hoofdtypewijziging',async()=>{
    const {save}=show();
    fireEvent.change(screen.getByLabelText('Type vastgoed'),{target:{value:'t-kantoor'}});
    expect(save).not.toHaveBeenCalled();
    expect(screen.getByText(/Het object heeft 1 gekoppelde subcategorieën/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button',{name:'Type wijzigen en subcategorieën wissen'}));
    await waitFor(()=>expect(save).toHaveBeenCalledWith({
      propertyTypeId:'t-kantoor',type:'kantoren',propertySubtypeIds:[],subcategorieId:null,
    }));
  });
  it('past alleen geselecteerde subtypen aan zonder type of dealtype te overschrijven',async()=>{
    const {save}=show();
    fireEvent.click(screen.getByRole('checkbox',{name:'Eengezinswoning'}));
    await waitFor(()=>expect(save).toHaveBeenCalledWith({propertySubtypeIds:[]}));
    expect(save.mock.calls[0][0]).not.toHaveProperty('type');
    expect(save.mock.calls[0][0]).not.toHaveProperty('dealTypeIds');
  });
  it('kan dealtypen zelfstandig wijzigen',async()=>{
    const {save}=show({...obj,dealTypeIds:[]});
    fireEvent.click(screen.getByText(/Dealtype \/ propositie/));
    fireEvent.click(screen.getByRole('checkbox',{name:'Transformatie'}));
    await waitFor(()=>expect(save).toHaveBeenCalledWith({dealTypeIds:['d1']}));
  });
});
