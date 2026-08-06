import type { ProductiekernSchemaProefManifest } from './productiekernSchemaProefManifest';
import type { ProductiekernSchemaProefResultaat } from './productiekernSchemaProefResultaat';

export interface ProductiekernSchemaProefBewijs {
  soort: 'geisoleerde_schema_only_rollbackproef';
  geslaagd: true;
  manifestVersie: number;
  doelomgeving: string;
  schemaNaam: string;
  bestanden: readonly string[];
  vastgesteldOp: string;
  vastgesteldDoor: string;
  verleentProductieactivatie: false;
  verleentWriteActivatie: false;
}

export class ProductiekernSchemaProefBewijsNietBeschikbaarError extends Error {
  readonly code = 'ACQUISITIE_PRODUCTIEKERN_SCHEMA_PROEF_BEWIJS_NIET_BESCHIKBAAR';

  constructor(blokkades: readonly string[]) {
    super(`Geen schema-only proefbewijs beschikbaar: ${blokkades.join(' | ')}`);
    this.name = 'ProductiekernSchemaProefBewijsNietBeschikbaarError';
  }
}

function vereisWaarde(waarde: string, veld: string): string {
  const resultaat = waarde.trim();
  if (!resultaat) {
    throw new Error(`${veld} is verplicht voor het schema-only proefbewijs.`);
  }
  return resultaat;
}

/**
 * Legt een geslaagde, geïsoleerde rollbackproef vast als smal bewijsartefact.
 *
 * Dit bewijs kan uitsluitend aantonen dat de schema-only proef geslaagd is.
 * Het verleent nooit lees-, write- of productieactivatie en vervangt geen
 * actuele DDL/RLS-verificatie, concurrencyproef of expliciet productieakkoord.
 */
export function legProductiekernSchemaProefBewijsVast(
  manifest: ProductiekernSchemaProefManifest,
  resultaat: ProductiekernSchemaProefResultaat,
  vastgesteldOp: string,
  vastgesteldDoor: string,
): ProductiekernSchemaProefBewijs {
  if (!resultaat.geslaagd) {
    throw new ProductiekernSchemaProefBewijsNietBeschikbaarError(resultaat.blokkades);
  }

  const datum = vereisWaarde(vastgesteldOp, 'vastgesteldOp');
  if (Number.isNaN(Date.parse(datum))) {
    throw new Error('vastgesteldOp moet een geldige ISO-datum zijn.');
  }

  return {
    soort: 'geisoleerde_schema_only_rollbackproef',
    geslaagd: true,
    manifestVersie: manifest.versie,
    doelomgeving: manifest.doelomgeving,
    schemaNaam: manifest.schemaNaam,
    bestanden: manifest.bestanden,
    vastgesteldOp: datum,
    vastgesteldDoor: vereisWaarde(vastgesteldDoor, 'vastgesteldDoor'),
    verleentProductieactivatie: false,
    verleentWriteActivatie: false,
  };
}
