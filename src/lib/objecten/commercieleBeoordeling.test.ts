import { describe,expect,it } from 'vitest';
import type { ObjectVastgoed } from '@/data/mock-data';
import {
  bepaalCommercieelAdvies,prijsverschilMetIndicatie,valideerCommercieleBeoordeling,
  type ObjectCommercieleBeoordeling,
} from './commercieleBeoordeling';

const o=(x:Partial<ObjectVastgoed>={})=>({
  vraagprijs:1000000,prijsindicatie:undefined,
  marktwaardeIndicatie:950000,marktwaardeBron:'Interne referentieanalyse',
  verkoopmotivatie:'Kapitaal vrijmaken',...x,
});
const b=(x:Partial<ObjectCommercieleBeoordeling>={})=>({
  prijsOordeel:'realistisch' as const,
  verkoopBereidheid:'bevestigd' as const,
  verkoopTermijn:'binnen_3m' as const,
  prijsFlexibiliteit:'bespreekbaar' as const,
  beslisserStatus:'bevoegd' as const,
  eerderAangeboden:'nee' as const,
  informatieStatus:'voldoende' as const,
  ...x,
});
describe('Commerciële objectbeoordeling',()=>{
  it('gebruikt bestaande objectprijs en marktwaarde, geen tweede waardering',()=>{
    expect(prijsverschilMetIndicatie(1200000,1000000)).toBeCloseTo(20);
    expect(prijsverschilMetIndicatie(800000,1000000)).toBeCloseTo(-20);
    expect(prijsverschilMetIndicatie(undefined,1000000)).toBeUndefined();
    expect(prijsverschilMetIndicatie(1000000,0)).toBeUndefined();
  });
  it('bestaand object zonder intake start met verkennen, niet automatisch ongeschikt',()=>{
    const x=bepaalCommercieelAdvies(o({
      marktwaardeIndicatie:undefined,verkoopmotivatie:undefined,
    }),null);
    expect(x.voorgesteld).toBe('verkennen');
    expect(x.informatieOntbreekt).toContain('Eigen waarde-inschatting met bron ontbreekt');
    expect(x.informatieOntbreekt).toContain('Verkoopmotivatie niet vastgelegd');
  });
  it('marktconform, bereid, bevoegde beslisser en genoeg documentatie geeft actief',()=>{
    const x=bepaalCommercieelAdvies(o(),b());
    expect(x.voorgesteld).toBe('actief');
    expect(x.handmatig).toBe(false);
  });
  it('ambitieuze prijs en twijfelende verkoper leidt eerst tot herbeoordelen',()=>{
    expect(bepaalCommercieelAdvies(o(),b({
      prijsOordeel:'ambitieus',verkoopBereidheid:'verkennend',
    })).voorgesteld).toBe('herbeoordelen');
  });
  it('ambitieuze prijs met bereidwillige verkoper is hooguit gerichte markttoets',()=>{
    const x=bepaalCommercieelAdvies(o(),b({
      prijsOordeel:'ambitieus',verkoopBereidheid:'bereid',
    }));
    expect(x.voorgesteld).toBe('markttoets');
    expect(x.redenen.join(' ')).toMatch(/ambitieus/i);
  });
  it('een automatisch actief-advies vereist bron en verkoopmotief',()=>{
    expect(bepaalCommercieelAdvies(o({marktwaardeBron:undefined}),b()).voorgesteld)
      .toBe('markttoets');
    expect(bepaalCommercieelAdvies(o({verkoopmotivatie:undefined}),b()).voorgesteld)
      .toBe('markttoets');
  });
  it('handmatige keuze is toegestaan, maar verandert advies niet',()=>{
    const x=bepaalCommercieelAdvies(o(),b({
      prijsOordeel:'herzien',besluit:'markttoets',
      besluitToelichting:'Alleen aan één koper toetsen, geen brede verspreiding.',
    }));
    expect(x.voorgesteld).toBe('herbeoordelen');
    expect(x.gekozen).toBe('markttoets');
    expect(x.handmatig).toBe(true);
  });
  it('geen dossierstukken of bevoegdheid betekent geen automatisch actief aanbieden',()=>{
    expect(bepaalCommercieelAdvies(o(),b({informatieStatus:'basis'})).voorgesteld)
      .toBe('markttoets');
    expect(bepaalCommercieelAdvies(o(),b({beslisserStatus:'tussenpersoon'})).voorgesteld)
      .toBe('markttoets');
  });
  it('formulierrestricties vragen om onderbouwing bij handmatige status of eerder aanbod',()=>{
    expect(valideerCommercieleBeoordeling(b({besluit:'actief'})))
      .toMatch(/handmatige afwijking/);
    expect(valideerCommercieleBeoordeling(b({
      eerderAangeboden:'ja',eerderAangebodenToelichting:'',
    }))).toMatch(/waar en wanneer/);
    expect(valideerCommercieleBeoordeling(b({
      besluit:'markttoets',besluitToelichting:'Gericht toetsen',
      eerderAangeboden:'ja',eerderAangebodenToelichting:'Aan twee partijen in oktober.',
    }))).toBeNull();
  });
});
