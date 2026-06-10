import { describe, it, expect } from 'vitest';
import { mapWozObject, heeftWozObjectInhoud } from '@/lib/kadaster/wozObject';

describe('mapWozObject', () => {
  it('mapt bagObjectData en eerste wozObjecten correct', () => {
    const view = mapWozObject({
      actualiteit: 2025,
      doelbinding: 'WOZ',
      titel: 'WOZ-object Prins Willem Alexanderln 30',
      bagObjectData: {
        objectStatus: 'In gebruik',
        bouwjaar: 1975,
        oppervlakteBag: 142,
        omschrijvingVergundeGebruik: 'woonfunctie',
        complexrelatie: 'geen',
        oppervlakteWijziging: 'geen',
      },
      wozObjecten: [
        {
          wozObjectNummer: '061200000123456',
          oppervlakteWoz: 150,
          oppervlakteWozWonen: 142,
          oppervlakteWozNietWonen: 8,
          inhoud: 410,
          bouwlaag: '2',
          gebruiksklasse: 'Wonen',
          monumentaanduiding: 'geen',
          feitelijkGebruik: 'Woning',
        },
      ],
    });
    expect(view.bag.bouwjaar).toBe(1975);
    expect(view.bag.oppervlakteBag).toBe(142);
    expect(view.woz).toHaveLength(1);
    expect(view.woz[0].wozObjectNummer).toBe('061200000123456');
    expect(view.woz[0].inhoud).toBe(410);
    expect(view.algemeen.actualiteit).toBe('2025');
    expect(heeftWozObjectInhoud(view)).toBe(true);
  });

  it('verwerkt meerdere wozObjecten zonder crash', () => {
    const view = mapWozObject({
      wozObjecten: [{ wozObjectNummer: 'A' }, { wozObjectNummer: 'B' }, null],
    });
    expect(view.woz).toHaveLength(3);
    expect(view.woz[0].wozObjectNummer).toBe('A');
    expect(view.woz[2].wozObjectNummer).toBeNull();
  });

  it('crasht niet bij lege/onverwachte data', () => {
    expect(() => mapWozObject(null)).not.toThrow();
    expect(() => mapWozObject({})).not.toThrow();
    expect(() => mapWozObject({ bagObjectData: 'foo', wozObjecten: 'nope' })).not.toThrow();
    const leeg = mapWozObject({});
    expect(heeftWozObjectInhoud(leeg)).toBe(false);
  });
});
