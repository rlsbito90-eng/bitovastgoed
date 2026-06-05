import { describe, it, expect } from 'vitest';
import {
  parseAdres,
  detectAssettype,
  detectSignaaltype,
  detectBronType,
  scoreRecord,
  yyyymm,
  dedupeHashInput,
  sha256Hex,
  type BronConfig,
} from '@/lib/offMarket/import/normalize';

const CONFIG: BronConfig = {
  positieve_keywords: ['transformatie', 'functiewijziging', 'kantoor naar wonen', 'kamerverhuur'],
  negatieve_keywords: ['dakkapel', 'kapvergunning', 'aanbouw', 'inrit'],
  score_drempel: 40,
  gemeente: 'Amsterdam',
  provincie: 'Noord-Holland',
};

describe('parseAdres', () => {
  it('haalt straat+huisnummer + postcode uit tekst', () => {
    const r = parseAdres('Vergunning aan de Vondelstraat 70, 1054 GD Amsterdam');
    expect(r.adres).toBe('Vondelstraat 70');
    expect(r.postcode).toBe('1054 GD');
  });
  it('ondersteunt huisnummer met toevoeging', () => {
    const r = parseAdres('Prinsengracht 263A te Amsterdam');
    expect(r.adres).toBe('Prinsengracht 263A');
  });
  it('postcode zonder spatie', () => {
    const r = parseAdres('Pand op 3011AB Rotterdam');
    expect(r.postcode).toBe('3011 AB');
  });
  it('geen match → null', () => {
    expect(parseAdres('geen adres hier').adres).toBeNull();
  });
});

describe('detectAssettype', () => {
  it.each([
    ['transformatie van kantoor naar wonen', 'transformatieobject'],
    ['nieuwbouw kantoor', 'kantoor'],
    ['winkelpand verbouwen', 'winkelpand'],
    ['logistiek distributiecentrum', 'logistiek'],
    ['hondenuitlaatservice', 'overig'],
  ])('%s → %s', (text, expected) => {
    expect(detectAssettype(text)).toBe(expected);
  });
});

describe('detectSignaaltype', () => {
  it('herkent transformatie', () => {
    expect(detectSignaaltype('kantoor naar wonen transformatie')).toBe('transformatiepotentie');
  });
  it('herkent functiewijziging', () => {
    expect(detectSignaaltype('wijzigen gebruik van winkel')).toBe('functiewijziging');
  });
  it('fallback', () => {
    expect(detectSignaaltype('omgevingsvergunning verleend')).toBe('vergunning_bekendmaking');
  });
});

describe('detectBronType', () => {
  it('herkent vergunning', () => {
    expect(detectBronType(['omgevingsvergunning'])).toBe('vergunning');
  });
  it('fallback naar bekendmaking', () => {
    expect(detectBronType(['kennisgeving'])).toBe('bekendmaking');
  });
});

describe('scoreRecord', () => {
  it('hoge score bij transformatie kantoor + adres', () => {
    const r = scoreRecord(
      {
        titel: 'Omgevingsvergunning Damrak 70 transformatie kantoor naar wonen',
        samenvatting: 'transformatie van kantoorpand',
        subjects: ['omgevingsvergunning', 'transformatie'],
        datum: '2026-06-01',
      },
      CONFIG,
    );
    // +30 positief +20 adres +15 kantoor/transformatie assettype +10 'pand'
    expect(r.score).toBeGreaterThanOrEqual(40);
  });

  it('lage score bij dakkapel particulier', () => {
    const r = scoreRecord(
      {
        titel: 'Dakkapel Vondelstraat 5',
        samenvatting: 'plaatsen dakkapel achterzijde',
        subjects: ['omgevingsvergunning'],
        datum: '2026-06-01',
      },
      CONFIG,
    );
    expect(r.score).toBeLessThan(CONFIG.score_drempel);
  });

  it('kapvergunning krijgt negatieve impact', () => {
    const r = scoreRecord(
      {
        titel: 'Kapvergunning Vondelpark',
        samenvatting: 'kappen 3 bomen',
        subjects: ['kapvergunning'],
        datum: null,
      },
      CONFIG,
    );
    expect(r.score).toBe(0);
  });

  it('score wordt geclipped tussen 0 en 100', () => {
    const r = scoreRecord(
      {
        titel: 'transformatie kantoor pand Damrak 1 functiewijziging',
        samenvatting: 'kamerverhuur en kantoor naar wonen mixed-use complex',
        subjects: ['omgevingsvergunning'],
        datum: '2026-01-01',
      },
      CONFIG,
    );
    expect(r.score).toBeLessThanOrEqual(100);
    expect(r.score).toBeGreaterThan(0);
  });
});

describe('yyyymm', () => {
  it.each([
    ['2026-06-01', '2026-06'],
    ['2026-06-01T12:00:00Z', '2026-06'],
    [null, 'onbekend'],
    ['', 'onbekend'],
  ])('%s → %s', (input, expected) => {
    expect(yyyymm(input)).toBe(expected);
  });
});

describe('dedupeHashInput', () => {
  it('is case-insensitive en whitespace-stabiel', () => {
    const a = dedupeHashInput('Damrak 70', 'Amsterdam', 'kantoor', '2026-06-01');
    const b = dedupeHashInput('  damrak   70 ', 'AMSTERDAM', 'kantoor', '2026-06-15');
    expect(a).toBe(b);
  });
  it('verschilt bij andere maand', () => {
    const a = dedupeHashInput('Damrak 70', 'Amsterdam', 'kantoor', '2026-06-01');
    const b = dedupeHashInput('Damrak 70', 'Amsterdam', 'kantoor', '2026-07-01');
    expect(a).not.toBe(b);
  });
  it('verschilt bij ander assettype', () => {
    const a = dedupeHashInput('Damrak 70', 'Amsterdam', 'kantoor', '2026-06-01');
    const b = dedupeHashInput('Damrak 70', 'Amsterdam', 'winkelpand', '2026-06-01');
    expect(a).not.toBe(b);
  });
});

describe('sha256Hex', () => {
  it('produceert deterministische 64-char hex', async () => {
    const h1 = await sha256Hex('hallo');
    const h2 = await sha256Hex('hallo');
    expect(h1).toHaveLength(64);
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
  });
});
