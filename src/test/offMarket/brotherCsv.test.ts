// Brother P-touch CSV-export — unit tests.
// Vergelijk met referentiebestand:
//   /mnt/user-uploads/bito-adreslabels-brother-correct.csv
// Adressen/aantallen worden niet hardgecodeerd; alleen kolomvolgorde,
// delimiter, BOM en structuur worden inhoudelijk vergeleken.

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import {
  parseVerzendadresBrother,
  bouwBrotherLabelRij,
  brievenNaarBrotherRijen,
  bouwBrotherCsv,
  brotherCsvBestandsnaam,
  csvEscape,
  UTF8_BOM,
  BROTHER_CSV_KOLOMMEN,
  type BrotherBrief,
} from '@/lib/offMarket/acquisitie/brotherCsv';

function brief(p: Partial<BrotherBrief> & { id: string }): BrotherBrief {
  return {
    id: p.id,
    eigenaar_naam: null,
    eigenaar_bedrijfsnaam: null,
    verzendadres: null,
    aanhef: null,
    ...p,
  };
}

describe('brotherCsv — rij-opbouw', () => {
  it('NL particulier: Regel1 = uitsluitend eigenaar_naam (geen briefaanhef)', () => {
    const r = bouwBrotherLabelRij(brief({
      id: 'b1',
      eigenaar_naam: 'O. Lixenberg',
      verzendadres: 'Eerste Boomdwarsstraat 10-1\n1015 NC Amsterdam',
    }), 1);
    expect(r.geldig).toBe(true);
    expect(r.regel1).toBe('O. Lixenberg');
    expect(r.regel2).toBe('Eerste Boomdwarsstraat 10-1');
    expect(r.regel3).toBe('1015 NC AMSTERDAM');
    expect(r.regel4).toBe('');
  });

  it('NL rechtspersoon: Regel1 = bedrijfsnaam, Regel2 = "T.a.v. de directie"', () => {
    const r = bouwBrotherLabelRij(brief({
      id: 'b2',
      eigenaar_bedrijfsnaam: 'PRE Nederland B.V.',
      verzendadres: 'Oude Looiersstraat 44\n1016 VJ Amsterdam',
    }), 1);
    expect(r.geldig).toBe(true);
    expect(r.regel1).toBe('PRE Nederland B.V.');
    expect(r.regel2).toBe('T.a.v. de directie');
    expect(r.regel3).toBe('Oude Looiersstraat 44');
    expect(r.regel4).toBe('1016 VJ AMSTERDAM');
  });

  it('Buitenlands adres: Regel1 = eigenaar_naam, land in Regel4', () => {
    const r = bouwBrotherLabelRij(brief({
      id: 'b3',
      eigenaar_naam: 'M. Paare',
      verzendadres: 'Ru Poeta Emiliano da Costa n. 82 RC\n8800-357 Tavira\nPortugal',
    }), 1);
    expect(r.geldig).toBe(true);
    expect(r.regel1).toBe('M. Paare');
    expect(r.regel2).toBe('Ru Poeta Emiliano da Costa n. 82 RC');
    expect(r.regel3).toBe('8800-357 TAVIRA');
    expect(r.regel4).toBe('Portugal');
  });

  it('Buitenlandse particulier met opgeslagen briefaanhef: aanhef niet in Regel1', () => {
    const r = bouwBrotherLabelRij(brief({
      id: 'b3b',
      eigenaar_naam: 'J.B. Labeij',
      verzendadres: 'Strada Favona IV 1\n72012 Carovigno\nItalië',
      aanhef: 'Dear Sir/Madam,',
    }), 1);
    expect(r.regel1).toBe('J.B. Labeij');
    expect(r.regel4).toBe('Italië');
  });

  it('Gezamenlijke eigenaren: één record met gezamenlijke naamregel, geen aanhef', () => {
    const r = bouwBrotherLabelRij(brief({
      id: 'b4',
      eigenaar_naam: 'S.R. Wijnbergen en E.C. Wijnbergen',
      verzendadres: 'Hoogte Kadijk 36\n1018 BM Amsterdam',
    }), 1);
    expect(r.geldig).toBe(true);
    expect(r.regel1).toBe('S.R. Wijnbergen en E.C. Wijnbergen');
    expect(r.regel4).toBe('');
  });

  it('Speciale tekens (ü, é, apostroffen, &) blijven behouden', () => {
    const r = bouwBrotherLabelRij(brief({
      id: 'b5',
      eigenaar_naam: 'T. Süss',
      verzendadres: "O'Reilly-straat 3 & 4\n1000 AA Amsterdam",
    }), 1);
    expect(r.regel1).toBe('T. Süss');
    expect(r.regel2).toBe("O'Reilly-straat 3 & 4");
  });

  it('Blokkade wanneer naam of adres ontbreekt', () => {
    const geen = bouwBrotherLabelRij(brief({ id: 'x' }), 1);
    expect(geen.geldig).toBe(false);
    expect(geen.blokkadeReden).toMatch(/naam|bedrijfsnaam/i);

    const onvolledig = bouwBrotherLabelRij(brief({
      id: 'y', eigenaar_naam: 'A. Test', verzendadres: 'Alleen straat',
    }), 1);
    expect(onvolledig.geldig).toBe(false);
    expect(onvolledig.blokkadeReden).toMatch(/postadres/i);
  });

  it('Opgeslagen specifieke aanhef komt NIET op Regel1', () => {
    const r = bouwBrotherLabelRij(brief({
      id: 'b6', eigenaar_naam: 'A. Test',
      verzendadres: 'Straat 1\n1000 AA Plaats',
      aanhef: 'Geachte heer',
    }), 1);
    expect(r.regel1).toBe('A. Test');
  });
});

describe('brotherCsv — parser', () => {
  it('NL: postcode wordt genormaliseerd, plaats bovenkast', () => {
    const a = parseVerzendadresBrother('Straat 1\n1000ab utrecht');
    expect(a).toEqual({
      straat: 'Straat 1',
      postcodePlaats: '1000 AB UTRECHT',
      land: null,
    });
  });

  it('Buitenland: land is laatste regel', () => {
    const a = parseVerzendadresBrother('Rue X 5\n75001 Paris\nFrankrijk');
    expect(a?.land).toBe('Frankrijk');
    expect(a?.postcodePlaats).toBe('75001 PARIS');
  });

  it('Onleesbaar adres → null', () => {
    expect(parseVerzendadresBrother(null)).toBeNull();
    expect(parseVerzendadresBrother('')).toBeNull();
    expect(parseVerzendadresBrother('slechts één regel')).toBeNull();
  });
});

describe('brotherCsv — recordvolgorde en duplicaten', () => {
  it('Behoudt input-volgorde en dubbele adressen', () => {
    const brieven: BrotherBrief[] = [
      brief({ id: 'a', eigenaar_naam: 'A', verzendadres: 'Straat 1\n1000 AA Plaats' }),
      brief({ id: 'b', eigenaar_naam: 'B', verzendadres: 'Straat 1\n1000 AA Plaats' }),
      brief({ id: 'c', eigenaar_naam: 'A', verzendadres: 'Straat 1\n1000 AA Plaats' }),
    ];
    const rijen = brievenNaarBrotherRijen(brieven);
    expect(rijen).toHaveLength(3);
    expect(rijen.map(r => r.briefId)).toEqual(['a', 'b', 'c']);
    expect(rijen.map(r => r.nummer)).toEqual([1, 2, 3]);
  });
});

describe('brotherCsv — CSV-serialisatie', () => {
  it('Kolomvolgorde exact: Nummer,Regel1..Regel4', () => {
    expect(BROTHER_CSV_KOLOMMEN).toEqual([
      'Nummer', 'Regel1', 'Regel2', 'Regel3', 'Regel4',
    ]);
  });

  it('Komma als delimiter en CRLF regelafbreking', () => {
    const rij = bouwBrotherLabelRij(brief({
      id: 'z', eigenaar_naam: 'A. Test',
      verzendadres: 'Straat 1\n1000 AA Plaats',
    }), 1);
    const csv = bouwBrotherCsv([rij]);
    expect(csv.split('\r\n')[0]).toBe('Nummer,Regel1,Regel2,Regel3,Regel4');
    expect(csv).toContain('\r\n');
    expect(csv).not.toMatch(/[^\r]\n/); // geen kale LF
  });

  it('Escape: comma en quote correct gequoot', () => {
    expect(csvEscape('geen komma')).toBe('geen komma');
    expect(csvEscape('met, komma')).toBe('"met, komma"');
    expect(csvEscape('met "quote"')).toBe('"met ""quote"""');
  });

  it('Interne regeleinden worden vervangen door spatie', () => {
    expect(csvEscape('regel1\nregel2')).toBe('regel1 regel2');
  });

  it('Exact 5 velden per regel — geen verschoven kolommen', () => {
    const brieven: BrotherBrief[] = [
      brief({ id: '1', eigenaar_naam: 'A, met komma',
        verzendadres: 'Straat 1\n1000 AA Plaats' }),
      brief({ id: '2', eigenaar_bedrijfsnaam: 'BV "X"',
        verzendadres: 'Weg 2\n2000 BB Elders' }),
    ];
    const rijen = brievenNaarBrotherRijen(brieven);
    const csv = bouwBrotherCsv(rijen);
    const regels = csv.split('\r\n').filter(Boolean);
    expect(regels).toHaveLength(3); // kop + 2 rijen
    for (const r of regels) {
      // Splits met kennis van quoting: tel top-level komma's
      let inQuote = false; let velden = 1;
      for (let i = 0; i < r.length; i += 1) {
        const ch = r[i];
        if (ch === '"') {
          if (inQuote && r[i + 1] === '"') { i += 1; continue; }
          inQuote = !inQuote;
        } else if (ch === ',' && !inQuote) {
          velden += 1;
        }
      }
      expect(velden).toBe(5);
    }
  });

  it('Bestandsnaam volgt bito-vastgoed-adreslabels-YYYY-MM-DD.csv', () => {
    const naam = brotherCsvBestandsnaam(new Date('2026-07-21T10:00:00Z'));
    expect(naam).toBe('bito-vastgoed-adreslabels-2026-07-21.csv');
  });

  it('UTF-8 BOM constant is U+FEFF', () => {
    expect(UTF8_BOM).toBe('\uFEFF');
    expect(UTF8_BOM.charCodeAt(0)).toBe(0xFEFF);
  });
});

describe('brotherCsv — referentiebestand', () => {
  const REF = '/mnt/user-uploads/bito-adreslabels-brother-correct.csv';
  const gevonden = existsSync(REF);

  (gevonden ? it : it.skip)('kolomvolgorde en delimiter matchen referentie', () => {
    const ruw = readFileSync(REF, 'utf8');
    // Strip BOM voor kop-vergelijking
    const zonderBom = ruw.replace(/^\uFEFF/, '');
    const eersteRegel = zonderBom.split(/\r?\n/)[0];
    expect(eersteRegel).toBe('Nummer,Regel1,Regel2,Regel3,Regel4');
  });
});
