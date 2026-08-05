import { describe, expect, it } from 'vitest';
import { acquisitieSelectiePrioriteit, bepaalReviewPrioriteit } from './signaalReviewBeslissing';

describe('signaalreviewbeslissing', () => {
  it('mapt beoordelingen naar de afgesproken standaardprioriteit', () => {
    expect(bepaalReviewPrioriteit({ status: 'interessant', huidigePrioriteit: 'laag', handmatigAangepast: false })).toBe('hoog');
    expect(bepaalReviewPrioriteit({ status: 'te_onderzoeken', huidigePrioriteit: 'laag', handmatigAangepast: false })).toBe('midden');
    expect(bepaalReviewPrioriteit({ status: 'twijfel', huidigePrioriteit: 'hoog', handmatigAangepast: false })).toBe('laag');
    expect(bepaalReviewPrioriteit({ status: 'niet_interessant', huidigePrioriteit: 'hoog', handmatigAangepast: false })).toBe('laag');
  });

  it('laat een handmatige prioriteitskeuze altijd voorgaan', () => {
    expect(bepaalReviewPrioriteit({ status: 'interessant', huidigePrioriteit: 'midden', handmatigAangepast: true })).toBe('midden');
    expect(bepaalReviewPrioriteit({ status: 'niet_interessant', huidigePrioriteit: 'hoog', handmatigAangepast: true })).toBe('hoog');
  });

  it('geeft acquisitieselectie standaard hoog, tenzij handmatig overschreven', () => {
    expect(acquisitieSelectiePrioriteit({ huidigePrioriteit: 'laag', handmatigAangepast: false })).toBe('hoog');
    expect(acquisitieSelectiePrioriteit({ huidigePrioriteit: 'midden', handmatigAangepast: true })).toBe('midden');
  });
});
