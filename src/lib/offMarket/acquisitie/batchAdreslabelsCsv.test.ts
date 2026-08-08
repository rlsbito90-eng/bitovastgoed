import { describe, expect, it } from 'vitest';

import { serializeerBatchAdreslabelsCsv } from './batchAdreslabelsCsv';

const rij = {
  volgnummer: 1,
  briefnummer: 'BR2026000482',
  briefVersieId: 'versie-1',
  naamregel: 'Bito "Vastgoed"',
  adresregel: 'Straat 1',
  postcode: '5061AA',
  plaats: 'Oisterwijk',
  landregel: null,
};

describe('serializeerBatchAdreslabelsCsv', () => {
  it('levert BOM, vaste kolomvolgorde, CRLF en correcte escaping', () => {
    const csv = serializeerBatchAdreslabelsCsv([rij]);

    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('"volgnummer","briefnummer","briefVersieId"');
    expect(csv).toContain('"Bito ""Vastgoed"""');
    expect(csv.endsWith('\r\n')).toBe(true);
    expect(csv.split('\r\n')).toHaveLength(3);
  });

  it('weigert lege invoer en niet-aaneengesloten volgnummers', () => {
    expect(() => serializeerBatchAdreslabelsCsv([]))
      .toThrow('Adreslabels-CSV vereist minimaal één rij.');
    expect(() => serializeerBatchAdreslabelsCsv([{ ...rij, volgnummer: 2 }]))
      .toThrow('Adreslabels-CSV vereist aaneengesloten volgnummers vanaf 1.');
  });

  it('serializeert null als een lege geciteerde cel', () => {
    expect(serializeerBatchAdreslabelsCsv([rij]))
      .toContain('"Oisterwijk",""');
  });
});
