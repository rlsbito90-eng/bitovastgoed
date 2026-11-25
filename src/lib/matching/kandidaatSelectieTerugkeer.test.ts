import {describe,it,expect} from 'vitest';
import {herstelKandidaatVolgorde,leesKandidaatTerugkeer,type KandidaatTerugkeer} from './kandidaatSelectieTerugkeer';
const terug:KandidaatTerugkeer={objectId:'o',relatieId:'b',filter:'overig',zoek:'',limiet:16,volgorde:['a','b','c','d'],scrollTop:900,kaartOffset:-50,openDetails:{b:[0]}};
const rows=(...ids:string[])=>ids.map(relatieId=>({relatieId}));
describe('Kandidaatselectie terugkeer',()=>{
  it('behoudt de oorspronkelijke werkvolgorde ondanks hersortering',()=>{
    expect(herstelKandidaatVolgorde(rows('c','a','d','e'),rows('c','a','b','d','e'),terug)).toEqual(rows('a','b','c','d','e'));
  });
  it('zet een inmiddels uitgesloten of gekoppelde relatie niet terug in de lijst',()=>{
    expect(herstelKandidaatVolgorde(rows('c','a','d'),rows('c','a','d'),terug)).toEqual(rows('a','c','d'));
  });
  it('past snapshot uitsluitend toe op het oorspronkelijke object en de relatie',()=>{
    expect(leesKandidaatTerugkeer({kandidaatTerugkeer:terug},'o','b')).toEqual(terug);
    expect(leesKandidaatTerugkeer({kandidaatTerugkeer:terug},'ander','b')).toBeNull();
    expect(leesKandidaatTerugkeer({kandidaatTerugkeer:terug},'o','ander')).toBeNull();
    expect(leesKandidaatTerugkeer(null,'o','b')).toBeNull();
  });
});
