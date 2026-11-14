import { describe, expect, it } from 'vitest';
import { berekenSamenstellingsProef, parseOppervlakte, type OnderdeelConcept } from './samenstellingsProefModel';

const component = (id: string, functie: string, oppervlakte: string, basis: 'vvo'|'gbo'|'bvo'='vvo'): OnderdeelConcept => ({
  id, omschrijving:id, gebruiksfunctieCode:functie, oppervlakte, meetbasis:basis, adres:'',
});
const bereken=(parts: OnderdeelConcept[],hard: 'hard'|'voorkeur'='hard',volledig=true,overlapvrij=true)=>
  berekenSamenstellingsProef(parts,70,hard,volledig,overlapvrij);

describe('Samenstelling-proef: alle overige functies gezamenlijk',()=>{
  it('accepteert exact 70/30 en 75/25 zonder ruimte te reserveren voor kantoor',()=>{
    expect(bereken([component('hal','bedrijfsruimte','700'),component('kant','kantoor','300')]).uitkomst.status).toBe('voldoet');
    const r=bereken([component('hal','bedrijfsruimte','750'),component('kant','kantoor','100'),component('woning','wonen','150')]);
    expect(r.uitkomst.status).toBe('voldoet');
    expect(r.overigeM2).toBe(250);
    expect(r.overigeAandeel).toBe(25);
  });
  it('65/25/10 voldoet niet aan harde 70%-eis',()=>{
    const r=bereken([component('hal','bedrijfsruimte','650'),component('kant','kantoor','250'),component('woning','wonen','100')]);
    expect(r.uitkomst.status).toBe('wijkt_af');
    expect(r.uitkomst.diskwalificatie).toBe(true);
    expect(r.bedrijfsruimteAandeel).toBe(65);
    expect(r.overigeAandeel).toBe(35);
  });
  it('zachte voorkeur kan afwijken zonder harde afwijzing',()=>{
    expect(bereken([component('hal','bedrijfsruimte','650'),component('kant','kantoor','350')],'voorkeur').uitkomst.diskwalificatie).toBe(false);
  });
  it('geen verhoudingen berekenen als ruimten onbekend of overlappend zijn',()=>{
    const r=bereken([component('hal','bedrijfsruimte','750'),component('kant','kantoor','250')],'hard',false);
    expect(r.uitkomst.status).toBe('controle_nodig');
    expect(r.totaalM2).toBeNull();
    expect(bereken([component('hal','bedrijfsruimte','750')],'hard',true,false).uitkomst.status).toBe('controle_nodig');
  });
  it('weigert GBO en VVO samenvoegen, zoals bij bedrijfspand met woning',()=>{
    const r=bereken([component('hal','bedrijfsruimte','750'),component('woning','wonen','150','gbo')]);
    expect(r.uitkomst.status).toBe('controle_nodig');
    expect(r.overigeAandeel).toBeNull();
  });
  it('maakt ontbrekende of ongeldige oppervlaktes niet nul',()=>{
    for(const input of ['', 'abc', '0', '-15', 'NaN','12,5.3'])expect(parseOppervlakte(input)).toBeNull();
    expect(parseOppervlakte('12,5')).toBe(12.5);
    expect(bereken([component('hal','bedrijfsruimte','750'),component('kant','kantoor','')]).uitkomst.status).toBe('controle_nodig');
  });
  it('kwalificeert uitsluitend vergelijkbare, positieve onderdelen',()=>{
    expect(bereken([component('hal','bedrijfsruimte','750'),component('hal','kantoor','250')]).uitkomst.status).toBe('controle_nodig');
    expect(bereken([component('kant','kantoor','800')]).uitkomst.diskwalificatie).toBe(true);
  });
  it('een volledig in GBO gemeten woonobject voldoet niet automatisch aan een VVO-criterium',()=>{
    const parts=[component('app-a','wonen','75','gbo'),component('app-b','wonen','64','gbo')];
    expect(bereken(parts).uitkomst.status).toBe('controle_nodig');
    const result=berekenSamenstellingsProef(parts,70,'hard',true,true,'gbo');
    expect(result.uitkomst.status).toBe('wijkt_af');
    expect(result.uitkomst.diskwalificatie).toBe(true);
  });

});
