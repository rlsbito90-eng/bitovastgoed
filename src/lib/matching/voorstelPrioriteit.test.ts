import { describe, expect, it } from 'vitest';
import { bepaalVoorstelPrioriteit } from './voorstelPrioriteit';
import { maakKandidaatVoorstellen, type CrmObjectInput, type CrmRelatieInput } from './rolMandaatAdapter';
import type { RendementsOordeel } from './rendementsOordeel';

const o:CrmObjectInput={
  id:'object',status:'beschikbaar',type:'wonen',propertyTypeId:'type-wonen',
  plaats:'Amsterdam',provincie:'Noord-Holland',vraagprijs:500_000,
};
const r=(value:Partial<CrmRelatieInput>={}):CrmRelatieInput=>({
  id:'relatie',type:'belegger',propertyTypeIds:['type-wonen'],
  regio:['Noord-Holland'],budgetMax:1_000_000,...value,
});
const neutraal:RendementsOordeel={
  status:'niet_van_toepassing',uitleg:'Geen criterium',hardKnockout:false,
};
function route(relatie:CrmRelatieInput,object:CrmObjectInput=o){
  const m=maakKandidaatVoorstellen(object,[relatie],[]);
  if(!m[0])throw new Error('Voorstel ontbreekt');
  return m[0].besteRoute;
}

describe('bewijsgerichte prioritering van objectvoorstellen',()=>{
  it('vastgoedtype plus aantoonbare provincie en budget is kansrijk',()=>{
    const v=route(r());
    expect(v.bewijs).toMatchObject({vastgoedtype:true,locatie:true,budget:true});
    expect(bepaalVoorstelPrioriteit(v,neutraal)).toBe('kansrijk');
  });
  it('alleen budget, zonder vastgoedtype en locatie, is geen aanbeveling',()=>{
    const v=route(r({propertyTypeIds:[],regio:[]}));
    expect(v.kwalificatie).toBe('passend');
    expect(v.bewijs).toMatchObject({vastgoedtype:false,locatie:false,budget:true});
    expect(bepaalVoorstelPrioriteit(v,neutraal)).toBe('niet_aanbevolen');
  });
  it('alleen provinciale regio en budget is niet direct kansrijk',()=>{
    const v=route(r({propertyTypeIds:[]}));
    expect(bepaalVoorstelPrioriteit(v,neutraal)).toBe('niet_aanbevolen');
  });
  it('vastgoedtype en niet-verifieerbare Randstad-regio blijft controleren',()=>{
    const v=route(r({regio:['Randstad']}));
    expect(v.kwalificatie).toBe('te_verifieren');
    expect(v.bewijs?.vastgoedtype).toBe(true);
    expect(v.bewijs?.locatie).toBe(false);
    expect(bepaalVoorstelPrioriteit(v,neutraal)).toBe('controleren');
  });
  it('vastgoedtype en regio kloppen, maar netto-definitie is onbekend',()=>{
    const v=route(r());
    const rendement:RendementsOordeel={status:'controle',uitleg:'Netto onbekend',hardKnockout:false};
    expect(bepaalVoorstelPrioriteit(v,rendement)).toBe('controleren');
  });
  it('lager indicatief rendement is niet automatisch een definitieve afwijzing',()=>{
    const v=route(r());
    const rendement:RendementsOordeel={status:'indicatief_lager',uitleg:'Lager dan doel',hardKnockout:false};
    expect(bepaalVoorstelPrioriteit(v,rendement)).toBe('controleren');
  });
  it('passend type met ontbrekende objectlocatie blijft controle',()=>{
    const v=route(r(),{...o,plaats:null,provincie:null});
    expect(bepaalVoorstelPrioriteit(v,neutraal)).toBe('controleren');
  });
  it('een algemene landelijke scope zonder type valt niet in de actieve shortlist',()=>{
    const v=route(r({propertyTypeIds:[],regio:['Heel Nederland']}));
    expect(bepaalVoorstelPrioriteit(v,neutraal)).toBe('niet_aanbevolen');
  });
  it('passend vastgoedtype met uitsluitend landelijk zoekgebied is niet direct kansrijk',()=>{
    const v=route(r({regio:['Heel Nederland']}));
    expect(v.kwalificatie).toBe('passend');
    expect(v.bewijs?.vastgoedtype).toBe(true);
    expect(v.bewijs?.locatie).toBe(false);
    expect(v.toelichting.matcht).toContain('Landelijk zoekgebied: objectlocatie niet uitgesloten');
    expect(bepaalVoorstelPrioriteit(v,neutraal)).toBe('controleren');
  });
  it('een specifiek passende provincie blijft kansrijk naast landelijke scope',()=>{
    const v=route(r({regio:['Heel Nederland','Noord-Holland']}));
    expect(v.bewijs?.locatie).toBe(true);
    expect(bepaalVoorstelPrioriteit(v,neutraal)).toBe('kansrijk');
  });
  it('alleen landelijk zoekgebied en budget levert geen vastgoedaanbeveling',()=>{
    const v=route(r({propertyTypeIds:[],regio:['Nederland']}));
    expect(v.bewijs?.locatie).toBe(false);
    expect(bepaalVoorstelPrioriteit(v,neutraal)).toBe('niet_aanbevolen');
  });
});
