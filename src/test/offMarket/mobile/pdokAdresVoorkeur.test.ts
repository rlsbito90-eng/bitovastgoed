import { describe, expect, it } from 'vitest';
import { voorkeurScore } from '@/components/shared/BagAdresLookup';
import type { BagAdresResultaat } from '@/lib/bag/pdokLookup';

function adres(suffix: string | null): BagAdresResultaat {
  const isLetter = suffix != null && /^[A-Z]$/i.test(suffix);
  return {
    id: `11-${suffix ?? 'kaal'}`,
    weergavenaam: `Heemstedestraat 11${suffix ? '-' + suffix : ''}`,
    straat: 'Heemstedestraat',
    huisnummer: '11',
    huisletter: isLetter ? suffix!.toUpperCase() : null,
    huisnummertoevoeging: suffix && !isLetter ? suffix : null,
    postcode: '1059CX',
    woonplaats: 'Amsterdam',
    nummeraanduiding_id: null,
    adresseerbaar_object_id: null,
  };
}

describe('PDOK voorkeursadres voor Kadaster', () => {
  it('kiest H boven 1, A, overige toevoeging en kaal huisnummer', () => {
    expect(voorkeurScore(adres('H'), null)).toBeLessThan(voorkeurScore(adres('1'), null));
    expect(voorkeurScore(adres('1'), null)).toBeLessThan(voorkeurScore(adres('A'), null));
    expect(voorkeurScore(adres('A'), null)).toBeLessThan(voorkeurScore(adres('2'), null));
    expect(voorkeurScore(adres('2'), null)).toBeLessThan(voorkeurScore(adres(null), null));
  });

  it('laat een expliciete toevoeging uit het signaal altijd winnen', () => {
    const exact = { ...adres('2'), huisnummer: '174', weergavenaam: 'Vondelstraat 174-2' };
    const h = { ...adres('H'), huisnummer: '174', weergavenaam: 'Vondelstraat 174-H' };
    expect(voorkeurScore(exact, '174 2')).toBe(0);
    expect(voorkeurScore(exact, '174-2')).toBe(0);
    expect(voorkeurScore(exact, '174-2')).toBeLessThan(voorkeurScore(h, '174-2'));
  });
});
