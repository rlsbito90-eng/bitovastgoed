import { describe, expect, it } from 'vitest';

import { serializeerBatchAdreslabelsCsv } from './batchAdreslabelsCsv';

const rij = {
  volgnummer: 1,
  briefnummer: 'BR2026000482',
  briefVersieId: 'versie-1',
  naamregel: 'Bito "Vastgoed"',
  attentieregel: 'T.a.v. de directie',
  adresregel: 'Straat 1',
  postcode: '5061AA',
  plaats: 'Oisterwijk',
  landregel: null,
};

describe('serializeerBatchAdreslabelsCsv', () => {
  it('levert Brother-compatibele puntkomma-CSV zonder BOM, met CRLF en correcte escaping', () => {
    const csv = serializeerBatchAdreslabelsCsv([rij]);

    expect(csv.startsWith('\uFEFF')).toBe(false);
    expect(csv).toContain('volgnummer;briefnummer;briefVersieId;naamregel;attentieregel;adresregel;postcode;plaats;landregel');
    expect(csv).toContain('"Bito ""Vastgoed""";T.a.v. de directie;Straat 1');
    expect(csv.endsWith('\r\n')).toBe(true);
    expect(csv.split('\r\n')).toHaveLength(3);
  });

  it('weigert lege invoer en niet-aaneengesloten volgnummers', () => {
    expect(() => serializeerBatchAdreslabelsCsv([]))
      .toThrow('Adreslabels-CSV vereist minimaal één rij.');
    expect(() => serializeerBatchAdreslabelsCsv([{ ...rij, volgnummer: 2 }]))
      .toThrow('Adreslabels-CSV vereist aaneengesloten volgnummers vanaf 1.');
  });

  it('serializeert null als lege cel en quote alleen wanneer nodig', () => {
    const csv = serializeerBatchAdreslabelsCsv([{
      ...rij,
      naamregel: 'Bedrijf; Holding B.V.',
    }]);
    expect(csv).toContain('"Bedrijf; Holding B.V.";T.a.v. de directie');
    expect(csv).toContain(';Oisterwijk;\r\n');
  });
});
