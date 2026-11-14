import { describe, expect, it } from 'vitest';
import type { ObjectVastgoed, Zoekprofiel } from '@/data/mock-data';
import { vergelijkBestaandeProfielkenmerken as vergelijk } from './vergelijkBestaandeProfielkenmerken';

const route = { bron: 'zoekprofiel' as const, zoekprofielId: 'zp-1' };
const obj = (overrides: Partial<ObjectVastgoed> = {}): ObjectVastgoed => ({
  isPortefeuille: false, bouwjaar: 1985, energielabelV2: 'B',
  verhuurStatus: 'verhuurd', leegstandPct: 4, ...overrides,
} as ObjectVastgoed);
const profiel = (overrides: Partial<Zoekprofiel> = {}): Zoekprofiel => ({
  id: 'zp-1', bouwjaarMin: 1980, bouwjaarMax: 1990, energielabelMin: 'C',
  verhuurStatus: 'verhuurd', leegstandMaxPct: 5, ...overrides,
} as Zoekprofiel);

describe('Vergelijk bestaande zoekprofielkenmerken zonder extra invoer', () => {
  it('vergelijkt vier bestaande objectvelden zonder R2-score of hardheid', () => {
    const o = obj();
    const result = vergelijk(o,route,[profiel()]);
    expect(result.map(x => x.sleutel)).toEqual(['bouwjaar','energielabel','verhuurStatus','leegstand']);
    expect(result.every(x => x.uitkomst === 'overeenkomst')).toBe(true);
    expect(result[0]).not.toHaveProperty('diskwalificatie');
    expect(o.bouwjaar).toBe(1985);
  });
  it('toont verschillen als aandachtspunt, niet als automatische harde uitsluiting', () => {
    const r=vergelijk(obj({bouwjaar:1970,energielabelV2:'F',verhuurStatus:'leeg',leegstandPct:10}),route,[profiel()]);
    expect(r.every(x=>x.uitkomst==='afwijking')).toBe(true);
    expect(r[0]).not.toHaveProperty('hard');
  });
  it('behandelt onvolledige gegevens als controle nodig, niet als nul', () => {
    const r=vergelijk(obj({bouwjaar:undefined,energielabelV2:'onbekend',energielabel:undefined,
      verhuurStatus:undefined as unknown as ObjectVastgoed['verhuurStatus'],leegstandPct:undefined}),route,[profiel()]);
    expect(r.every(x=>x.uitkomst==='controle_nodig')).toBe(true);
  });
  it('neemt niet automatisch één registratiewaarde als waarheid voor een portefeuille', () => {
    const r=vergelijk(obj({isPortefeuille:true}),route,[profiel()]);
    expect(r).toHaveLength(4);
    expect(r.every(x=>x.uitkomst==='controle_nodig')).toBe(true);
  });
  it('houdt twee profielen gescheiden en kijkt alleen naar de gekozen route', () => {
    const r=vergelijk(obj(),route,[
      profiel({id:'zp-2',bouwjaarMin:2000,energielabelMin:'A'}),
      profiel({id:'zp-1',bouwjaarMin:1980,bouwjaarMax:undefined,energielabelMin:undefined,
        verhuurStatus:undefined,leegstandMaxPct:undefined}),
    ]);
    expect(r.map(x=>x.sleutel)).toEqual(['bouwjaar']);
    expect(vergelijk(obj(),{bron:'relatie_basis',zoekprofielId:null},[profiel()])).toEqual([]);
    expect(vergelijk(obj(),{bron:'zoekprofiel',zoekprofielId:'missing'},[profiel()])).toEqual([]);
  });
  it('herkent A++++ beter dan A en controleert onbekende oude labels', () => {
    expect(vergelijk(obj({energielabelV2:'A++++'}),route,[profiel({bouwjaarMin:undefined,
      bouwjaarMax:undefined,energielabelMin:'A',verhuurStatus:undefined,leegstandMaxPct:undefined})])[0].uitkomst)
      .toBe('overeenkomst');
    expect(vergelijk(obj({energielabelV2:undefined,energielabel:'conceptlabel'}),route,
      [profiel({bouwjaarMin:undefined,bouwjaarMax:undefined,energielabelMin:'B',
        verhuurStatus:undefined,leegstandMaxPct:undefined})])[0].uitkomst).toBe('controle_nodig');
  });
  it('laat oppervlakte, huur-rendement en vrije tekst ongemoeid vanwege meetbasis en betekenis', () => {
    const p=profiel({bouwjaarMin:undefined,bouwjaarMax:undefined,energielabelMin:undefined,
      verhuurStatus:undefined,leegstandMaxPct:undefined,oppervlakteMin:1000,
      rendementseis:7,aanvullendeCriteria:'Minimaal 70% bedrijfsruimte'});
    expect(vergelijk(obj(),route,[p])).toEqual([]);
  });
});
