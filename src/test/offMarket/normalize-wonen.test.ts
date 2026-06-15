import { describe, it, expect } from 'vitest';
import { detectAssettype, detectStrategie } from '@/lib/offMarket/import/normalize';

describe('detectAssettype – wonen/splitsing', () => {
  it.each([
    ['Aanvraag splitsingsvergunning Prinsengracht 100', 'wonen'],
    ['splitsen in appartementsrechten', 'wonen'],
    ['Appartementensplitsing Vondelpark 4', 'wonen'],
    ['Verleende woonvormingsvergunning', 'wonen'],
    ['appartementencomplex met 12 wooneenheden', 'appartementencomplex'],
    ['herenhuis aan de gracht', 'woonhuis'],
    ['studentenhuisvesting nieuwbouw', 'studentenhuisvesting'],
  ])('%s → %s', (text, expected) => {
    expect(detectAssettype(text)).toBe(expected);
  });

  it('valt niet meer terug op overig voor splitsingssignalen', () => {
    expect(detectAssettype('aangevraagde splitsingsvergunning')).not.toBe('overig');
  });
});

describe('detectStrategie', () => {
  it('splitsingssignalen → Splitsingspotentie', () => {
    expect(detectStrategie('splitsingsvergunning ingediend')).toBe('Splitsingspotentie');
    expect(detectStrategie('woonvormingsvergunning verleend')).toBe('Splitsingspotentie');
    expect(detectStrategie('splitsen in appartementsrechten')).toBe('Splitsingspotentie');
  });
  it('uitponding → Uitponding', () => {
    expect(detectStrategie('kadastrale uitponding')).toBe('Splitsingspotentie');
    expect(detectStrategie('plan tot uitponden van complex')).toBe('Uitponding');
  });
  it('transformatie → Transformatie', () => {
    expect(detectStrategie('transformatie kantoor naar wonen')).toBe('Transformatie');
  });
  it('geen match → null', () => {
    expect(detectStrategie('nieuwbouw bedrijfshal')).toBeNull();
  });
});
