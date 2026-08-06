import { describe, expect, it } from 'vitest';

import {
  bouwProductiekernSchemaProefManifest,
  ProductiekernSchemaProefNietToegestaanError,
  PRODUCTIEKERN_SCHEMA_PROEF_BESTANDEN,
} from './productiekernSchemaProefManifest';

const toegestaanBesluit = {
  toegestaan: true,
  blokkades: [],
};

describe('bouwProductiekernSchemaProefManifest', () => {
  it('bouwt uitsluitend bij een toegestaan besluit een rollback-only manifest', () => {
    const manifest = bouwProductiekernSchemaProefManifest({
      besluit: toegestaanBesluit,
      doelomgeving: 'geisoleerde-testdatabase',
      schemaNaam: 'acquisitie_productiekern_probe',
      uitgevoerdDoor: 'ci-schema-probe',
      aangemaaktOp: '2026-08-06T13:30:00.000Z',
    });

    expect(manifest).toEqual({
      versie: 1,
      modus: 'schema_only_rollback',
      toegestaan: true,
      doelomgeving: 'geisoleerde-testdatabase',
      schemaNaam: 'acquisitie_productiekern_probe',
      uitgevoerdDoor: 'ci-schema-probe',
      aangemaaktOp: '2026-08-06T13:30:00.000Z',
      bestanden: PRODUCTIEKERN_SCHEMA_PROEF_BESTANDEN,
      verbodenHandelingen: [
        'productie_benaderen',
        'gegevens_importeren',
        'backfill_uitvoeren',
        'grants_toevoegen',
        'rls_verruimen',
        'featureflag_activeren',
        'commit_transactie',
      ],
    });
  });

  it('weigert een manifest wanneer het proefbesluit blokkades bevat', () => {
    expect(() =>
      bouwProductiekernSchemaProefManifest({
        besluit: {
          toegestaan: false,
          blokkades: ['Actuele productie-DDL is niet read-only geverifieerd.'],
        },
        doelomgeving: 'test',
        schemaNaam: 'probe',
        uitgevoerdDoor: 'ci',
        aangemaaktOp: '2026-08-06T13:30:00.000Z',
      })
    ).toThrow(ProductiekernSchemaProefNietToegestaanError);
  });

  it('weigert ontbrekende identificatie en ongeldige datumwaarden', () => {
    expect(() =>
      bouwProductiekernSchemaProefManifest({
        besluit: toegestaanBesluit,
        doelomgeving: '   ',
        schemaNaam: 'probe',
        uitgevoerdDoor: 'ci',
        aangemaaktOp: '2026-08-06T13:30:00.000Z',
      })
    ).toThrow('doelomgeving is verplicht');

    expect(() =>
      bouwProductiekernSchemaProefManifest({
        besluit: toegestaanBesluit,
        doelomgeving: 'test',
        schemaNaam: 'probe',
        uitgevoerdDoor: 'ci',
        aangemaaktOp: 'geen-datum',
      })
    ).toThrow('geldige ISO-datum');
  });

  it('behoudt een vaste en controleerbare uitvoervolgorde', () => {
    expect(PRODUCTIEKERN_SCHEMA_PROEF_BESTANDEN).toEqual([
      'supabase/migration-drafts/20260806_acquisitie_productiekern_build_a.sql',
      'supabase/migration-drafts/20260806_acquisitie_productiekern_dossier_briefkern.sql',
      'supabase/migration-drafts/20260806_acquisitie_productiekern_transactionele_functies.sql',
    ]);
  });
});
