import { describe, it, expect } from 'vitest';
import { mapRechten, heeftRechtenInhoud } from '@/lib/kadaster/rechten';

describe('mapRechten', () => {
  it('mapt rechthebbenden met natuurlijk persoon', () => {
    const view = mapRechten({
      rechthebbenden: [{
        persoon: { volledigeNaam: 'J. de Vries' },
        aandeel: { teller: 1, noemer: 2 },
        rechtsoort: 'Eigendom',
      }, {
        natuurlijkPersoon: { volledigeNaam: 'M. Jansen' },
        aandeel: '1/2',
        aardRecht: 'Eigendom',
      }],
      kadastraleAanduiding: 'WMS00-A-1234',
    });
    expect(view.rechthebbenden).toHaveLength(2);
    expect(view.rechthebbenden[0].naam).toBe('J. de Vries');
    expect(view.rechthebbenden[0].type).toBe('natuurlijk persoon');
    expect(view.rechthebbenden[0].aandeel).toBe('1/2');
    expect(view.rechthebbenden[0].rechtsoort).toBe('Eigendom');
    expect(view.rechthebbenden[1].naam).toBe('M. Jansen');
    expect(view.kadastraleAanduiding).toBe('WMS00-A-1234');
    expect(heeftRechtenInhoud(view)).toBe(true);
  });

  it('mapt rechtspersoon naar bedrijfsnaam', () => {
    const view = mapRechten({
      tenaamstellingen: [{
        rechtspersoon: { statutaireNaam: 'Bito Vastgoed B.V.' },
        aandeel: { teller: 1, noemer: 1 },
        soortRecht: 'Eigendom',
      }],
    });
    expect(view.rechthebbenden[0].bedrijfsnaam).toBe('Bito Vastgoed B.V.');
    expect(view.rechthebbenden[0].type).toBe('rechtspersoon');
    expect(view.rechthebbenden[0].aandeel).toBe('1/1');
  });

  it('crasht niet op onbekende of geneste shapes', () => {
    expect(() => mapRechten(null)).not.toThrow();
    expect(() => mapRechten({})).not.toThrow();
    expect(() => mapRechten({ rechthebbenden: 'nope' })).not.toThrow();
    expect(() => mapRechten({ rechthebbenden: [null, 42, { foo: 'bar' }] })).not.toThrow();
    const leeg = mapRechten({});
    expect(heeftRechtenInhoud(leeg)).toBe(false);
  });
});
