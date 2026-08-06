import { describe, expect, it } from 'vitest';

import type { ProductiekernSchemaProefManifest } from './productiekernSchemaProefManifest';
import {
  beoordeelProductiekernSchemaProefResultaat,
  type ProductiekernSchemaProefWaarneming,
} from './productiekernSchemaProefResultaat';

const manifest: ProductiekernSchemaProefManifest = {
  versie: 1,
  modus: 'schema_only_rollback',
  toegestaan: true,
  doelomgeving: 'geisoleerde-proef',
  schemaNaam: 'acquisitie_productiekern_proef',
  uitgevoerdDoor: 'ci-schema-probe',
  aangemaaktOp: '2026-08-06T13:30:00.000Z',
  bestanden: [
    'supabase/migration-drafts/20260806_acquisitie_productiekern_build_a.sql',
    'supabase/migration-drafts/20260806_acquisitie_productiekern_dossier_briefkern.sql',
    'supabase/migration-drafts/20260806_acquisitie_productiekern_transactionele_functies.sql',
  ],
  verbodenHandelingen: [
    'productie_benaderen',
    'gegevens_importeren',
    'backfill_uitvoeren',
    'grants_toevoegen',
    'rls_verruimen',
    'featureflag_activeren',
    'commit_transactie',
  ],
};

const veiligeWaarneming: ProductiekernSchemaProefWaarneming = {
  manifestVersie: 1,
  modus: 'schema_only_rollback',
  doelomgeving: 'geisoleerde-proef',
  schemaNaam: 'acquisitie_productiekern_proef',
  uitgevoerdeBestanden: manifest.bestanden,
  transactieTeruggerold: true,
  productieBenaderd: false,
  gegevensGeimporteerd: false,
  grantsToegevoegd: false,
  rlsVerruimd: false,
  featureflagGeactiveerd: false,
  fouten: [],
};

describe('beoordeelProductiekernSchemaProefResultaat', () => {
  it('accepteert uitsluitend een exacte, foutloze rollbackwaarneming', () => {
    expect(beoordeelProductiekernSchemaProefResultaat(manifest, veiligeWaarneming)).toEqual({
      geslaagd: true,
      blokkades: [],
    });
  });

  it('weigert afwijkende bestandsvolgorde en ontbrekende rollback', () => {
    const resultaat = beoordeelProductiekernSchemaProefResultaat(manifest, {
      ...veiligeWaarneming,
      uitgevoerdeBestanden: [...manifest.bestanden].reverse(),
      transactieTeruggerold: false,
    });

    expect(resultaat.geslaagd).toBe(false);
    expect(resultaat.blokkades).toEqual([
      'De SQL-drafts zijn niet exact in de vastgelegde volgorde uitgevoerd.',
      'De schema-only proeftransactie is niet aantoonbaar teruggerold.',
    ]);
  });

  it('weigert iedere verboden nevenwerking', () => {
    const resultaat = beoordeelProductiekernSchemaProefResultaat(manifest, {
      ...veiligeWaarneming,
      productieBenaderd: true,
      gegevensGeimporteerd: true,
      grantsToegevoegd: true,
      rlsVerruimd: true,
      featureflagGeactiveerd: true,
    });

    expect(resultaat.geslaagd).toBe(false);
    expect(resultaat.blokkades).toHaveLength(5);
  });

  it('behandelt gerapporteerde fouten altijd als blokkade', () => {
    const resultaat = beoordeelProductiekernSchemaProefResultaat(manifest, {
      ...veiligeWaarneming,
      fouten: ['constraint bestaat al', 'type mismatch'],
    });

    expect(resultaat).toEqual({
      geslaagd: false,
      blokkades: [
        'De proef rapporteerde fouten: constraint bestaat al | type mismatch',
      ],
    });
  });
});
