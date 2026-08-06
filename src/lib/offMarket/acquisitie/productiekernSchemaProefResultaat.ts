import type { ProductiekernSchemaProefManifest } from './productiekernSchemaProefManifest';

export interface ProductiekernSchemaProefWaarneming {
  manifestVersie: number;
  modus: string;
  doelomgeving: string;
  schemaNaam: string;
  uitgevoerdeBestanden: readonly string[];
  transactieTeruggerold: boolean;
  productieBenaderd: boolean;
  gegevensGeimporteerd: boolean;
  grantsToegevoegd: boolean;
  rlsVerruimd: boolean;
  featureflagGeactiveerd: boolean;
  fouten: readonly string[];
}

export interface ProductiekernSchemaProefResultaat {
  geslaagd: boolean;
  blokkades: string[];
}

/**
 * Beoordeelt uitsluitend het bewijsresultaat van een uitgevoerde schema-only
 * rollbackproef tegen het vooraf vastgelegde manifest.
 *
 * Een ontbrekende, afwijkende of onveilige waarneming blijft fail-closed. Deze
 * functie activeert niets en vormt geen productieakkoord.
 */
export function beoordeelProductiekernSchemaProefResultaat(
  manifest: ProductiekernSchemaProefManifest,
  waarneming: ProductiekernSchemaProefWaarneming,
): ProductiekernSchemaProefResultaat {
  const blokkades: string[] = [];

  if (waarneming.manifestVersie !== manifest.versie) {
    blokkades.push('De manifestversie van de proefwaarneming wijkt af.');
  }
  if (waarneming.modus !== manifest.modus) {
    blokkades.push('De proef is niet in de verplichte schema-only rollbackmodus uitgevoerd.');
  }
  if (waarneming.doelomgeving !== manifest.doelomgeving) {
    blokkades.push('De waargenomen doelomgeving wijkt af van het manifest.');
  }
  if (waarneming.schemaNaam !== manifest.schemaNaam) {
    blokkades.push('Het waargenomen proefschema wijkt af van het manifest.');
  }
  if (
    waarneming.uitgevoerdeBestanden.length !== manifest.bestanden.length
    || waarneming.uitgevoerdeBestanden.some(
      (bestand, index) => bestand !== manifest.bestanden[index],
    )
  ) {
    blokkades.push('De SQL-drafts zijn niet exact in de vastgelegde volgorde uitgevoerd.');
  }
  if (!waarneming.transactieTeruggerold) {
    blokkades.push('De schema-only proeftransactie is niet aantoonbaar teruggerold.');
  }
  if (waarneming.productieBenaderd) {
    blokkades.push('De proef heeft productie benaderd.');
  }
  if (waarneming.gegevensGeimporteerd) {
    blokkades.push('De proef heeft gegevens geïmporteerd.');
  }
  if (waarneming.grantsToegevoegd) {
    blokkades.push('De proef heeft grants toegevoegd.');
  }
  if (waarneming.rlsVerruimd) {
    blokkades.push('De proef heeft RLS verruimd.');
  }
  if (waarneming.featureflagGeactiveerd) {
    blokkades.push('De proef heeft een featureflag geactiveerd.');
  }
  if (waarneming.fouten.length > 0) {
    blokkades.push(`De proef rapporteerde fouten: ${waarneming.fouten.join(' | ')}`);
  }

  return {
    geslaagd: blokkades.length === 0,
    blokkades,
  };
}
