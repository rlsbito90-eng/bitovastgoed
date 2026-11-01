// @vitest-environment jsdom
import React from 'react';
import { describe,expect,it,vi } from 'vitest';
import { render,screen } from '@testing-library/react';
import type { Zoekprofiel } from '@/data/mock-data';
import ZoekprofielDetails from './ZoekprofielDetails';

vi.mock('@/hooks/usePropertyTaxonomie',()=>({
  usePropertyTaxonomie:()=>({
    labelType:(id:string)=>id==='type-wonen'?'Wonen':'',
    labelSubtype:(id:string)=>id==='type-appartement'?'Appartement':'',
    labelDealtype:(id:string)=>id==='type-belegging'?'Belegging':'',
  }),
}));

const profiel={
  id:'zp-test',relatieId:'rel-test',naam:'Residentieel Randstad',
  typeVastgoed:['wonen'],subcategorieIds:[],propertyTypeIds:['type-wonen'],
  propertySubtypeIds:['type-appartement'],dealTypeIds:['type-belegging'],
  regio:['Zuid-Holland'],steden:['GEMEENTE:Rotterdam','Utrecht'],
  prijsMin:500000,prijsMax:1500000,
  oppervlakteMin:50,oppervlakteMax:400,bouwjaarMin:1960,bouwjaarMax:2025,
  energielabelMin:'C',verhuurStatus:'verhuurd',
  rendementseis:6.5,waltMin:2,leegstandMaxPct:10,
  ontwikkelPotentie:true,transformatiePotentie:false,
  transactietypeVoorkeur:['losse_aankoop'],exclusiviteitVoorkeur:'alleen_off_market',
  prioriteit:2,aanvullendeCriteria:'Alleen hoogwaardige objecten',
  status:'actief',
} as Zoekprofiel;

describe('Volledig zoekprofiel op relatiepagina',()=>{
 it('toont ook aanvullende en niet-eerder zichtbare criteria',()=>{
  render(<ZoekprofielDetails profiel={profiel}/>);
  expect(screen.getByText('Appartement')).toBeTruthy();
  expect(screen.getByText('Belegging')).toBeTruthy();
  expect(screen.getByText('WALT vanaf')).toBeTruthy();
  expect(screen.getByText('10%')).toBeTruthy();
  expect(screen.getByText('Alleen hoogwaardige objecten')).toBeTruthy();
  expect(screen.getByText('Alleen off-market')).toBeTruthy();
 });
 it('toont onbekende optionele criteria als leeg, zonder aanname',()=>{
  const leeg={...profiel,waltMin:undefined,prijsMin:undefined,rendementseis:undefined};
  render(<ZoekprofielDetails profiel={leeg}/>);
  expect(screen.getByText('WALT vanaf')).toBeTruthy();
  expect(screen.getAllByText('—').length).toBeGreaterThan(0);
 });
});
