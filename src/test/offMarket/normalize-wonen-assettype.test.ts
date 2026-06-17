import { describe, it, expect } from 'vitest';
import { detectAssettype } from '@/lib/offMarket/import/normalize';

describe('detectAssettype – wonen-defaults voor splitsings-/woonvormingssignalen', () => {
  it.each([
    ['Aanvraag splitsingsvergunning Voorbeeldstraat 12', 'wonen'],
    ['Splitsen in appartementsrechten Voorbeeldlaan 4', 'wonen'],
    ['Appartementensplitsing Voorbeeldhof 6', 'wonen'],
    ['appartementsrecht wijziging', 'wonen'],
    ['appartementsrechten splitsen', 'wonen'],
    ['Woonvormingsvergunning Voorbeeldkade 10', 'wonen'],
    ['woonvorming aanvraag', 'wonen'],
    ['woningvorming melding', 'wonen'],
    ['Omzettingsvergunning Voorbeeldweg 8', 'wonen'],
    ['kamergewijze verhuur Voorbeeldpad 3', 'wonen'],
    ['kamerverhuur Voorbeeldstraat 1', 'wonen'],
    ['woningdelen aanvraag', 'wonen'],
    ['onttrekkingsvergunning woonruimte', 'wonen'],
    ['onttrekking woonruimte Voorbeeld 2', 'wonen'],
    ['samenvoegen woonruimte Voorbeeld 3', 'wonen'],
    ['woonfunctie wijzigen', 'wonen'],
    ['nieuw appartement gerealiseerd', 'wonen'],
    ['appartementen gerealiseerd', 'wonen'],
  ])('"%s" → %s', (text, expected) => {
    expect(detectAssettype(text)).toBe(expected);
  });

  it('irrelevante input blijft overig', () => {
    expect(detectAssettype('hondenuitlaatservice')).toBe('overig');
    expect(detectAssettype('inrichten parkeerplaats')).toBe('overig');
  });

  it('specifiekere woon-subtypes winnen van generiek wonen', () => {
    expect(detectAssettype('appartementencomplex aan de gracht')).toBe('appartementencomplex');
    expect(detectAssettype('herenhuis te koop')).toBe('woonhuis');
    expect(detectAssettype('studentenhuisvesting nieuwbouw')).toBe('studentenhuisvesting');
  });

  it('handmatige keuzes worden niet via detectAssettype overschreven (geen automatische promotie zonder match)', () => {
    expect(detectAssettype('algemeen onderhoud pand')).toBe('overig');
  });
});
