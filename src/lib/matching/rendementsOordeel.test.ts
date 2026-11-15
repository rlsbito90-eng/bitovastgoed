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
  it('een 20% ontwikkelgemiddelde wordt niet stilzwijgend als projectminimum gebruikt',()=>{
    const r=beoordeelObjectRendement(object,[{...basis,strategie:'ontwikkeling'} as Rendementscriterium]);
    expect(r.hardKnockout).toBe(false);
  });
});
