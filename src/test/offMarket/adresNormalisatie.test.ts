import { describe, it, expect } from 'vitest';
import {
  cleanPlaats,
  cleanAdres,
  formatSignaalAdres,
  formatSignaalTitel,
  normalizeImportedAddressFields,
} from '@/lib/offMarket/adresNormalisatie';

describe('cleanPlaats', () => {
  it.each([
    ['Amsterdam Aanvraag', 'Amsterdam'],
    ['Amsterdam Vergunning', 'Amsterdam'],
    ['Amsterdam Het', 'Amsterdam'],
    ['AMSTERDAM Aanvraag', 'Amsterdam'],
    ['Amsterdam Splitsingsvergunning', 'Amsterdam'],
    ['Amsterdam Intrekkingsbesluit', 'Amsterdam'],
    ['Amsterdam Aanvraag Onttrekkingsvergunning', 'Amsterdam'],
    ['AMSTERDAM', 'Amsterdam'],
    ['amsterdam', 'Amsterdam'],
    ['  rotterdam  ', 'Rotterdam'],
    ['Den Haag', 'Den Haag'],
    ["'s-Hertogenbosch", "'s-Hertogenbosch"],
    ["'s-hertogenbosch", "'s-Hertogenbosch"],
    ['Aanvraag', ''],
    ['', ''],
  ])('"%s" → "%s"', (input, expected) => {
    expect(cleanPlaats(input)).toBe(expected);
  });

  it('laat onbekende plaats intact maar in title case', () => {
    expect(cleanPlaats('voorbeelddorp')).toBe('Voorbeelddorp');
  });

  it('null/undefined → lege string', () => {
    expect(cleanPlaats(null)).toBe('');
    expect(cleanPlaats(undefined)).toBe('');
  });
});

describe('cleanAdres', () => {
  it('strip vergunningsruis', () => {
    expect(cleanAdres('Aanvraag Voorbeeldstraat 12')).toBe('Voorbeeldstraat 12');
  });
  it('trimt trailing leestekens', () => {
    expect(cleanAdres('Voorbeeldstraat 12,')).toBe('Voorbeeldstraat 12');
  });
  it('lege input → lege string', () => {
    expect(cleanAdres(null)).toBe('');
  });
});

describe('formatSignaalAdres', () => {
  it('combineert schoon adres en plaats met separator', () => {
    expect(formatSignaalAdres({ adres: 'Voorbeeldstraat 12', plaats: 'Amsterdam Aanvraag' }))
      .toBe('Voorbeeldstraat 12 · Amsterdam');
  });
  it('toont alleen plaats wanneer adres ontbreekt', () => {
    expect(formatSignaalAdres({ adres: null, plaats: 'AMSTERDAM' })).toBe('Amsterdam');
  });
  it('toont alleen adres wanneer plaats ontbreekt', () => {
    expect(formatSignaalAdres({ adres: 'Voorbeeldlaan 1', plaats: null })).toBe('Voorbeeldlaan 1');
  });
  it('voorkomt dubbele plaatsnaam', () => {
    expect(formatSignaalAdres({ adres: 'Voorbeeldlaan 1 Amsterdam', plaats: 'Amsterdam' }))
      .toBe('Voorbeeldlaan 1 Amsterdam');
  });
  it('lege fixture → lege string, geen losse separator', () => {
    expect(formatSignaalAdres({ adres: null, plaats: null })).toBe('');
  });
});

describe('formatSignaalTitel', () => {
  it('strip alleen leidende vergunningsruis', () => {
    expect(formatSignaalTitel({ titel: 'Aanvraag omgevingsvergunning Voorbeeldstraat 12', adres: null, plaats: null }))
      .toContain('Voorbeeldstraat 12');
  });
  it('valt terug op adres wanneer titel ontbreekt', () => {
    expect(formatSignaalTitel({ titel: null, adres: 'Voorbeeldlaan 5', plaats: 'Amsterdam' }))
      .toBe('Voorbeeldlaan 5 · Amsterdam');
  });
});

describe('normalizeImportedAddressFields', () => {
  it('schoont velden bij import', () => {
    const r = normalizeImportedAddressFields({
      adres: 'Aanvraag Voorbeeldstraat 12',
      postcode: '1000aa',
      plaats: 'AMSTERDAM Aanvraag',
    });
    expect(r.adres).toBe('Voorbeeldstraat 12');
    expect(r.postcode).toBe('1000 AA');
    expect(r.plaats).toBe('Amsterdam');
  });
});
