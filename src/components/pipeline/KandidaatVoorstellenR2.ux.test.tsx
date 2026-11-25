// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { CrmObjectInput, CrmRelatieInput } from '@/lib/matching/rolMandaatAdapter';
import { KandidaatVoorstellenR2 } from './KandidaatVoorstellenR2';

const object:CrmObjectInput={
  id:'obj',status:'beschikbaar',type:'wonen',
  propertyTypeId:'woning',vraagprijs:450000,
  plaats:'Breda',provincie:'Noord-Brabant',
};
const koper=(i:number, extra:Partial<CrmRelatieInput>={}):CrmRelatieInput=>({
  id:'koper-'+i,type:'belegger',propertyTypeIds:['woning'],
  regio:['Noord-Brabant'],budgetMax:750000,...extra,
});
const renderList=(relaties:CrmRelatieInput[],extra:Record<string,unknown>={}) => {
  const onConceptGekozen=vi.fn();
  const onBeoordeel=vi.fn().mockResolvedValue(undefined);
  const onHerstel=vi.fn().mockResolvedValue(undefined);
  const view=render(<KandidaatVoorstellenR2
    object={object} relaties={relaties} zoekprofielen={[]} reedsGekoppeld={new Set()}
    relatieNaam={id=>'Relatie '+id}
    onConceptGekozen={onConceptGekozen}
    besluiten={{}} besluitenGeladen={true} beoordelingenFout={null}
    onBeoordeel={onBeoordeel} onHerstel={onHerstel}
    {...extra}
  />);
  return {...view,onConceptGekozen,onBeoordeel};
};

describe('Match-UI: professionele shortlist met controlepunten',()=>{
  it('toont maximaal acht relevante kandidaten, met volgende pagina op aanvraag',()=>{
    renderList(Array.from({length:12},(_,i)=>koper(i)));
    expect(screen.getByRole('heading',{name:'Kopersselectie'})).toBeInTheDocument();
    expect(screen.getAllByTestId('match-kandidaat-kaart')).toHaveLength(8);
    fireEvent.click(screen.getByRole('button',{name:/Toon volgende/}));
    expect(screen.getAllByTestId('match-kandidaat-kaart')).toHaveLength(12);
  });

  it('laat zoeken en filteren zonder horizontaal schuivende knoppen toe',()=>{
    renderList([koper(1),koper(2,{uitsluitingen:'Geen woning boven winkel'})]);
    expect(screen.getByRole('button',{name:/Kansrijk/})).toBeInTheDocument();
    expect(screen.getByRole('button',{name:/Controle nodig/})).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:/Controle nodig/}));
    const cards=screen.getAllByTestId('match-kandidaat-kaart');
    expect(cards).toHaveLength(1);
    expect(within(cards[0]).getAllByText(/Expliciete uitsluitingen/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button',{name:/Relevant/}));
    fireEvent.change(screen.getByPlaceholderText('Zoek koper of zoekprofiel'),{
      target:{value:'koper-1'},
    });
    expect(screen.getAllByTestId('match-kandidaat-kaart')).toHaveLength(1);
  });

  it('maakt expliciet onderscheid tussen selectie en toevoegen aan pipeline',()=>{
    const {onConceptGekozen}=renderList([koper(1)]);
    const select=screen.getByRole('button',{name:'Selecteer kandidaat'});
    fireEvent.click(select);
    expect(onConceptGekozen).toHaveBeenCalledTimes(1);
    const selected=onConceptGekozen.mock.calls[0][0];
    expect(selected.contactRelatieId).toBe('koper-1');
    expect(selected.kanAutomatischVersturen).toBe(false);
    expect(selected.kanAutomatischBodMaken).toBe(false);
    expect(screen.getByText(/geen aanbieding/)).toBeInTheDocument();
  });

  it('toont meteen bewijs en open controle zonder gefingeerde matchpercentages',()=>{
    renderList([koper(1,{aankoopcriteria:'Alleen splitspanden'})]);
    const card=screen.getByTestId('match-kandidaat-kaart');
    expect(within(card).getAllByText('Vastgoedtype komt overeen').length).toBeGreaterThan(0);
    expect(within(card).getAllByText(/Aanvullende aankoopcriteria/).length).toBeGreaterThan(0);
    expect(within(card).queryByText(/100% match/)).not.toBeInTheDocument();
    fireEvent.click(within(card).getByText(/Bekijk alle matchcriteria/));
    expect(within(card).getByText(/Een matchvoorstel is geen bevestigde aankoopbereidheid/))
      .toBeInTheDocument();
  });

  it('onthoudt afwijzingen en biedt ze alleen apart herstelbaar aan',()=>{
    const onHerstel=vi.fn().mockResolvedValue(undefined);
    renderList([koper(1)],{
      besluiten:{'koper-1':{status:'afgewezen',redenCode:'locatie'}},
      onHerstel,
    });
    expect(screen.queryAllByTestId('match-kandidaat-kaart')).toHaveLength(0);
    fireEvent.click(screen.getByRole('button',{name:/Eerder afgewezen/}));
    expect(screen.getByText('Relatie koper-1')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'Herstellen'}));
    expect(onHerstel).toHaveBeenCalledWith('koper-1');
  });
});

describe('Handmatige keuze en terugkeer vanuit kopersprofiel',()=>{
  it('laat een afwijkende kandidaat expliciet selecteren zonder eerst een shortlistbesluit',()=>{
    const {onConceptGekozen}=renderList([koper(1,{propertyTypeIds:['kantoor']})]);
    fireEvent.click(screen.getByRole('button',{name:/Overig/}));
    fireEvent.click(screen.getByRole('button',{name:'Handmatig selecteren'}));
    expect(onConceptGekozen).toHaveBeenCalledTimes(1);
    expect(onConceptGekozen.mock.calls[0][0]).toMatchObject({contactRelatieId:'koper-1',handmatigeAfwijking:true,kanAutomatischVersturen:false});
    expect(screen.getAllByText('Vastgoedtype wijkt af').length).toBeGreaterThan(0);
  });
  it('toont bij terugkeer dezelfde relatie ook als deze buiten de relevante selectie valt',()=>{
    renderList([koper(1),koper(2,{propertyTypeIds:['kantoor']})],{focusRelatieId:'koper-2'});
    const cards=screen.getAllByTestId('match-kandidaat-kaart');
    expect(cards).toHaveLength(1);
    expect(within(cards[0]).getByText('Relatie koper-2')).toBeInTheDocument();
    expect(screen.getByText(/Kopersprofiel opnieuw beoordeeld/)).toBeInTheDocument();
  });
  it('biedt een eigen shortlistfilter zonder afwijzing bij verwijderen',()=>{
    const onHerstel=vi.fn().mockResolvedValue(undefined);
    renderList([koper(1),koper(2,{propertyTypeIds:['kantoor']})],{
      besluiten:{'koper-2':{status:'interessant',redenCode:null}},onHerstel,
    });
    fireEvent.click(screen.getByRole('button',{name:/^Shortlist/}));
    expect(screen.getAllByTestId('match-kandidaat-kaart')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button',{name:'Uit shortlist'}));
    expect(onHerstel).toHaveBeenCalledWith('koper-2');
  });
});

describe('Terugkeer naar de eerdere werkpositie',()=>{
  it('herstelt filter, geladen aantal en volgorde met bijgewerkte criteria',()=>{
    const relaties=Array.from({length:20},(_,i)=>koper(i,{propertyTypeIds:i===10?['woning']:['kantoor']}));
    const volgorde=relaties.map(r=>r.id);
    renderList(relaties,{focusRelatieId:'koper-10',terugkeer:{
      objectId:'obj',relatieId:'koper-10',filter:'overig',zoek:'koper-',limiet:16,
      volgorde,scrollTop:600,kaartOffset:-20,openDetails:{},
    }});
    expect(screen.getByRole('button',{name:/^Overig/})).toHaveAttribute('aria-pressed','true');
    expect(screen.getByPlaceholderText('Zoek koper of zoekprofiel')).toHaveValue('koper-');
    const kaarten=screen.getAllByTestId('match-kandidaat-kaart');
    expect(kaarten).toHaveLength(16);
    expect(kaarten[10]).toHaveAttribute('data-relatie-id','koper-10');
    expect(within(kaarten[10]).getByText(/tijdelijk zichtbaar op je vorige plek/)).toBeInTheDocument();
  });
  it('geeft de actuele lijstpositie door bij openen van een profiel',()=>{
    const onOpenRelatie=vi.fn();
    renderList(Array.from({length:12},(_,i)=>koper(i)),{onOpenRelatie});
    fireEvent.click(screen.getByRole('button',{name:/Toon volgende/}));
    const card=screen.getAllByTestId('match-kandidaat-kaart')[10];
    fireEvent.click(within(card).getByRole('button',{name:/Kopersprofiel/}));
    expect(onOpenRelatie).toHaveBeenCalledWith('koper-10',expect.objectContaining({
      objectId:'obj',relatieId:'koper-10',filter:'relevant',limiet:16,
    }));
  });
});
