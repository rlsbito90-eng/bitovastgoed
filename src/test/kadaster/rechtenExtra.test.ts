import { describe, it, expect } from 'vitest';
import { mapRechten, heeftRechtenInhoud } from '@/lib/kadaster/rechten';

describe('mapRechten — uitgebreide veldherkenning', () => {
  it('herkent alternatieve naamvelden (naamRechthebbende / gerechtigden)', () => {
    const view = mapRechten({
      gerechtigden: [
        { naamRechthebbende: 'A. Pietersen', soortRecht: 'Eigendom',
          breukdeel: { teller: 1, noemer: 3 } },
      ],
    });
    expect(view.rechthebbenden).toHaveLength(1);
    expect(view.rechthebbenden[0].naam).toBe('A. Pietersen');
    expect(view.rechthebbenden[0].rechtsoort).toBe('Eigendom');
    expect(view.rechthebbenden[0].aandeel).toBe('1/3');
  });

  it('herkent rechtspersoon onder naamNietNatuurlijkPersoon', () => {
    const view = mapRechten({
      tenaamstellingen: [{
        naamNietNatuurlijkPersoon: { statutaireNaam: 'Voorbeeld Holding B.V.' },
        zakelijkRecht: 'Eigendom',
        gerechtigdAandeel: '1/1',
      }],
    });
    expect(view.rechthebbenden[0].bedrijfsnaam).toBe('Voorbeeld Holding B.V.');
    expect(view.rechthebbenden[0].rechtsoort).toBe('Eigendom');
    expect(view.rechthebbenden[0].aandeel).toBe('1/1');
  });

  it('valt terug op kadastraalObject voor kadastrale aanduiding', () => {
    const view = mapRechten({
      rechthebbenden: [{ naam: 'X', aardRecht: 'Eigendom' }],
      kadastraalObject: 'AMS00-Q-9999',
    });
    expect(view.kadastraleAanduiding).toBe('AMS00-Q-9999');
    expect(heeftRechtenInhoud(view)).toBe(true);
  });

  it('blijft leeg en niet-crashend bij onbekende shape', () => {
    const view = mapRechten({ foo: { bar: 1 } });
    expect(view.rechthebbenden).toHaveLength(0);
    expect(heeftRechtenInhoud(view)).toBe(false);
  });
});
