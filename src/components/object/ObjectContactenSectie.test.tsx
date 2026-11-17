// @vitest-environment jsdom
import React from 'react';
import {describe,it,expect,vi} from 'vitest';
import {render,screen} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import type {ObjectVastgoed,Relatie} from '@/data/mock-data';
import ObjectContactenSectie from './ObjectContactenSectie';

vi.mock('@/components/RelatieNaamDisplay',()=>({
  default:({relatie}:{relatie:Relatie})=><span>{relatie.bedrijfsnaam}</span>,
}));
const object={
  id:'obj',titel:'Object',
  eigenaarRelatieId:'rel',verkoperNaam:'Oorspronkelijke verkoper',
  verkoperTelefoon:'0612345678',verkoperEmail:'verkoper@voorbeeld.test',
  verkoopmotivatie:'Overdracht in dit kalenderjaar gewenst',
  contactNaam:'Tussenpersoon',contactEmail:'makelaar@voorbeeld.test',
} as ObjectVastgoed;
const eigenaar={
  id:'rel',bedrijfsnaam:'Gekoppelde Verkoper B.V.',email:'intern@voorbeeld.test',
} as Relatie;
function show(o:ObjectVastgoed=object,rel:Relatie|null=eigenaar) {
  return render(<MemoryRouter><ObjectContactenSectie object={o} gekoppeldeRelatie={rel}/></MemoryRouter>);
}
describe('Objectkaart: één primaire verkoper en bewaarde contacthistorie',()=>{
  it('geeft gekoppelde relatie voorrang en toont motivatie direct',()=>{
    const {container}=show();
    const primary=container.querySelector('[data-testid="object-gekoppelde-relatie"]');
    expect(primary?.textContent).toContain('Gekoppelde Verkoper B.V.');
    expect(primary?.textContent).not.toContain('Oorspronkelijke verkoper');
    expect(primary?.textContent).not.toContain('0612345678');
    expect(screen.getByText('Overdracht in dit kalenderjaar gewenst')).toBeTruthy();
    expect(container.querySelector('details')?.open).toBe(false);
    expect(screen.getByText('Aanvullende contactgegevens')).toBeTruthy();
  });
  it('laat vrije velden inclusief bel- en mail-links volledig intact',()=>{
    const {container}=show();
    expect(container.querySelector('a[href="tel:0612345678"]')).toBeTruthy();
    expect(container.querySelector('a[href="mailto:verkoper@voorbeeld.test"]')).toBeTruthy();
    expect(container.querySelector('a[href="mailto:makelaar@voorbeeld.test"]')).toBeTruthy();
    expect(screen.getByText('Oorspronkelijke verkoper')).toBeTruthy();
    expect(screen.getByText('Tussenpersoon')).toBeTruthy();
  });
  it('toont verkoper uit vrije tekst als er geen relatie is gekoppeld',()=>{
    const {container}=show({...object,eigenaarRelatieId:undefined},null);
    expect(container.querySelector('[data-testid="object-gekoppelde-relatie"]')?.textContent)
      .toContain('Oorspronkelijke verkoper');
    expect(screen.getByText(/nog niet aan Relaties gekoppeld/)).toBeTruthy();
  });
  it('verliest verkoopmotivatie niet als er geen enkele contactnaam is',()=>{
    const {container}=show({id:'alleen-motivatie',
      verkoopmotivatie:'Eigenaar wil snel verkopen'} as ObjectVastgoed,null);
    expect(screen.getByText('Eigenaar wil snel verkopen')).toBeTruthy();
    expect(container.querySelector('details')).toBeNull();
  });
});
