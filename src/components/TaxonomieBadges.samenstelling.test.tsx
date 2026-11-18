// @vitest-environment jsdom
import {describe,it,expect,vi} from 'vitest';
import {render,screen,fireEvent} from '@testing-library/react';
import {ClassificatieRij} from './TaxonomieBadges';

vi.mock('@/hooks/usePropertyTaxonomie',()=>({
  usePropertyTaxonomie:()=>({
    propertyTypeById:(id:string)=>id==='woon'?{id,name:'Wonen'}:undefined,
    propertySubtypeById:(id:string)=>({
      app:{id,name:'Appartementen'},
      eens:{id,name:'Eengezinswoningen'},
      studios:{id,name:'Studios'},
      kamers:{id,name:'Kamers'},
    } as Record<string,unknown>)[id],
    dealTypeById:(id:string)=>id==='verhuur'?{id,name:'Verhuurd vastgoed'}:undefined,
  }),
}));

describe('Zakelijke en rustige taxonomie-samenvatting',()=>{
  it('Object toont leesregels zonder badge-overload',()=>{
    const {container}=render(<ClassificatieRij mode="single" propertyTypeId="woon"
      subtypeIds={['app','eens']} dealTypeIds={['verhuur']}/>);
    expect(screen.getByText('Wonen')).toBeTruthy();
    expect(screen.getByText('Appartementen · Eengezinswoningen')).toBeTruthy();
    expect(screen.getByText('Verhuurd vastgoed')).toBeTruthy();
    expect(container.querySelector('[data-testid="taxonomie-samenvatting"]')).toBeTruthy();
    expect(container.querySelectorAll('.rounded-full')).toHaveLength(0);
  });
  it('Relatie toont meerdere hoofdtypen en behoudt historische IDs zichtbaar',()=>{
    render(<ClassificatieRij mode="multi" propertyTypeIds={['woon','oud-type']}
      subtypeIds={['app','eens','studios','kamers']}/>);
    expect(screen.getByText(/Historisch type \(oud-type\)/)).toBeTruthy();
    fireEvent.click(screen.getByText('+1 meer tonen'));
    expect(screen.getByText('Kamers')).toBeTruthy();
  });
});
