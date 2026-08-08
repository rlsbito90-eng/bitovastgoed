import { describe, expect, it } from 'vitest';

import { PRODUCTIEKERN_CONCURRENCY_SCENARIOS } from './productiekernConcurrencyProefManifest';
import { beoordeelProductiekernConcurrencyProef } from './productiekernConcurrencyProefResultaat';

const manifest = {
  versie: 1,
  modus: 'geisoleerd_rollback_only',
  doelomgeving: 'shadow-acquisitie',
  schemaNaam: 'probe',
  paralleliteit: 4,
  scenarios: PRODUCTIEKERN_CONCURRENCY_SCENARIOS,
  aangemaaktOp: '2026-08-06T13:45:00.000Z',
  aangemaaktDoor: 'tester',
  productieMigratieToegestaan: false,
  productieActivatieToegestaan: false,
} as const;

const groeneScenarios = PRODUCTIEKERN_CONCURRENCY_SCENARIOS.map((scenario) => ({
  scenario,
  pogingen: 4,
  uniekeResultaten: scenario.includes('nummer_parallel_reserveren') ? 4 : 1,
  dubbeleNummers: 0,
  optimisticLockConflicten: scenario === 'batchdocumenten_optimistic_lock' ? 3 : 0,
  onverwachteFouten: [],
}));

describe('beoordeelProductiekernConcurrencyProef', () => {
  it('accepteert alleen een volledige, teruggerolde en unieke proef', () => {
    expect(beoordeelProductiekernConcurrencyProef(manifest, {
      manifestVersie: 1,
      doelomgeving: 'shadow-acquisitie',
      schemaNaam: 'probe',
      paralleliteit: 4,
      transactieTeruggerold: true,
      productieBenaderd: false,
      scenarios: groeneScenarios,
    })).toEqual({
      geslaagd: true,
      blokkades: [],
      productieMigratieToegestaan: false,
      productieActivatieToegestaan: false,
    });
  });

  it('blokkeert dubbele nummers, ontbrekende scenarios en productiecontact', () => {
    const resultaat = beoordeelProductiekernConcurrencyProef(manifest, {
      manifestVersie: 1,
      doelomgeving: 'shadow-acquisitie',
      schemaNaam: 'probe',
      paralleliteit: 4,
      transactieTeruggerold: true,
      productieBenaderd: true,
      scenarios: [{
        ...groeneScenarios[0],
        dubbeleNummers: 1,
        uniekeResultaten: 3,
      }],
    });

    expect(resultaat.geslaagd).toBe(false);
    expect(resultaat.blokkades).toContain('Concurrencyproef heeft productie benaderd.');
    expect(resultaat.blokkades.some((item) => item.includes('dubbele nummers'))).toBe(true);
    expect(resultaat.blokkades.some((item) => item.includes('Scenario ontbreekt'))).toBe(true);
  });

  it('blokkeert een proef zonder aantoonbare rollback', () => {
    const resultaat = beoordeelProductiekernConcurrencyProef(manifest, {
      manifestVersie: 1,
      doelomgeving: 'shadow-acquisitie',
      schemaNaam: 'probe',
      paralleliteit: 4,
      transactieTeruggerold: false,
      productieBenaderd: false,
      scenarios: groeneScenarios,
    });

    expect(resultaat.geslaagd).toBe(false);
    expect(resultaat.blokkades).toContain('Proeftransactie is niet teruggerold.');
  });
});
