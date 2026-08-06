import { describe, expect, it } from 'vitest';

import { PRODUCTIEKERN_CONCURRENCY_SCENARIOS } from './productiekernConcurrencyProefManifest';
import {
  legProductiekernConcurrencyProefBewijsVast,
  ProductiekernConcurrencyProefBewijsNietBeschikbaarError,
} from './productiekernConcurrencyProefBewijs';

const manifest = {
  versie: 1,
  modus: 'geisoleerd_rollback_only',
  doelomgeving: 'shadow-acquisitie',
  schemaNaam: 'probe',
  paralleliteit: 8,
  scenarios: PRODUCTIEKERN_CONCURRENCY_SCENARIOS,
  aangemaaktOp: '2026-08-06T13:45:00.000Z',
  aangemaaktDoor: 'tester',
  productieMigratieToegestaan: false,
  productieActivatieToegestaan: false,
} as const;

describe('legProductiekernConcurrencyProefBewijsVast', () => {
  it('legt uitsluitend geslaagd rollbackbewijs vast zonder activatierechten', () => {
    const bewijs = legProductiekernConcurrencyProefBewijsVast(
      manifest,
      {
        geslaagd: true,
        blokkades: [],
        productieMigratieToegestaan: false,
        productieActivatieToegestaan: false,
      },
      '2026-08-06T14:00:00.000Z',
      'rlsbito90-eng',
    );

    expect(bewijs.paralleliteit).toBe(8);
    expect(bewijs.scenarios).toEqual(PRODUCTIEKERN_CONCURRENCY_SCENARIOS);
    expect(bewijs.verleentProductieMigratie).toBe(false);
    expect(bewijs.verleentProductieActivatie).toBe(false);
  });

  it('weigert bewijs bij een geblokkeerde proef', () => {
    expect(() => legProductiekernConcurrencyProefBewijsVast(
      manifest,
      {
        geslaagd: false,
        blokkades: ['Dubbel briefnummer.'],
        productieMigratieToegestaan: false,
        productieActivatieToegestaan: false,
      },
      '2026-08-06T14:00:00.000Z',
      'tester',
    )).toThrow(ProductiekernConcurrencyProefBewijsNietBeschikbaarError);
  });

  it('vereist geldige vaststellingsmetadata', () => {
    expect(() => legProductiekernConcurrencyProefBewijsVast(
      manifest,
      {
        geslaagd: true,
        blokkades: [],
        productieMigratieToegestaan: false,
        productieActivatieToegestaan: false,
      },
      'ongeldig',
      'tester',
    )).toThrow('vastgesteldOp moet een geldige ISO-datum zijn.');
  });
});
