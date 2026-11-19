// @vitest-environment jsdom
import React from 'react';
import {describe,it,expect,vi} from 'vitest';
import {fireEvent,render,screen} from '@testing-library/react';
import ContactpersonenPanel from '@/components/relatie/ContactpersonenPanel';
import HuurdersPanel from '@/components/object/HuurdersPanel';

vi.mock('@/hooks/useDataStore',()=>({
  useDataStore:()=>({
    getContactpersonenVoorRelatie:()=>[{
      id:'cp1',relatieId:'r1',naam:'Test Contact',functie:'Acquisitie',
      email:'acquisitie@example.test',telefoon:'0101234567',
      isPrimair:true,decisionMaker:false,voorkeurTaal:'nl',
    }],
    getHuurdersVoorObject:()=>[{
      id:'h1',objectId:'o1',huurderNaam:'Voorbeeldhuurder BV',branche:'Logistiek',
      oppervlakteM2:500,jaarhuur:60000,indexatieBasis:'CPI',
    }],
    getHuurMetrics:()=>null,
    deleteContactpersoon:vi.fn(),deleteHuurder:vi.fn(),
    updateContactpersoon:vi.fn(),updateHuurder:vi.fn(),
    addContactpersoon:vi.fn(),addHuurder:vi.fn(),refresh:vi.fn(),
  }),
}));

describe('Direct openen van persoon en huurder vanuit de samenvatting',()=>{
  it('opent contactpersoon via naam zonder e-mail-/telefoonlinks te vervangen',()=>{
    render(<ContactpersonenPanel relatieId="r1"/>);
    expect(screen.getByRole('link',{name:'acquisitie@example.test'}))
      .toHaveAttribute('href','mailto:acquisitie@example.test');
    expect(screen.getByRole('link',{name:'0101234567'}))
      .toHaveAttribute('href','tel:0101234567');
    expect(screen.queryByRole('button',{name:'Bewerken'})).toBeNull();
    fireEvent.click(screen.getByRole('button',{name:'Wijzig contactpersoon Test Contact'}));
    expect(screen.getByText('Contactpersoon bewerken')).toBeTruthy();
  });

  it('opent het volledige huurcontractpaneel via de hele huurderssamenvatting',()=>{
    render(<HuurdersPanel objectId="o1"/>);
    expect(screen.queryByRole('button',{name:'Bewerken'})).toBeNull();
    const row=screen.getByRole('button',{name:'Wijzig huurder Voorbeeldhuurder BV'});
    expect(row).toHaveTextContent('Voorbeeldhuurder BV');
    expect(row).toHaveTextContent('60.000');
    fireEvent.click(row);
    expect(screen.getByText('Huurder bewerken')).toBeTruthy();
    expect(screen.getByRole('button',{name:'Verwijderen'})).toBeTruthy();
  });
});
