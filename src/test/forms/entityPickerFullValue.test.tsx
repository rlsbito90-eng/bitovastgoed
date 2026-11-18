// @vitest-environment jsdom
import {describe,it,expect,vi} from 'vitest';
import {render,screen,fireEvent} from '@testing-library/react';
import EntityPicker from '@/components/forms/EntityPicker';
vi.mock('@/hooks/use-mobile',()=>({useIsMobile:()=>false}));

const items=[{id:'r1',primair:'Voorbeeld Vastgoed BV',secundair:'Jan',
  searchHaystack:'voorbeeld vastgoed bv jan'}];

describe('Entiteitskoppelingen zonder zijknop',()=>{
 it('opent de zoekdialoog door op de geselecteerde naam te klikken',()=>{
   render(<EntityPicker value="r1" onChange={vi.fn()} items={items}
     label="Eigenaar" pickerTitle="Kies eigenaar"/>);
   const waarde=screen.getByRole('button',{name:'Wijzig Eigenaar'});
   expect(waarde).toHaveTextContent('Voorbeeld Vastgoed BV');
   fireEvent.click(waarde);
   expect(screen.getByRole('dialog',{name:'Kies eigenaar'})).toBeInTheDocument();
   expect(screen.getByRole('button',{name:'Ontkoppel Eigenaar'})).toBeInTheDocument();
 });
 it('heeft een volledig aanklikbaar leeg veld en ontkoppelt niet automatisch',()=>{
   const onChange=vi.fn();
   render(<EntityPicker value="" onChange={onChange} items={items}
     label="Eigenaar" pickerTitle="Kies eigenaar"/>);
   const leeg=screen.getByRole('button',{name:'Kiezen: Eigenaar'});
   expect(leeg).toHaveTextContent('Geen gekoppelde eigenaar');
   fireEvent.click(leeg);
   expect(screen.getByRole('dialog',{name:'Kies eigenaar'})).toBeInTheDocument();
   expect(onChange).not.toHaveBeenCalled();
 });
});
