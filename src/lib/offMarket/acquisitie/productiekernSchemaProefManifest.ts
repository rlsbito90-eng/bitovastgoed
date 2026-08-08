import type { ProductiekernSchemaProefBesluit } from './productiekernSchemaProefBesluit';

export const PRODUCTIEKERN_SCHEMA_PROEF_BESTANDEN = [
  'supabase/migration-drafts/20260806_acquisitie_productiekern_build_a.sql',
  'supabase/migration-drafts/20260806_acquisitie_productiekern_dossier_briefkern.sql',
  'supabase/migration-drafts/20260806_acquisitie_productiekern_transactionele_functies.sql',
] as const;

export interface ProductiekernSchemaProefManifestInput {
  besluit: ProductiekernSchemaProefBesluit;
  doelomgeving: string;
  schemaNaam: string;
  uitgevoerdDoor: string;
  aangemaaktOp: string;
}

export interface ProductiekernSchemaProefManifest {
  versie: 1;
  modus: 'schema_only_rollback';
  toegestaan: true;
  doelomgeving: string;
  schemaNaam: string;
  uitgevoerdDoor: string;
  aangemaaktOp: string;
  bestanden: readonly string[];
  verbodenHandelingen: readonly string[];
}

export class ProductiekernSchemaProefNietToegestaanError extends Error {
  readonly code = 'ACQUISITIE_PRODUCTIEKERN_SCHEMA_PROEF_NIET_TOEGESTAAN';

  constructor(blokkades: readonly string[]) {
    super(`Schema-only proef niet toegestaan: ${blokkades.join(' | ')}`);
    this.name = 'ProductiekernSchemaProefNietToegestaanError';
  }
}

function vereisNietLeeg(waarde: string, veld: string): string {
  const genormaliseerd = waarde.trim();
  if (!genormaliseerd) {
    throw new Error(`${veld} is verplicht voor het schema-only proefmanifest.`);
  }
  return genormaliseerd;
}

/**
 * Bouwt een deterministisch manifest voor een toekomstige geïsoleerde proef.
 *
 * Het manifest voert niets uit. Alleen een reeds toegestaan proefbesluit kan
 * worden omgezet. De uitvoermodus blijft verplicht rollback-only en verbiedt
 * productie, backfill, grants, activatie en gegevensimport expliciet.
 */
export function bouwProductiekernSchemaProefManifest(
  input: ProductiekernSchemaProefManifestInput,
): ProductiekernSchemaProefManifest {
  if (!input.besluit.toegestaan) {
    throw new ProductiekernSchemaProefNietToegestaanError(input.besluit.blokkades);
  }

  const aangemaaktOp = vereisNietLeeg(input.aangemaaktOp, 'aangemaaktOp');
  if (Number.isNaN(Date.parse(aangemaaktOp))) {
    throw new Error('aangemaaktOp moet een geldige ISO-datum zijn.');
  }

  return {
    versie: 1,
    modus: 'schema_only_rollback',
    toegestaan: true,
    doelomgeving: vereisNietLeeg(input.doelomgeving, 'doelomgeving'),
    schemaNaam: vereisNietLeeg(input.schemaNaam, 'schemaNaam'),
    uitgevoerdDoor: vereisNietLeeg(input.uitgevoerdDoor, 'uitgevoerdDoor'),
    aangemaaktOp,
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
  };
}
