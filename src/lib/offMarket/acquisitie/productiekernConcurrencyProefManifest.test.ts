import { describe, expect, it } from 'vitest';

import {
  bouwProductiekernConcurrencyProefManifest,
  PRODUCTIEKERN_CONCURRENCY_SCENARIOS,
  ProductiekernConcurrencyProefNietToegestaanError,
} from './productiekernConcurrencyProefManifest';

const groenBesluit = {
  concurrencyProefVoorbereiden: true,
  productieMigratieToegestaan: false,
  productieActivatieToegestaan: false,
  blokkades: [],
} as const;

describe('bouwProductiekernConcurrencyProefManifest', () => {
  it('bouwt een vaste rollback-only proef met alle kritieke scenarios', () => {
    const manifest = bouwProductiekernConcurrencyProefManifest({
      besluit: groenBesluit,
      doelomgeving: 'shadow-acquisitie',
      schemaNaam: 'acquisitie_concurrency_probe',
      paralleliteit: 10,
      aangemaaktOp: '2026-08-06T13:45:00.000Z',
      aangemaaktDoor: 'rlsbito90-eng',
    });

    expect(manifest.modus).toBe('geisoleerd_rollback_only');
    expect(manifest.scenarios).toEqual(PRODUCTIEKERN_CONCURRENCY_SCENARIOS);
    expect(manifest.productieMigratieToegestaan).toBe(false);
    expect(manifest.productieActivatieToegestaan).toBe(false);
  });

  it('weigert voorbereiding wanneer het vorige-stapbesluit gesloten is', () => {
    expect(() => bouwProductiekernConcurrencyProefManifest({
      besluit: {
        ...groenBesluit,
        concurrencyProefVoorbereiden: false,
        blokkades: ['DDL niet geverifieerd.'],
      },
      doelomgeving: 'shadow-acquisitie',
      schemaNaam: 'probe',
      paralleliteit: 4,
      aangemaaktOp: '2026-08-06T13:45:00.000Z',
      aangemaaktDoor: 'tester',
    })).toThrow(ProductiekernConcurrencyProefNietToegestaanError);
  });

  it.each([1, 51, 2.5])('weigert onveilige paralleliteit %s', (paralleliteit) => {
    expect(() => bouwProductiekernConcurrencyProefManifest({
      besluit: groenBesluit,
      doelomgeving: 'shadow-acquisitie',
      schemaNaam: 'probe',
      paralleliteit,
      aangemaaktOp: '2026-08-06T13:45:00.000Z',
      aangemaaktDoor: 'tester',
    })).toThrow('paralleliteit moet een geheel getal tussen 2 en 50 zijn.');
  });
});
