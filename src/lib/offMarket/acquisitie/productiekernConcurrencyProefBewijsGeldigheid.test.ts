import { describe, expect, it } from 'vitest';
import { beoordeelProductiekernConcurrencyProefBewijsGeldigheid } from './productiekernConcurrencyProefBewijsGeldigheid';

const bewijs = {
  soort: 'geisoleerde_concurrency_rollbackproef' as const,
  geslaagd: true as const,
  manifestVersie: 1,
  doelomgeving: 'shadow',
  schemaNaam: 'acquisitie_proef',
  paralleliteit: 8,
  scenarios: ['parallelle_briefnummeruitgifte'],
  vastgesteldOp: '2026-08-06T12:00:00.000Z',
  vastgesteldDoor: 'tester',
  verleentProductieMigratie: false as const,
  verleentProductieActivatie: false as const,
};

describe('concurrencyproefbewijs geldigheid', () => {
  it('accepteert actueel bewijs voor exact dezelfde omgeving', () => {
    expect(beoordeelProductiekernConcurrencyProefBewijsGeldigheid({
      bewijs,
      verwachtDoelomgeving: 'shadow',
      verwachtSchemaNaam: 'acquisitie_proef',
      beoordeeldOp: '2026-08-06T14:00:00.000Z',
      maximaleLeeftijdUren: 24,
    })).toEqual({ geldig: true, leeftijdUren: 2, blokkades: [] });
  });

  it('blokkeert oud bewijs en omgevingsdrift', () => {
    const resultaat = beoordeelProductiekernConcurrencyProefBewijsGeldigheid({
      bewijs,
      verwachtDoelomgeving: 'andere-shadow',
      verwachtSchemaNaam: 'ander_schema',
      beoordeeldOp: '2026-08-08T12:00:00.000Z',
      maximaleLeeftijdUren: 24,
    });
    expect(resultaat.geldig).toBe(false);
    expect(resultaat.blokkades).toHaveLength(3);
  });

  it('blijft fail-closed bij ongeldige tijden of grens', () => {
    const resultaat = beoordeelProductiekernConcurrencyProefBewijsGeldigheid({
      bewijs: { ...bewijs, vastgesteldOp: 'ongeldig' },
      verwachtDoelomgeving: 'shadow',
      verwachtSchemaNaam: 'acquisitie_proef',
      beoordeeldOp: 'ongeldig',
      maximaleLeeftijdUren: 0,
    });
    expect(resultaat.geldig).toBe(false);
    expect(resultaat.leeftijdUren).toBeNull();
  });
});
