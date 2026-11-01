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
  it('toont de bestaande primaire contactpersoon wanneer er geen bedrijfsnaam is',()=>{
    const relatie={...old,bedrijfsnaam:'',type:'ontwikkelaar' as const};
    const contactpersonen=[{
      id:'cp1',relatieId:'old',naam:'Voorbeeld Contact',isPrimair:true,decisionMaker:false,
    }];
    render(<MemoryRouter><ClassificatieReviewPanel relaties={[relatie]}
      contactpersonen={contactpersonen}/></MemoryRouter>);
    fireEvent.click(screen.getByRole('button',{name:'Voorstellen bekijken'}));
    expect(screen.getByText('Voorbeeld Contact')).toBeTruthy();
    expect(screen.getByText(/particulier contact of een onderneming/)).toBeTruthy();
    expect(screen.getByText('Onvoldoende informatie voor een voorstel')).toBeTruthy();
    expect(screen.getByRole('link',{name:'Relatie beoordelen'}).getAttribute('href'))
      .toBe('/relaties/old');
  });
  it('maakt bestaande lopende pipeline zichtbaar bij een matchverschil',()=>{
    const r={...old,bedrijfsnaam:'Testpartij'};
    const pipeline=[{id:'p1',objectId:'o1',relatieId:'old',
      pipelineFase:'teaser_verstuurd',interesseNiveau:'hoog',
      teaserVerstuurd:true,ndaVerstuurd:false,ndaGetekend:false,
      informatieGedeeld:false,feeAkkoord:false}];
    render(<MemoryRouter><MatchingImpactPanel relaties={[r]} objecten={[object]}
      zoekprofielen={[]} pipelineKandidaten={pipeline as any}/></MemoryRouter>);
    fireEvent.click(screen.getByRole('button',{name:'Simulatie bekijken'}));
    expect(screen.getByText(/1 lopende pipelinekoppelingen/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button',{name:/Bekijk 1 verschillen per object en relatie/}));
    expect(screen.getByText('Bestaande lopende pipeline')).toBeTruthy();
  });
  it('A15.5 laat ook bestaande kandidaten buiten gegenereerde matching bekijken',()=>{
    const relatie={...old,type:'eigenaar' as const,
      propertyTypeIds:[],assetClasses:[],budgetMax:undefined,bedrijfsnaam:''};
    const p=[{id:'p1',objectId:'o1',relatieId:'old',pipelineFase:'indicatieve_bieding'}] as any;
    render(<MemoryRouter><MatchingImpactPanel
      relaties={[relatie]} objecten={[object]} zoekprofielen={[]}
      pipelineKandidaten={p}
      contactpersonen={[{id:'c1',relatieId:'old',naam:'Voorbeeld Koper',
        isPrimair:true,decisionMaker:false}]}/></MemoryRouter>);
    fireEvent.click(screen.getByRole('button',{name:'Simulatie bekijken'}));
    expect(screen.getByText(/zonder match in beide modellen/).parentElement?.textContent).toContain('1');
    fireEvent.click(screen.getByRole('button',{name:/Controleer 1 bestaande kandidaatposities/}));
    expect(screen.getByText('Niet gevonden in beide matchberekeningen')).toBeTruthy();
    expect(screen.getByRole('link',{name:'Voorbeeld Koper'}).getAttribute('href'))
      .toBe('/relaties/old');
    expect(screen.getByRole('link',{name:'Object bekijken'}).getAttribute('href'))
      .toBe('/objecten/o1');
  });
  it('A15.5 bewaakt bestaande on-hold bieding in aparte review',()=>{
    const p=[{id:'p1',objectId:'o1',relatieId:'old',pipelineFase:'indicatieve_bieding'}] as any;
    render(<MemoryRouter><MatchingImpactPanel relaties={[old]}
      objecten={[{...object,status:'on_hold'}]} zoekprofielen={[]}
      pipelineKandidaten={p}/></MemoryRouter>);
    fireEvent.click(screen.getByRole('button',{name:'Simulatie bekijken'}));
    fireEvent.click(screen.getByRole('button',{name:/Controleer 1 bestaande kandidaatposities/}));
    expect(screen.getAllByText('Buiten simulatie')).toHaveLength(2);
    expect(screen.getByText(/Bestaande kandidaatkoppeling en proceshistorie blijven onaangetast/)).toBeTruthy();
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
