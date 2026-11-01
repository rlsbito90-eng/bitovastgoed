import { describe,expect,it } from 'vitest';
import type { Relatie } from '@/data/mock-data';
import { maakClassificatieReview, suggereerPartijprofiel, tekstProfielSuggestie } from './classificatieReview';
const bron=(x:Partial<Relatie>={})=>({
  id:'r1',type:'belegger',partijprofiel:null,softDeletedAt:undefined,investeerderSubtype:undefined,...x,
}) as Relatie;
describe('A15 — alleen read-only classificatievoorstellen',()=>{
  it('classificeert historische standaard Belegger NIET automatisch',()=>{
    const s=suggereerPartijprofiel(bron());
    expect(s.voorstel).toBeNull();
    expect(s.zekerheid).toBe('onvoldoende');
  });
  it('toont historische expliciete Family office of Fonds als te controleren voorstel',()=>{
    const a=suggereerPartijprofiel(bron({investeerderSubtype:'family_office'}));
    const b=suggereerPartijprofiel(bron({investeerderSubtype:'fonds'}));
    expect(a.voorstel).toBe('family_office');
    expect(b.voorstel).toBe('fonds');
    expect(a.zekerheid).toBe('gericht_nakijken');
    expect(tekstProfielSuggestie(a)).toBe('Family office');
  });
  it('historische ontwikkelaar blijft een controlevoorstel: kan ontwikkelende belegger zijn',()=>{
    const s=suggereerPartijprofiel(bron({type:'ontwikkelaar'}));
    expect(s.voorstel).toBe('ontwikkelaar');
    expect(s.bewijs).toContain('ontwikkelende belegger');
  });
  it('makelaar en eigenaar worden NIET automatisch fijnmazig ondergebracht',()=>{
    for(const type of ['makelaar','eigenaar'] as const)
      expect(suggereerPartijprofiel(bron({type})).voorstel).toBeNull();
  });
  it('actieve geregistreerde profielen blijven intact, gearchiveerde relaties worden uitgesloten',()=>{
    const values=Object.freeze([
      Object.freeze(bron({id:'a',partijprofiel:'buitenlandse_belegger'})),
      Object.freeze(bron({id:'b',softDeletedAt:'2026-10-01'})),
      Object.freeze(bron({id:'c',investeerderSubtype:'fonds'})),
    ]);
    const before=JSON.stringify(values);
    const result=maakClassificatieReview(values);
    expect(result.map(x=>x.relatieId)).toEqual(['a','c']);
    expect(result[0].status).toBe('reeds_ingevuld');
    expect(result[0].huidigeProfiel).toBe('buitenlandse_belegger');
    expect(result[1].status).toBe('voorstel_controleren');
    expect(JSON.stringify(values)).toBe(before);
  });
  it('leidt Buitenlandse belegger niet af uit een ander vestigingsland of buitenlandse naam',()=>{
    const s=suggereerPartijprofiel(bron({vestigingsland:'DE',bedrijfsnaam:'Foreign Capital Ltd'}));
    expect(s.voorstel).toBeNull();
  });
  it('leidt geen ontwikkelende belegger of strategie af uit de oude ontwikkelaarrol',()=>{
    const s=suggereerPartijprofiel(bron({commercialRoles:['ontwikkelaar'],type:'belegger'}));
    expect(s.voorstel).toBeNull();
  });
});
