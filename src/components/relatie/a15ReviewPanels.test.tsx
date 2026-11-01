// @vitest-environment jsdom
import React from 'react';
import { describe,it,expect } from 'vitest';
import { fireEvent,render,screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ObjectVastgoed,Relatie,Zoekprofiel } from '@/data/mock-data';
import ClassificatieReviewPanel from './ClassificatieReviewPanel';
import MatchingImpactPanel from './MatchingImpactPanel';

const old={
  id:'old',bedrijfsnaam:'Voorbeeld nog onbekend',type:'belegger',partijprofiel:null,
  propertyTypeIds:['type-wonen'],regio:[],assetClasses:[],budgetMax:650000,
} as Relatie;
const fonds={
  id:'fund',bedrijfsnaam:'Voorbeeld Fonds',type:'belegger',partijprofiel:null,
  investeerderSubtype:'fonds',regio:[],assetClasses:[],
} as Relatie;
const object={
  id:'o1',status:'beschikbaar',type:'wonen',propertyTypeId:'type-wonen',
  vraagprijs:450000,plaats:'Breda',provincie:'Noord-Brabant',
} as ObjectVastgoed;

describe('A15 CRM read-only review UI',()=>{
  it('toont voorgestelde classificaties en onzekerheid, met link naar bronrelatie',()=>{
    render(<MemoryRouter><ClassificatieReviewPanel relaties={[old,fonds]}/></MemoryRouter>);
    expect(screen.getByText(/0 van 2 actieve relaties ingedeeld/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button',{name:'Voorstellen bekijken'}));
    expect(screen.getByText('Voorbeeld Fonds')).toBeTruthy();
    expect(screen.getByText(/Historische investeerderscategorie: Fonds/)).toBeTruthy();
    expect(screen.getByText('Voorbeeld nog onbekend')).toBeTruthy();
    expect(screen.getAllByRole('link',{name:'Relatie beoordelen'})).toHaveLength(2);
    expect(screen.queryByRole('button',{name:'Alles automatisch indelen'})).toBeNull();
  });
  it('toont per weggevallen kandidaat de relatie, het object en de reden zonder gegevens te wijzigen',()=>{
    const r={...old,bedrijfsnaam:'Testpartij zonder profiel'};
    render(<MemoryRouter><MatchingImpactPanel relaties={[r]} objecten={[object]} zoekprofielen={[]}/></MemoryRouter>);
    fireEvent.click(screen.getByRole('button',{name:'Simulatie bekijken'}));
    fireEvent.click(screen.getByRole('button',{name:/Bekijk 1 verschillen per object en relatie/}));
    expect(screen.getByText('Testpartij zonder profiel')).toBeTruthy();
    expect(screen.getByText('Valt weg')).toBeTruthy();
    expect(screen.getByText(/Partijprofiel ontbreekt/)).toBeTruthy();
    expect(screen.getByRole('link',{name:'Testpartij zonder profiel'}).getAttribute('href'))
      .toBe('/relaties/old');
  });
  it('start de matchingvergelijking alleen na handmatige actie en zonder writes',()=>{
    render(<MatchingImpactPanel relaties={[old]} objecten={[object]} zoekprofielen={[] as Zoekprofiel[]}/>);
    expect(screen.queryByText('Koppelingen die wegvallen')).toBeNull();
    fireEvent.click(screen.getByRole('button',{name:'Simulatie bekijken'}));
    expect(screen.getByText('Koppelingen die wegvallen')).toBeTruthy();
    expect(screen.getByText('Koppelingen die wegvallen').parentElement?.textContent).toContain('1');
    expect(screen.getByText(/Er wordt niets opgeslagen of aan iemand verstuurd/)).toBeTruthy();
  });
});
