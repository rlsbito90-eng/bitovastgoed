import { describe, expect, it } from 'vitest';
import { controleerObjectCrmBreed, normaliseerObjectAdres } from './objectControle';

describe('CRM-brede objectcontrole', () => {
  it('normaliseert schrijfvarianten van hetzelfde adres', () => {
    expect(normaliseerObjectAdres('Voorbeeldstraat 10-A', '1234 AB', 'Tilburg'))
      .toBe(normaliseerObjectAdres('Voorbeeldstraat 10 a', '1234AB', 'Tilburg'));
  });

  it('geeft BAG-verblijfsobject voorrang boven BAG-pand en adres', () => {
    const resultaat = controleerObjectCrmBreed({
      adres: 'Voorbeeldstraat 10', postcode: '1234AB', plaats: 'Tilburg',
      bagPandId: 'pand-1', bagVerblijfsobjectId: 'vbo-1',
    }, [
      { bronType: 'off_market_signaal', id: 's1', adres: 'Voorbeeldstraat 10', postcode: '1234AB', plaats: 'Tilburg' },
      { bronType: 'object', id: 'o1', bagPandId: 'pand-1' },
      { bronType: 'vastgoedkans', id: 'k1', bagVerblijfsobjectId: 'vbo-1' },
    ]);

    expect(resultaat.primaireMatch).toMatchObject({ bronType: 'vastgoedkans', bronId: 'k1', sterkte: 'bag_verblijfsobject' });
    expect(resultaat.heeftVastgoedkans).toBe(true);
    expect(resultaat.heeftObject).toBe(true);
    expect(resultaat.heeftOffMarketSignaal).toBe(true);
    expect(resultaat.aanbevolenActie).toBe('open_vastgoedkans');
  });

  it('stuurt een signaal zonder Vastgoedkans eerst naar signalen', () => {
    const resultaat = controleerObjectCrmBreed({
      adres: 'Markt 1', postcode: '5000AA', plaats: 'Tilburg',
    }, [
      { bronType: 'off_market_signaal', id: 's1', adres: 'Markt 1', postcode: '5000 AA', plaats: 'Tilburg' },
    ]);
    expect(resultaat.aanbevolenActie).toBe('bekijk_signalen');
  });

  it('adviseert een nieuwe Vastgoedkans wanneer niets bekend is', () => {
    const resultaat = controleerObjectCrmBreed({
      adres: 'Nieuwstraat 5', postcode: '5000BB', plaats: 'Tilburg',
    }, []);
    expect(resultaat.bestaand).toBe(false);
    expect(resultaat.aanbevolenActie).toBe('start_vastgoedkans');
  });
});
