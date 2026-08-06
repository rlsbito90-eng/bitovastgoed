import { describe, expect, it } from 'vitest';

import type { ProductiekernSchemaProefBewijs } from './productiekernSchemaProefBewijs';
import { beoordeelProductiekernSchemaProefBewijsGeldigheid } from './productiekernSchemaProefBewijsGeldigheid';

const bewijs: ProductiekernSchemaProefBewijs = {
  soort: 'geisoleerde_schema_only_rollbackproef',
  geslaagd: true,
  manifestVersie: 1,
  doelomgeving: 'shadow-acquisitie',
  schemaNaam: 'acquisitie_productiekern_proef',
  bestanden: ['a.sql', 'b.sql'],
  vastgesteldOp: '2026-08-06T12:00:00.000Z',
  vastgesteldDoor: 'reviewer',
  verleentProductieactivatie: false,
  verleentWriteActivatie: false,
};

describe('beoordeelProductiekernSchemaProefBewijsGeldigheid', () => {
  it('accepteert recent bewijs voor exact dezelfde proefomgeving', () => {
    expect(beoordeelProductiekernSchemaProefBewijsGeldigheid({
      bewijs,
      verwachtDoelomgeving: 'shadow-acquisitie',
      verwachtSchemaNaam: 'acquisitie_productiekern_proef',
      beoordeeldOp: '2026-08-06T14:00:00.000Z',
      maximaleLeeftijdUren: 24,
    })).toEqual({
      geldig: true,
      leeftijdUren: 2,
      blokkades: [],
    });
  });

  it('weigert verouderd bewijs fail-closed', () => {
    const resultaat = beoordeelProductiekernSchemaProefBewijsGeldigheid({
      bewijs,
      verwachtDoelomgeving: bewijs.doelomgeving,
      verwachtSchemaNaam: bewijs.schemaNaam,
      beoordeeldOp: '2026-08-08T12:00:00.000Z',
      maximaleLeeftijdUren: 24,
    });

    expect(resultaat.geldig).toBe(false);
    expect(resultaat.leeftijdUren).toBe(48);
    expect(resultaat.blokkades[0]).toContain('maximaal 24 uur');
  });

  it('weigert bewijs voor een andere omgeving of ander schema', () => {
    const resultaat = beoordeelProductiekernSchemaProefBewijsGeldigheid({
      bewijs,
      verwachtDoelomgeving: 'productie',
      verwachtSchemaNaam: 'public',
      beoordeeldOp: '2026-08-06T13:00:00.000Z',
      maximaleLeeftijdUren: 24,
    });

    expect(resultaat.geldig).toBe(false);
    expect(resultaat.blokkades).toEqual([
      'De doelomgeving van het proefbewijs wijkt af.',
      'Het proefschema van het bewijs wijkt af.',
    ]);
  });

  it('weigert ongeldige criteria en toekomstig bewijs', () => {
    const resultaat = beoordeelProductiekernSchemaProefBewijsGeldigheid({
      bewijs,
      verwachtDoelomgeving: bewijs.doelomgeving,
      verwachtSchemaNaam: bewijs.schemaNaam,
      beoordeeldOp: '2026-08-06T11:00:00.000Z',
      maximaleLeeftijdUren: 0,
    });

    expect(resultaat.geldig).toBe(false);
    expect(resultaat.blokkades).toContain(
      'De maximale bewijsleeftijd moet groter dan nul zijn.',
    );
  });
});
