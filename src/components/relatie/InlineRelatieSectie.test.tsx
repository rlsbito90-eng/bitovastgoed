// @vitest-environment jsdom
import React from 'react';
import {describe,it,expect,vi} from 'vitest';
import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import type {Relatie} from '@/data/mock-data';
import InlineRelatieSectie from './InlineRelatieSectie';
import {GEWENSTE_SITUATIES} from '@/lib/relaties/investeringsprofielOpties';

const relatie={
  id:'test-relatie',bedrijfsnaam:'Voorbeeld BV',type:'belegger',
  partijprofiel:'fonds',commercialRoles:['koper'],vastgoedStrategieen:['value_add'],
  contactpersoon:'',telefoon:'0101234567',email:'info@voorbeeld.test',
  regio:['Zuid-Holland'],assetClasses:[],budgetMin:200000,budgetMax:800000,
  rendementseis:6.5,ndaGetekend:true,leadStatus:'warm',laatsteContact:'',
} as Relatie;
const company=[
  {key:'bedrijfsnaam',label:'Bedrijfsnaam'},
  {key:'website',label:'Website',kind:'url'},
] as const;
const finance=[
  {key:'budgetMin',label:'Budget minimum',kind:'number'},
  {key:'budgetMax',label:'Budget maximum',kind:'number'},
] as const;

describe('Direct bewerken Relaties: klik op afzonderlijke veldwaarde',()=>{
  it('toont gevulde velden en biedt lege velden compact op aanvraag',()=>{
    render(<InlineRelatieSectie titel="Bedrijf" relatie={relatie} velden={company} onSave={vi.fn()}/>);
    expect(screen.getByRole('button',{name:'Wijzig Bedrijfsnaam'})).toHaveTextContent('Voorbeeld BV');
    expect(screen.queryByRole('button',{name:'Wijzig Website'})).toBeNull();
    expect(screen.queryByRole('button',{name:'Bedrijf bewerken'})).toBeNull();
    fireEvent.click(screen.getByRole('button',{name:'Toon alle velden (1 leeg)'}));
    expect(screen.getByRole('button',{name:'Wijzig Website'})).toHaveTextContent('Niet opgegeven');
    fireEvent.click(screen.getByRole('button',{name:'Verberg lege velden'}));
    expect(screen.queryByRole('button',{name:'Wijzig Website'})).toBeNull();
  });
  it('laat lege sectie invoer starten zonder 12 lege regels of bewerkformulier',()=>{
    render(<InlineRelatieSectie titel="Bedrijf"
      relatie={{...relatie,bedrijfsnaam:'',website:null} as Relatie}
      velden={company} onSave={vi.fn()}/>);
    expect(screen.getByText(/Nog geen gegevens vastgelegd/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button',{name:'Toon alle velden (2 leeg)'}));
    fireEvent.click(screen.getByRole('button',{name:'Wijzig Website'}));
    expect(screen.getByLabelText('Website')).toBeTruthy();
  });
  it('bewerkt één bedrijfsveld met autosave en raakt budgetten of rollen niet',async()=>{
    const save=vi.fn().mockResolvedValue(undefined);
    render(<InlineRelatieSectie titel="Bedrijf" relatie={relatie} velden={company} onSave={save}/>);
    fireEvent.click(screen.getByRole('button',{name:'Toon alle velden (1 leeg)'}));
    fireEvent.click(screen.getByRole('button',{name:'Wijzig Website'}));
    const input=screen.getByLabelText('Website');
    fireEvent.change(input,{target:{value:'https://voorbeeld.test'}});
    fireEvent.blur(input);
    await waitFor(()=>expect(save).toHaveBeenCalledWith({website:'https://voorbeeld.test'}));
    expect(save.mock.calls[0][0]).not.toHaveProperty('budgetMin');
    expect(save.mock.calls[0][0]).not.toHaveProperty('commercialRoles');
  });
  it('leeg numeriek veld patcht alleen het bedoelde veld',async()=>{
    const save=vi.fn().mockResolvedValue(undefined);
    render(<InlineRelatieSectie titel="Financiering" relatie={relatie} velden={finance} onSave={save}/>);
    fireEvent.click(screen.getByRole('button',{name:'Wijzig Budget minimum'}));
    const input=screen.getByLabelText('Budget minimum');
    fireEvent.change(input,{target:{value:''}});
    fireEvent.keyDown(input,{key:'Enter'});
    await waitFor(()=>expect(save).toHaveBeenCalledWith({budgetMin:undefined}));
    expect(save.mock.calls[0][0]).not.toHaveProperty('budgetMax');
  });
  it('weigert negatieve bedragen en behoudt het veld bij validatiefout',async()=>{
    const save=vi.fn();
    render(<InlineRelatieSectie titel="Financiering" relatie={relatie} velden={finance} onSave={save}/>);
    fireEvent.click(screen.getByRole('button',{name:'Wijzig Budget maximum'}));
    const input=screen.getByLabelText('Budget maximum');
    fireEvent.change(input,{target:{value:'-2'}});
    fireEvent.blur(input);
    expect((await screen.findByRole('alert')).textContent).toContain('Ongeldige waarde');
    expect(save).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Budget maximum')).toBeTruthy();
  });
  it('beschermt niet-opgeslagen wijzigingen als gebruiker annuleren kiest',()=>{
    const save=vi.fn();
    const confirm=vi.spyOn(window,'confirm').mockReturnValue(false);
    render(<InlineRelatieSectie titel="Bedrijf" relatie={relatie} velden={company} onSave={save}/>);
    fireEvent.click(screen.getByRole('button',{name:'Wijzig Bedrijfsnaam'}));
    fireEvent.change(screen.getByLabelText('Bedrijfsnaam'),{target:{value:'Andere naam'}});
    fireEvent.click(screen.getByRole('button',{name:'Annuleren'}));
    expect(confirm).toHaveBeenCalled();
    expect(screen.getByLabelText('Bedrijfsnaam')).toHaveValue('Andere naam');
    expect(save).not.toHaveBeenCalled();
    confirm.mockRestore();
  });
  it('Escape annuleert een tekstveld zonder opslag',()=>{
    const save=vi.fn();
    render(<InlineRelatieSectie titel="Bedrijf" relatie={relatie} velden={company} onSave={save}/>);
    fireEvent.click(screen.getByRole('button',{name:'Wijzig Bedrijfsnaam'}));
    fireEvent.change(screen.getByLabelText('Bedrijfsnaam'),{target:{value:'Niet bewaren'}});
    fireEvent.keyDown(screen.getByLabelText('Bedrijfsnaam'),{key:'Escape'});
    expect(screen.getByRole('button',{name:'Wijzig Bedrijfsnaam'})).toHaveTextContent('Voorbeeld BV');
    expect(save).not.toHaveBeenCalled();
  });
  it('weigert een stale bewerking van hetzelfde veld',async()=>{
    const save=vi.fn();
    const {rerender}=render(<InlineRelatieSectie titel="Bedrijf" relatie={relatie} velden={company} onSave={save}/>);
    fireEvent.click(screen.getByRole('button',{name:'Wijzig Bedrijfsnaam'}));
    fireEvent.change(screen.getByLabelText('Bedrijfsnaam'),{target:{value:'Mijn verandering'}});
    rerender(<InlineRelatieSectie titel="Bedrijf"
      relatie={{...relatie,bedrijfsnaam:'Elders gewijzigd'}} velden={company} onSave={save}/>);
    fireEvent.keyDown(screen.getByLabelText('Bedrijfsnaam'),{key:'Enter'});
    expect((await screen.findByRole('alert')).textContent).toContain('elders gewijzigd');
    expect(save).not.toHaveBeenCalled();
  });
});

const websiteSituaties=[
  {key:'gewensteSituatie',label:'Gewenste situatie',kind:'multi',
    options:GEWENSTE_SITUATIES.map(value=>({value,label:value}))},
  {key:'zoekgebiedToelichting',label:'Zoekgebied (plaatsen, straal en toelichting)',kind:'textarea'},
] as const;

describe('Investeringsprofiel: keuzes en vrije invoer onafhankelijk',()=>{
  it('toont de zeven websitesituaties in de lokale keuzeeditor',()=>{
    render(<InlineRelatieSectie titel="Investeringsprofiel" relatie={relatie}
      velden={websiteSituaties} onSave={vi.fn()}/>);
    fireEvent.click(screen.getByRole('button',{name:'Toon alle velden (2 leeg)'}));
    fireEvent.click(screen.getByRole('button',{name:'Wijzig Gewenste situatie'}));
    expect(screen.getByLabelText('Transformatiepotentie')).toBeTruthy();
    expect(screen.getByLabelText('Herontwikkelingspotentie')).toBeTruthy();
    expect(screen.getByLabelText('Afhankelijk van object')).toBeTruthy();
    expect(GEWENSTE_SITUATIES).toHaveLength(7);
  });
  it('wijzigt uitsluitend de situatie via lokale Opslaan-knop',async()=>{
    const save=vi.fn().mockResolvedValue(undefined);
    render(<InlineRelatieSectie titel="Investeringsprofiel" relatie={relatie}
      velden={websiteSituaties} onSave={save}/>);
    fireEvent.click(screen.getByRole('button',{name:'Toon alle velden (2 leeg)'}));
    fireEvent.click(screen.getByRole('button',{name:'Wijzig Gewenste situatie'}));
    fireEvent.click(screen.getByLabelText('Herontwikkelingspotentie'));
    fireEvent.click(screen.getByRole('button',{name:'Opslaan'}));
    await waitFor(()=>expect(save).toHaveBeenCalledWith({gewensteSituatie:['Herontwikkelingspotentie']}));
  });
  it('slaagt met letterlijke zoekradius zonder gestructureerde radius te muteren',async()=>{
    const save=vi.fn().mockResolvedValue(undefined);
    render(<InlineRelatieSectie titel="Investeringsprofiel" relatie={relatie}
      velden={websiteSituaties} onSave={save}/>);
    fireEvent.click(screen.getByRole('button',{name:'Toon alle velden (2 leeg)'}));
    fireEvent.click(screen.getByRole('button',{name:'Wijzig Zoekgebied (plaatsen, straal en toelichting)'}));
    const input=screen.getByLabelText('Zoekgebied (plaatsen, straal en toelichting)');
    fireEvent.change(input,{target:{value:'35 km vanaf Amersfoort'}});
    fireEvent.keyDown(input,{key:'Enter',ctrlKey:true});
    await waitFor(()=>expect(save).toHaveBeenCalledWith({zoekgebiedToelichting:'35 km vanaf Amersfoort'}));
    expect(save.mock.calls[0][0]).not.toHaveProperty('zoekRadiusWaarde');
  });
});
describe('Geo: gemeentes en plaatsen direct op veld',()=>{
  const geo=[
    {key:'regio',label:'Regio',kind:'multi',options:[{value:'Noord-Brabant',label:'Noord-Brabant'}]},
    {key:'zoekGemeenten',label:'Gemeenten',kind:'gemeenten'},
    {key:'zoekPlaatsen',label:'Plaatsen',kind:'plaatsen'},
  ] as const;
  it('kiest officiële gemeente zonder nieuw zoekprofiel',async()=>{
    const save=vi.fn().mockResolvedValue(undefined);
    render(<InlineRelatieSectie titel="Geo"
      relatie={{...relatie,regio:['Noord-Brabant']}} velden={geo} onSave={save}/>);
    fireEvent.click(screen.getByRole('button',{name:'Toon alle velden (2 leeg)'}));
    fireEvent.click(screen.getByRole('button',{name:'Wijzig Gemeenten'}));
    fireEvent.change(screen.getByRole('textbox',{name:'Gemeente zoeken'}),{target:{value:'Oisterwijk'}});
    fireEvent.click(screen.getByRole('checkbox',{name:'Oisterwijk'}));
    fireEvent.click(screen.getByRole('button',{name:'Opslaan'}));
    await waitFor(()=>expect(save).toHaveBeenCalledWith({zoekGemeenten:['Oisterwijk']}));
  });
  it('slaat meerdere plaatsen als array op',async()=>{
    const save=vi.fn().mockResolvedValue(undefined);
    render(<InlineRelatieSectie titel="Geo" relatie={relatie} velden={geo} onSave={save}/>);
    fireEvent.click(screen.getByRole('button',{name:'Toon alle velden (2 leeg)'}));
    fireEvent.click(screen.getByRole('button',{name:'Wijzig Plaatsen'}));
    const input=screen.getByLabelText('Plaatsen');
    fireEvent.change(input,{target:{value:'Breda, Tilburg'}});
    fireEvent.keyDown(input,{key:'Enter',ctrlKey:true});
    await waitFor(()=>expect(save).toHaveBeenCalledWith({zoekPlaatsen:['Breda','Tilburg']}));
  });
});
describe('Brongegevens: behoud letterlijke rendementstekst',()=>{
  it('wijzigt alleen de letterlijke band, niet rendementseis of budget',async()=>{
    const save=vi.fn().mockResolvedValue(undefined);
    const bron=[{key:'rendementsdoelToelichting',label:'Rendementsdoel volgens formulier',kind:'textarea'}] as const;
    render(<InlineRelatieSectie titel="Websitebudget" relatie={relatie} velden={bron} onSave={save}/>);
    fireEvent.click(screen.getByRole('button',{name:'Toon alle velden (1 leeg)'}));
    fireEvent.click(screen.getByRole('button',{name:'Wijzig Rendementsdoel volgens formulier'}));
    const input=screen.getByLabelText('Rendementsdoel volgens formulier');
    fireEvent.change(input,{target:{value:'4–6%; 6–8%; 8–10%; >10%'}});
    fireEvent.keyDown(input,{key:'Enter',ctrlKey:true});
    await waitFor(()=>expect(save).toHaveBeenCalledWith({
      rendementsdoelToelichting:'4–6%; 6–8%; 8–10%; >10%',
    }));
    expect(save.mock.calls[0][0]).not.toHaveProperty('rendementseis');
    expect(save.mock.calls[0][0]).not.toHaveProperty('budgetMin');
  });
});
