import { describe, expect, it } from 'vitest';

import { serializeerBatchAdreslabelsCsv } from './batchAdreslabelsCsv';

const bedrijf = {
  volgnummer: 1,
  briefnummer: 'BR2026000482',
  briefVersieId: 'versie-1',
  naamregel: 'Bito Vastgoed B.V.',
  attentieregel: 'T.a.v. de directie',
  adresregel: 'Straat 1',
  postcode: '5061AA',
  plaats: 'Oisterwijk',
  landregel: null,
};

describe('serializeerBatchAdreslabelsCsv', () => {
  it('levert één vaste Brother-layout voor een Nederlands bedrijf', () => {
    const csv = serializeerBatchAdreslabelsCsv([bedrijf]);
    expect(csv.startsWith('\uFEFF')).toBe(false);
    expect(csv).toContain('Nummer;Regel1;Regel2;Regel3;Regel4');
    expect(csv).toContain('1;Bito Vastgoed B.V.;T.a.v. de directie;Straat 1;5061 AA OISTERWIJK');
    expect(csv).not.toContain('briefnummer');
    expect(csv.endsWith('\r\n')).toBe(true);
  });

  it('schuift een particulier compact omhoog zonder heer/mevrouw-reserveregel', () => {
    const csv = serializeerBatchAdreslabelsCsv([{
      ...bedrijf,
      naamregel: 'O. Lixenberg',
      attentieregel: null,
    }]);
    expect(csv).toContain('1;O. Lixenberg;Straat 1;5061 AA OISTERWIJK;');
  });

  it('gebruikt regel 4 voor een buitenlands land', () => {
    const csv = serializeerBatchAdreslabelsCsv([{
      ...bedrijf,
      naamregel: 'M. Paare',
      attentieregel: null,
      adresregel: 'Ru Poeta Emiliano da Costa n. 82 RC',
      postcode: '8800-357',
      plaats: 'Tavira',
      landregel: 'PORTUGAL',
    }]);
    expect(csv).toContain('1;M. Paare;Ru Poeta Emiliano da Costa n. 82 RC;8800-357 TAVIRA;PORTUGAL');
  });

  it('weigert lege invoer en niet-aaneengesloten volgnummers', () => {
    expect(() => serializeerBatchAdreslabelsCsv([]))
      .toThrow('Adreslabels-CSV vereist minimaal één rij.');
    expect(() => serializeerBatchAdreslabelsCsv([{ ...bedrijf, volgnummer: 2 }]))
      .toThrow('Adreslabels-CSV vereist aaneengesloten volgnummers vanaf 1.');
  });

  it('quote alleen wanneer het scheidingsteken in een labelregel voorkomt', () => {
    const csv = serializeerBatchAdreslabelsCsv([{
      ...bedrijf,
      naamregel: 'Bedrijf; Holding B.V.',
    }]);
    expect(csv).toContain('1;"Bedrijf; Holding B.V.";T.a.v. de directie');
  });
});
