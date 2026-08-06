import { describe, expect, it } from 'vitest';

import type { ProductiekernSchemaProefManifest } from './productiekernSchemaProefManifest';
import {
  legProductiekernSchemaProefBewijsVast,
  ProductiekernSchemaProefBewijsNietBeschikbaarError,
} from './productiekernSchemaProefBewijs';

const manifest: ProductiekernSchemaProefManifest = {
  versie: 1,
  modus: 'schema_only_rollback',
  toegestaan: true,
  doelomgeving: 'isolated-shadow',
  schemaNaam: 'acquisitie_productiekern_probe',
  uitgevoerdDoor: 'ci-probe',
  aangemaaktOp: '2026-08-06T13:00:00.000Z',
  bestanden: [
    'supabase/migration-drafts/20260806_acquisitie_productiekern_build_a.sql',
    'supabase/migration-drafts/20260806_acquisitie_productiekern_dossier_briefkern.sql',
    'supabase/migration-drafts/20260806_acquisitie_productiekern_transactionele_functies.sql',
  ],
  verbodenHandelingen: ['productie_benaderen', 'commit_transactie'],
};

describe('legProductiekernSchemaProefBewijsVast', () => {
  it('legt uitsluitend een geslaagde rollbackproef als smal bewijs vast', () => {
    expect(legProductiekernSchemaProefBewijsVast(
      manifest,
      { geslaagd: true, blokkades: [] },
      '2026-08-06T13:30:00.000Z',
      'schema-reviewer',
    )).toEqual({
      soort: 'geisoleerde_schema_only_rollbackproef',
      geslaagd: true,
      manifestVersie: 1,
      doelomgeving: 'isolated-shadow',
      schemaNaam: 'acquisitie_productiekern_probe',
      bestanden: manifest.bestanden,
      vastgesteldOp: '2026-08-06T13:30:00.000Z',
      vastgesteldDoor: 'schema-reviewer',
      verleentProductieactivatie: false,
      verleentWriteActivatie: false,
    });
  });

  it('weigert bewijs wanneer de proef niet geslaagd is', () => {
    expect(() => legProductiekernSchemaProefBewijsVast(
      manifest,
      { geslaagd: false, blokkades: ['Rollback ontbreekt.'] },
      '2026-08-06T13:30:00.000Z',
      'schema-reviewer',
    )).toThrow(ProductiekernSchemaProefBewijsNietBeschikbaarError);
  });

  it('vereist een geldige datum en een expliciete vaststeller', () => {
    expect(() => legProductiekernSchemaProefBewijsVast(
      manifest,
      { geslaagd: true, blokkades: [] },
      'geen-datum',
      'schema-reviewer',
    )).toThrow('vastgesteldOp moet een geldige ISO-datum zijn.');

    expect(() => legProductiekernSchemaProefBewijsVast(
      manifest,
      { geslaagd: true, blokkades: [] },
      '2026-08-06T13:30:00.000Z',
      '   ',
    )).toThrow('vastgesteldDoor is verplicht');
  });
});
