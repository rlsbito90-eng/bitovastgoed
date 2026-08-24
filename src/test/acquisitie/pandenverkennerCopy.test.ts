import { describe, expect, it } from 'vitest';
import {
  bepaalPandenverkennerCopyProfiel,
  bouwPandenverkennerBrief1,
  kiesPandenverkennerVariant,
} from '@/lib/acquisitie/pandenverkennerCopy';

describe('Pandenverkenner copyprofielen', () => {
  it('herkent woon-/winkelpand', () => {
    expect(bepaalPandenverkennerCopyProfiel('winkelfunctie, woonfunctie')).toBe('pandenverkenner_woon_winkelpand');
  });

  it('herkent ander gemengd vastgoed', () => {
    expect(bepaalPandenverkennerCopyProfiel('kantoorfunctie, woonfunctie')).toBe('pandenverkenner_gemengd_vastgoed');
  });

  it('herkent wonen en commercieel afzonderlijk', () => {
    expect(bepaalPandenverkennerCopyProfiel('woonfunctie')).toBe('pandenverkenner_woonvastgoed');
    expect(bepaalPandenverkennerCopyProfiel('kantoorfunctie')).toBe('pandenverkenner_commercieel_vastgoed');
  });

  it('valt terug op algemene acquisitie zonder claims over potentie', () => {
    expect(bepaalPandenverkennerCopyProfiel('')).toBe('pandenverkenner_algemene_acquisitie');
  });
});

describe('Pandenverkenner Brief 1 A/B', () => {
  const basis = {
    vastgoedkansId: '11111111-1111-1111-1111-111111111111',
    typeVastgoed: 'winkelfunctie, woonfunctie',
    objectomschrijving: 'Voorbeeldstraat 10 te Amsterdam',
    plaats: 'Amsterdam',
    geadresseerdeKey: 'eigenaar-objectadres|Voorbeeldstraat 10',
    eigenaarBevestigd: false,
  };

  it('kiest deterministisch dezelfde variant', () => {
    const a = kiesPandenverkennerVariant(basis);
    const b = kiesPandenverkennerVariant(basis);
    expect(a).toEqual(b);
    expect(['A', 'B']).toContain(a.variantCode);
    expect(a.profiel).toBe('pandenverkenner_woon_winkelpand');
  });

  it('gebruikt bij onbekende eigenaar nooit "uw pand"', () => {
    const toewijzing = { ...kiesPandenverkennerVariant(basis), variantCode: 'A' as const };
    const brief = bouwPandenverkennerBrief1(basis, toewijzing);
    expect(brief.brieftekst).toContain('het pand aan Voorbeeldstraat 10 te Amsterdam');
    expect(brief.brieftekst).not.toContain('uw pand aan Voorbeeldstraat 10');
    expect(brief.brieftekst).toContain('woon-/winkelpanden');
    expect(brief.brieftekst).not.toContain('splitsingspotentie');
    expect(brief.brieftekst).not.toContain('transformatiepotentie');
  });

  it('mag bij bevestigde eigenaar "uw pand" gebruiken', () => {
    const bevestigd = { ...basis, eigenaarBevestigd: true };
    const toewijzing = { ...kiesPandenverkennerVariant(bevestigd), variantCode: 'B' as const };
    const brief = bouwPandenverkennerBrief1(bevestigd, toewijzing);
    expect(brief.brieftekst).toContain('uw pand aan Voorbeeldstraat 10 te Amsterdam');
    expect(brief.brieftekst).toContain('Interesse? Een kort telefoongesprek of e-mail is voldoende.');
  });
});
