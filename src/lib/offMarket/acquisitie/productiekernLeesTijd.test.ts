import { describe, expect, it } from 'vitest';

import {
  ProductiekernLeesTijdError,
  valideerProductiekernTijdstip,
} from './productiekernLeesTijd';

describe('valideerProductiekernTijdstip', () => {
  const nu = Date.parse('2026-08-06T15:40:00Z');

  it('accepteert null en canonieke UTC-tijdstippen', () => {
    expect(valideerProductiekernTijdstip('created_at', null, nu)).toBeNull();
    expect(valideerProductiekernTijdstip(
      'created_at', '2026-08-06T15:39:59.123Z', nu,
    )).toBe('2026-08-06T15:39:59.123Z');
  });

  it('weigert lokale tijden, offsets en ongeldige kalenderwaarden', () => {
    for (const waarde of [
      '2026-08-06 15:39:59',
      '2026-08-06T17:39:59+02:00',
      '2026-13-40T25:61:61Z',
    ]) {
      expect(() => valideerProductiekernTijdstip('created_at', waarde, nu))
        .toThrow(ProductiekernLeesTijdError);
    }
  });

  it('weigert tijdstippen buiten de toegestane toekomstmarge', () => {
    expect(() => valideerProductiekernTijdstip(
      'verzonden_op', '2026-08-06T15:42:00Z', nu, 60_000,
    )).toThrow('ligt te ver in de toekomst');
  });
});
