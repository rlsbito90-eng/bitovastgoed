import {describe,expect,it} from 'vitest';
import { isDemoStaat, migreerOudeDemo, nieuweDemoStaat, standaardOnderdelen } from './sandboxModel';
describe('Een geïsoleerd fictief datastoremodel',()=>{
  it('maakt objecten en beleggers als twee aparte sets, zonder globale gedeelde defaults',()=>{
    const a=nieuweDemoStaat(),b=nieuweDemoStaat();
    a.onderdelen.bedrijfscomplex[0].oppervlakte='10';
    expect(b.onderdelen.bedrijfscomplex[0].oppervlakte).toBe('750');
    expect(standaardOnderdelen('geuzenweg').map(x=>x.oppervlakte)).toEqual(['75','64']);
  });
  it('controleert de browseropslag en weigert verkeerde schema-versies',()=>{
    const x=nieuweDemoStaat();expect(isDemoStaat(x)).toBe(true);
    expect(isDemoStaat({...x,versie:1})).toBe(false);
    expect(isDemoStaat({...x,onderdelen:{}})).toBe(false);
    expect(isDemoStaat({...x,beleggers:[{...x.beleggers[0],percentage:1}]})).toBe(false);
  });
  it('migreert instellingen van de oude browserproef naar de centrale gegevens',()=>{
    const x=migreerOudeDemo({scenario:'gemengd',minimum:'70',sterkte:'hard',
      meetbasis:'vvo',hal:'650',kantoor:'250',wonen:'100'});
    expect(x?.onderdelen.gemengd.find(o=>o.id==='hal')?.oppervlakte).toBe('650');
    expect(x?.beleggers[0].percentage).toBe('70');
  });
});
