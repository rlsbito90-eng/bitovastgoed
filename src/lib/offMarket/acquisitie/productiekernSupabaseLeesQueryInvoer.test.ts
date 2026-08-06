import { describe, expect, it } from 'vitest';

import { bouwProductiekernLeesQuery } from './productiekernSupabaseLeesQueryContract';

describe('productiekern leesquery-invoer', () => {
  it('normaliseert uitsluitend omringende spaties', () => {
    expect(bouwProductiekernLeesQuery('haal_brief', '  brief-1  ').filterWaarde)
      .toBe('brief-1');
  });

  it('weigert buitensporig lange filterwaarden', () => {
    expect(() => bouwProductiekernLeesQuery('haal_dossier', 'x'.repeat(201)))
      .toThrow('Filterwaarde voor haal_dossier is te lang.');
  });

  it('weigert controletekens vóór een transportaanroep', () => {
    for (const waarde of ['brief\n1', 'brief\u00001', 'brief\u007f1']) {
      expect(() => bouwProductiekernLeesQuery('haal_briefversies', waarde))
        .toThrow('Filterwaarde voor haal_briefversies bevat controletekens.');
    }
  });
});
