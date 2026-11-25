import { describe,it,expect } from 'vitest';
import { beoordeelObjectRendement } from './rendementsOordeel';
import type { Rendementscriterium } from '@/hooks/useRelatieMatchingData';
import type { ObjectVastgoed } from '@/data/mock-data';

const basis={
  id:'criterium-1',relatieId:'r',zoekprofielId:null,strategie:'belegging' as const,
  methode:'netto_onbekend' as const,percentage:8.5,criteriumType:'minimum' as const,
  methodeBevestigd:false,status:'actief' as const,toelichting:null,bron:null,bronDatum:null,
};
const object={id:'o',brutoAanvangsrendement:9,nettoAanvangsrendement:7} as ObjectVastgoed;
describe('rendementsmatching blijft voorzichtig',()=>{
  it('netto rendement zonder definitie geeft nooit een knock-out',()=>{
    const r=beoordeelObjectRendement(object,[basis]);
    expect(r.status).toBe('controle');
    expect(r.hardKnockout).toBe(false);
  });
  it('een NAR-eis wordt niet automatisch op BAR getoetst',()=>{
    const r=beoordeelObjectRendement({id:'o',brutoAanvangsrendement:12} as ObjectVastgoed,
      [{...basis,methode:'nar',methodeBevestigd:true}]);
    expect(r.status).toBe('controle');
  });
  it('een bevestigde NAR-eis onder het objectrendement geeft een indicatie',()=>{
    const r=beoordeelObjectRendement(object,[{...basis,methode:'nar',methodeBevestigd:true,percentage:6}]);
    expect(r.status).toBe('indicatief_voldoet');
    expect(r.hardKnockout).toBe(false);
  });
  it('een te laag objectrendement leidt zonder betrouwbare onderbouwing niet tot uitsluiting',()=>{
    const r=beoordeelObjectRendement(object,[{...basis,methode:'nar',methodeBevestigd:true}]);
    expect(r.status).toBe('indicatief_lager');
    expect(r.hardKnockout).toBe(false);
  });
  it('gemiddeld ontwikkelrendement is geen voorwaarde voor de shortlist',()=>{
    const r=beoordeelObjectRendement(object,[{
      ...basis,strategie:'ontwikkeling',percentage:20,criteriumType:'gemiddeld',
    } as Rendementscriterium]);
    expect(r.status).toBe('niet_van_toepassing');
    expect(r.hardKnockout).toBe(false);
  });
  it('een bevestigd NAR-doel compenseert geen onbekende BAR-eis',()=>{
    const r=beoordeelObjectRendement(object,[
      {...basis,id:'nar',methode:'nar',methodeBevestigd:true,percentage:6},
      {...basis,id:'bar',methode:'bar',methodeBevestigd:false,percentage:8},
    ]);
    expect(r.status).toBe('controle');
    expect(r.hardKnockout).toBe(false);
  });
  it('verschillende strategische rendementen worden niet met elkaar uitgewisseld',()=>{
    const r=beoordeelObjectRendement(object,[
      {...basis,id:'nar',methode:'nar',methodeBevestigd:true,percentage:6},
      {...basis,id:'dev',strategie:'ontwikkeling',methode:'projectkosten',
        methodeBevestigd:true,percentage:20},
    ]);
    expect(r.status).toBe('controle');
  });
  it('een 20% ontwikkelgemiddelde wordt niet stilzwijgend als projectminimum gebruikt',()=>{
    const r=beoordeelObjectRendement(object,[{...basis,strategie:'ontwikkeling'} as Rendementscriterium]);
    expect(r.hardKnockout).toBe(false);
  });
});

describe('Factor en gecombineerde aankoopcriteria',()=>{
  const factor:Rendementscriterium={...basis,methode:'factor',methodeBevestigd:true,criteriumType:'maximum',percentage:12};
  it('toetst een maximale factor op vraagprijs gedeeld door brutojaarhuur',()=>{
    expect(beoordeelObjectRendement({vraagprijs:1200000,huurinkomsten:100000},[factor]).status).toBe('indicatief_voldoet');
    const r=beoordeelObjectRendement({vraagprijs:1300000,huurinkomsten:100000},[factor]);
    expect(r.status).toBe('indicatief_lager');
    expect(r.uitleg).toContain('13×');
    expect(r.hardKnockout).toBe(false);
  });
  it('berekent geen factor zonder positieve prijs en jaarhuur',()=>{
    expect(beoordeelObjectRendement({vraagprijs:1200000,huurinkomsten:0},[factor]).status).toBe('controle');
    expect(beoordeelObjectRendement({brutoAanvangsrendement:9},[factor]).status).toBe('controle');
  });
  it('behoudt BAR, NAR en factor in hetzelfde specifieke zoekprofiel',()=>{
    const criteria:Rendementscriterium[]=[
      {...factor,id:'factor',zoekprofielId:'z'},
      {...basis,id:'bar',zoekprofielId:'z',methode:'bar',methodeBevestigd:true,percentage:8},
      {...basis,id:'nar',zoekprofielId:'z',methode:'nar',methodeBevestigd:true,percentage:8},
    ];
    const r=beoordeelObjectRendement({vraagprijs:1200000,huurinkomsten:100000,nettoAanvangsrendement:7},criteria,'z');
    expect(r.status).toBe('indicatief_lager');
    expect(r.uitleg).toContain('NAR');
    expect(r.uitleg).toContain('Factor');
    expect(r.uitleg).toContain('BAR');
  });
});
