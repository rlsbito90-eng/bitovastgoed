// @vitest-environment jsdom
import React from 'react';
import { describe,it,expect,vi } from 'vitest';
import { render,screen,fireEvent,waitFor } from '@testing-library/react';
import type { Relatie } from '@/data/mock-data';
import InlineRelatieSectie from './InlineRelatieSectie';
import { GEWENSTE_SITUATIES } from '@/lib/relaties/investeringsprofielOpties';

const relatie={
  id:'test-relatie',bedrijfsnaam:'Voorbeeld BV',type:'belegger',
  partijprofiel:'fonds',commercialRoles:['koper'],vastgoedStrategieen:['value_add'],
  contactpersoon:'',telefoon:'0101234567',email:'info@voorbeeld.test',
  regio:['Zuid-Holland'],assetClasses:[],budgetMin:200000,budgetMax:800000,
  rendementseis:6.5,ndaGetekend:true,leadStatus:'warm',laatsteContact:'',
} as Relatie;
const company=[{key:'bedrijfsnaam',label:'Bedrijfsnaam'},{key:'website',label:'Website'}] as const;
const finance=[{key:'budgetMin',label:'Budget minimum',kind:'number'},{key:'budgetMax',label:'Budget maximum',kind:'number'}] as const;

describe('Direct bewerken relatiegegevens — geïsoleerde patch',()=>{
  it('toont ook lege velden in het volledige profiel',()=>{
    render(<InlineRelatieSectie titel="Bedrijf" relatie={relatie} velden={company} onSave={vi.fn()}/>);
    expect(screen.getByText('Bedrijfsnaam')).toBeTruthy();
    expect(screen.getByText('Website')).toBeTruthy();
    expect(screen.getByText('—')).toBeTruthy();
  });
  it('wijzigt alleen bedrijf zonder budgets of rollen opnieuw op te slaan',async()=>{
    const save=vi.fn().mockResolvedValue(undefined);
    render(<InlineRelatieSectie titel="Bedrijf" relatie={relatie} velden={company} onSave={save}/>);
    fireEvent.click(screen.getByRole('button',{name:'Bedrijf bewerken'}));
    fireEvent.change(screen.getByLabelText('Website'),{target:{value:'https://voorbeeld.test'}});
    fireEvent.click(screen.getByRole('button',{name:'Opslaan'}));
    await waitFor(()=>expect(save).toHaveBeenCalledWith({website:'https://voorbeeld.test'}));
    expect(save.mock.calls[0][0]).not.toHaveProperty('budgetMin');
    expect(save.mock.calls[0][0]).not.toHaveProperty('type');
    expect(save.mock.calls[0][0]).not.toHaveProperty('commercialRoles');
  });
  it('leegmaken van een numeriek veld geeft alleen dat veld als expliciet clearing',async()=>{
    const save=vi.fn().mockResolvedValue(undefined);
    render(<InlineRelatieSectie titel="Financiering" relatie={relatie} velden={finance} onSave={save}/>);
    fireEvent.click(screen.getByRole('button',{name:'Financiering bewerken'}));
    fireEvent.change(screen.getByLabelText('Budget minimum'),{target:{value:''}});
    fireEvent.click(screen.getByRole('button',{name:'Opslaan'}));
    await waitFor(()=>expect(save).toHaveBeenCalledTimes(1));
    expect(Object.prototype.hasOwnProperty.call(save.mock.calls[0][0],'budgetMin')).toBe(true);
    expect(save.mock.calls[0][0]).not.toHaveProperty('budgetMax');
  });
  it('weigert negatieve budgetten en behoudt het formulier bij een fout',async()=>{
    const save=vi.fn();
    render(<InlineRelatieSectie titel="Financiering" relatie={relatie} velden={finance} onSave={save}/>);
    fireEvent.click(screen.getByRole('button',{name:'Financiering bewerken'}));
    fireEvent.change(screen.getByLabelText('Budget maximum'),{target:{value:'-2'}});
    fireEvent.click(screen.getByRole('button',{name:'Opslaan'}));
    expect(screen.getByRole('alert').textContent).toContain('Ongeldige waarde');
    expect(save).not.toHaveBeenCalled();
  });
  it('beschermt niet-opgeslagen wijzigingen bij annuleren',()=>{
    const save=vi.fn();
    const confirm=vi.spyOn(window,'confirm').mockReturnValue(false);
    render(<InlineRelatieSectie titel="Bedrijf" relatie={relatie} velden={company} onSave={save}/>);
    fireEvent.click(screen.getByRole('button',{name:'Bedrijf bewerken'}));
    fireEvent.change(screen.getByLabelText('Website'),{target:{value:'https://ander.test'}});
    fireEvent.click(screen.getByRole('button',{name:'Annuleren'}));
    expect(confirm).toHaveBeenCalled();
    expect(screen.getByLabelText('Website')).toBeTruthy();
    expect(save).not.toHaveBeenCalled();
    confirm.mockRestore();
  });
});

const websiteSituaties = [
  {key:'gewensteSituatie',label:'Gewenste situatie',kind:'multi',
   options:GEWENSTE_SITUATIES.map(value=>({value,label:value}))},
  {key:'zoekgebiedToelichting',label:'Zoekgebied (plaatsen, straal en toelichting)',kind:'textarea'},
] as const;

describe('Investeringsprofiel op Relaties — websitesituaties en bronbehoud',()=>{
  it('toont alle zeven websitesituaties, inclusief ontwikkeling en transformatie',()=>{
    render(<InlineRelatieSectie titel="Investeringsprofiel" relatie={relatie}
      velden={websiteSituaties} onSave={vi.fn()}/>);
    fireEvent.click(screen.getByRole('button',{name:'Investeringsprofiel bewerken'}));
    expect(screen.getByLabelText('Transformatiepotentie')).toBeTruthy();
    expect(screen.getByLabelText('Herontwikkelingspotentie')).toBeTruthy();
    expect(screen.getByLabelText('Afhankelijk van object')).toBeTruthy();
    expect(GEWENSTE_SITUATIES).toHaveLength(7);
  });
  it('slaat uitsluitend de gewijzigde objectsituatie op',async()=>{
    const save=vi.fn().mockResolvedValue(undefined);
    render(<InlineRelatieSectie titel="Investeringsprofiel" relatie={relatie}
      velden={websiteSituaties} onSave={save}/>);
    fireEvent.click(screen.getByRole('button',{name:'Investeringsprofiel bewerken'}));
    fireEvent.click(screen.getByLabelText('Herontwikkelingspotentie'));
    fireEvent.click(screen.getByRole('button',{name:'Opslaan'}));
    await waitFor(()=>expect(save).toHaveBeenCalledWith({gewensteSituatie:['Herontwikkelingspotentie']}));
  });
  it('kan de vrije zoekradius opslaan zonder ongewenste overschrijving',async()=>{
    const save=vi.fn().mockResolvedValue(undefined);
    render(<InlineRelatieSectie titel="Investeringsprofiel" relatie={relatie}
      velden={websiteSituaties} onSave={save}/>);
    fireEvent.click(screen.getByRole('button',{name:'Investeringsprofiel bewerken'}));
    fireEvent.change(screen.getByLabelText('Zoekgebied (plaatsen, straal en toelichting)'),{
      target:{value:'35 km vanaf Amersfoort'},
    });
    fireEvent.click(screen.getByRole('button',{name:'Opslaan'}));
    await waitFor(()=>expect(save).toHaveBeenCalledWith({zoekgebiedToelichting:'35 km vanaf Amersfoort'}));
  });
});

describe('Fase 1 — gemeenten en plaatsen direct bij Relaties',()=>{
 const geoVelden=[{key:'regio',label:'Regio',kind:'multi',options:[{value:'Noord-Brabant',label:'Noord-Brabant'}]},
   {key:'zoekGemeenten',label:'Gemeenten',kind:'gemeenten'},
   {key:'zoekPlaatsen',label:'Plaatsen',kind:'plaatsen'}] as const;
 it('kiest een bestaande officiële gemeente zonder nieuw zoekprofiel',async()=>{
   const save=vi.fn().mockResolvedValue(undefined);
   render(<InlineRelatieSectie titel="Geo" relatie={{...relatie,regio:['Noord-Brabant']}} velden={geoVelden} onSave={save}/>);
   fireEvent.click(screen.getByRole('button',{name:'Geo bewerken'}));
   fireEvent.change(screen.getByRole('textbox',{name:'Gemeente zoeken'}),{target:{value:'Oisterwijk'}});
   fireEvent.click(screen.getByRole('checkbox',{name:'Oisterwijk'}));
   fireEvent.click(screen.getByRole('button',{name:'Opslaan'}));
   await waitFor(()=>expect(save).toHaveBeenCalledWith({zoekGemeenten:['Oisterwijk']}));
 });
 it('slaat meerdere plaatsen als aparte selectie op',async()=>{
   const save=vi.fn().mockResolvedValue(undefined);
   render(<InlineRelatieSectie titel="Geo" relatie={relatie} velden={geoVelden} onSave={save}/>);
   fireEvent.click(screen.getByRole('button',{name:'Geo bewerken'}));
   fireEvent.change(screen.getByLabelText('Plaatsen'),{target:{value:'Breda, Tilburg'}});
   fireEvent.click(screen.getByRole('button',{name:'Opslaan'}));
   await waitFor(()=>expect(save).toHaveBeenCalledWith({zoekPlaatsen:['Breda','Tilburg']}));
 });
});


describe('Fase 3C — letterlijke budget- en rendementskeuzes',()=>{
 const bronVelden=[
   {key:'budgetVoorkeurToelichting',label:'Budgetkeuze(n) volgens formulier',kind:'textarea'},
   {key:'rendementsdoelToelichting',label:'Rendementsdoel volgens formulier',kind:'textarea'},
 ] as const;
 it('bewaart een meervoudige rendementsband zonder hard minimum aan te passen',async()=>{
   const save=vi.fn().mockResolvedValue(undefined);
   render(<InlineRelatieSectie titel="Websitebudget" relatie={relatie}
     velden={bronVelden} onSave={save}/>);
   fireEvent.click(screen.getByRole('button',{name:'Websitebudget bewerken'}));
   fireEvent.change(screen.getByLabelText('Rendementsdoel volgens formulier'),{
     target:{value:'4–6%; 6–8%; 8–10%; >10%'},
   });
   fireEvent.click(screen.getByRole('button',{name:'Opslaan'}));
   await waitFor(()=>expect(save).toHaveBeenCalledWith({
     rendementsdoelToelichting:'4–6%; 6–8%; 8–10%; >10%',
   }));
   expect(save.mock.calls[0][0]).not.toHaveProperty('rendementseis');
   expect(save.mock.calls[0][0]).not.toHaveProperty('budgetMin');
 });
});
