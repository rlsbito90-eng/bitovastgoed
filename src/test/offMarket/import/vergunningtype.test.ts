import { describe, it, expect } from 'vitest';
import {
  detectVergunningtype,
  detectAanvraagOfBesluit,
  parseAdres,
} from '@/lib/offMarket/import/normalize';
import { relevantieBucket } from '@/lib/offMarket/relevantie';
import type { OffMarketSignaal } from '@/lib/offMarket/types';

describe('detectVergunningtype', () => {
  it('herkent splitsing', () => {
    expect(detectVergunningtype('Aanvraag splitsingsvergunning Hoofdweg 160')).toBe('splitsing');
    expect(detectVergunningtype('Kadastrale splitsing pand')).toBe('splitsing');
  });
  it('herkent woonvorming', () => {
    expect(detectVergunningtype('Woonvormingsvergunning toegekend')).toBe('woonvorming');
  });
  it('herkent omzetting', () => {
    expect(detectVergunningtype('Omzettingsvergunning naar onzelfstandige woonruimte')).toBe('omzetting');
    expect(detectVergunningtype('Kamerverhuur in pand')).toBe('omzetting');
  });
  it('herkent onttrekking', () => {
    expect(detectVergunningtype('Onttrekkingsvergunning voor tweede woning')).toBe('onttrekking');
  });
  it('herkent functiewijziging', () => {
    expect(detectVergunningtype('Wijzigen gebruik kantoor')).toBe('functiewijziging');
  });
  it('herkent transformatie', () => {
    expect(detectVergunningtype('Transformatie kantoor naar wonen')).toBe('transformatie');
  });
  it('herkent ontwikkeling', () => {
    expect(detectVergunningtype('Nieuwbouw appartementencomplex')).toBe('ontwikkeling');
  });
  it('valt terug op overig', () => {
    expect(detectVergunningtype('Iets totaal anders')).toBe('overig');
    expect(detectVergunningtype('')).toBe('overig');
  });
});

describe('detectAanvraagOfBesluit', () => {
  it('herkent aanvraag', () => {
    expect(detectAanvraagOfBesluit('Aanvraag splitsingsvergunning', [])).toBe('aanvraag');
    expect(detectAanvraagOfBesluit('Ingediende vergunning', [])).toBe('aanvraag');
  });
  it('herkent besluit', () => {
    expect(detectAanvraagOfBesluit('Verleende vergunning Hoofdweg', [])).toBe('besluit');
    expect(detectAanvraagOfBesluit('Besluit op aanvraag', [])).toBe('besluit');
    expect(detectAanvraagOfBesluit('Weigering omzettingsvergunning', [])).toBe('besluit');
  });
  it('herkent melding', () => {
    expect(detectAanvraagOfBesluit('Melding sloop', [])).toBe('melding');
    expect(detectAanvraagOfBesluit('Kennisgeving aan omwonenden', [])).toBe('melding');
  });
  it('valt terug op onbekend', () => {
    expect(detectAanvraagOfBesluit('Random tekst', [])).toBe('onbekend');
  });
  it('gebruikt subjects als fallback', () => {
    expect(detectAanvraagOfBesluit('Iets', ['Aanvraag vergunning'])).toBe('aanvraag');
  });
});

describe('parseAdres — postcode', () => {
  it('haalt postcode met spatie', () => {
    expect(parseAdres('Hoofdweg 160 1057 DB Amsterdam').postcode).toBe('1057 DB');
  });
  it('haalt postcode zonder spatie', () => {
    expect(parseAdres('Hoofdweg 160 1057DB Amsterdam').postcode).toBe('1057 DB');
  });
});

describe('relevantieBucket fallback', () => {
  it('gebruikt vergunningtype-kolom als deze gevuld is', () => {
    const s = { vergunningtype: 'woonvorming', titel: '', omschrijving: '', notities: '' } as unknown as OffMarketSignaal;
    expect(relevantieBucket(s).label).toBe('Woonvorming');
  });
  it('valt terug op tekstuele heuristiek wanneer vergunningtype ontbreekt', () => {
    const s = { vergunningtype: null, titel: 'Aanvraag splitsingsvergunning', omschrijving: '', notities: '' } as unknown as OffMarketSignaal;
    expect(relevantieBucket(s).label).toBe('Splitsing');
  });
  it('onbekende tekst → Overige', () => {
    const s = { vergunningtype: null, titel: 'iets', omschrijving: '', notities: '' } as unknown as OffMarketSignaal;
    expect(relevantieBucket(s).label).toBe('Overige');
  });
});
