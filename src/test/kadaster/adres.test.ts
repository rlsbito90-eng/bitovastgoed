import { describe, it, expect } from 'vitest';
import { parseObjectAdres, normaliseerPostcode } from '@/lib/kadaster/adres';

describe('normaliseerPostcode', () => {
  it('formatteert zonder spatie', () => {
    expect(normaliseerPostcode('1234ab')).toBe('1234 AB');
  });
  it('formatteert met spatie', () => {
    expect(normaliseerPostcode('1234 AB')).toBe('1234 AB');
  });
  it('extracteert uit langere string', () => {
    expect(normaliseerPostcode('Straat 1, 5211 MS Den Bosch')).toBe('5211 MS');
  });
  it('geeft null bij ongeldig', () => {
    expect(normaliseerPostcode('abc')).toBeNull();
    expect(normaliseerPostcode(null)).toBeNull();
  });
});

describe('parseObjectAdres', () => {
  it('herkent enkel huisnummer', () => {
    const r = parseObjectAdres('Voorbeeldstraat 1', '1234 AB', 'Voorbeeldplaats');
    expect(r.postcode).toBe('1234 AB');
    expect(r.huisnummers).toHaveLength(1);
    expect(r.huisnummers[0]).toMatchObject({ huisnummer: '1', label: '1' });
    expect(r.betrouwbaar).toBe(true);
  });

  it('herkent huisnummer met letter', () => {
    const r = parseObjectAdres('Hinthamerstraat 90A', '5211 MS', 'Den Bosch');
    expect(r.huisnummers).toHaveLength(1);
    expect(r.huisnummers[0]).toMatchObject({ huisnummer: '90', huisletter: 'A', label: '90A' });
  });

  it('herkent meerdere huisnummers via komma', () => {
    const r = parseObjectAdres('Hinthamerstraat 90A, 92', '5211 MS', null);
    const labels = r.huisnummers.map(h => h.label);
    expect(labels).toEqual(['90A', '92']);
  });

  it('expandeert "t/m"-range op huisletters', () => {
    const r = parseObjectAdres('Hinthamerstraat 92A t/m F', '5211 MS', null);
    const labels = r.huisnummers.map(h => h.label);
    expect(labels).toEqual(['92A', '92B', '92C', '92D', '92E', '92F']);
  });

  it('expandeert numerieke "t/m"-range tot max 10', () => {
    const r = parseObjectAdres('Straat 92 t/m 96', '1234 AB', null);
    expect(r.huisnummers.map(h => h.label)).toEqual(['92', '93', '94', '95', '96']);
  });

  it('combineert losse + range', () => {
    const r = parseObjectAdres('Hinthamerstraat 90A, 92, 92A t/m C', '5211 MS', null);
    expect(r.huisnummers.map(h => h.label)).toEqual(['90A', '92', '92A', '92B', '92C']);
  });

  it('zet betrouwbaar=false zonder huisnummer', () => {
    const r = parseObjectAdres('Onbekendelaan', '1234 AB', null);
    expect(r.betrouwbaar).toBe(false);
    expect(r.huisnummers).toHaveLength(0);
  });

  it('zet betrouwbaar=false zonder postcode', () => {
    const r = parseObjectAdres('Straat 1', null, null);
    expect(r.betrouwbaar).toBe(false);
  });

  it('haalt postcode uit adresveld als losse postcode ontbreekt', () => {
    const r = parseObjectAdres('Straat 1 1234 AB Plaats', null, 'Plaats');
    expect(r.postcode).toBe('1234 AB');
    expect(r.huisnummers[0].label).toBe('1');
  });
});
