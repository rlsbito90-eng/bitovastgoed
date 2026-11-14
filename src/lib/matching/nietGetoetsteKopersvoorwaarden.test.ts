import { describe, expect, it } from 'vitest';
import { inventariseerNietGetoetsteKopersvoorwaarden as toets } from './nietGetoetsteKopersvoorwaarden';

const basis={bron:'relatie_basis' as const,zoekprofielId:null};
const extra={bron:'zoekprofiel' as const,zoekprofielId:'zp-1'};
describe('Bestaande kopersvoorwaarden automatisch signaleren zonder nieuwe velden',()=>{
  it('leest bestaande algemene uitsluitingen maar leidt nooit hardheid af uit tekst',()=>{
    const r=toets({uitsluitingen:'Minimaal 70% bedrijfsruimte',aankoopcriteria:'Bij voorkeur eerste inzage'},basis,[]);
    expect(r.map(x=>x.sleutel)).toEqual(['uitsluitingen','aankoopcriteria']);
    expect(r[0].toelichting).toBe('Minimaal 70% bedrijfsruimte');
    expect(r[0]).not.toHaveProperty('diskwalificatie');
  });
  it('neemt bestaande gewenste omvang en rendement mee voor algemene route',()=>{
    const r=toets({gewensteObjectomvang:'Vanaf 1.000 m²',rendementseis:7},basis,[]);
    expect(r.map(x=>x.sleutel)).toEqual(['gewensteObjectomvang','rendementseis']);
  });
  it('haalt zonder aanvullende invoer bestaande zelfstandige profielcriteria op',()=>{
    const r=toets({uitsluitingen:'Geen erfpacht'},extra,[{
      id:'zp-1',aanvullendeCriteria:'Minimaal 70% bedrijfsruimte, maximaal 30% overig',
      oppervlakteMin:1000,verhuurStatus:'verhuurd',rendementseis:7,
    }]);
    expect(r.map(x=>x.sleutel)).toEqual([
      'uitsluitingen','aanvullendeCriteria','oppervlakte','verhuurStatus','rendement'
    ]);
    expect(r.find(x=>x.sleutel==='oppervlakte')?.toelichting).toContain('meetbasis nog vaststellen');
    expect(r.find(x=>x.sleutel==='aanvullendeCriteria')?.toelichting).toContain('70%');
  });
  it('verwisselt nooit voorwaarden van twee verschillende zoekprofielen',()=>{
    const r=toets({},extra,[{id:'zp-2',aanvullendeCriteria:'Geen kantoor'},{id:'zp-1',aanvullendeCriteria:'Alleen horeca'}]);
    expect(r).toHaveLength(1);
    expect(r[0].toelichting).toBe('Alleen horeca');
  });
  it('meldt een ontbrekend profiel zonder het als match te markeren',()=>{
    const r=toets({},extra,[]);
    expect(r).toHaveLength(1);
    expect(r[0].sleutel).toBe('ontbrekend');
  });
  it('geen invulling betekent geen extra waarschuwing of taak',()=>{
    expect(toets({},basis,[])).toEqual([]);
    expect(toets({aankoopcriteria:'   ',rendementseis:undefined},basis,[])).toEqual([]);
  });
  it('null of lege waarden worden niet als nul of vaststaande voorwaarden geïnterpreteerd',()=>{
    const r=toets({},extra,[{
      id:'zp-1',oppervlakteMin:undefined,bouwjaarMin:undefined,
      waltMin:undefined,leegstandMaxPct:undefined,ontwikkelPotentie:false,
      transformatiePotentie:false,exclusiviteitVoorkeur:'beide',
    }]);
    expect(r).toEqual([]);
  });
});
