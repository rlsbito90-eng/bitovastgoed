import type { ProductiekernConcurrencyProefManifest } from './productiekernConcurrencyProefManifest';
import type { ProductiekernConcurrencyProefResultaat } from './productiekernConcurrencyProefResultaat';

export interface ProductiekernConcurrencyProefBewijs {
  soort: 'geisoleerde_concurrency_rollbackproef';
  geslaagd: true;
  manifestVersie: number;
  doelomgeving: string;
  schemaNaam: string;
  paralleliteit: number;
  scenarios: readonly string[];
  vastgesteldOp: string;
  vastgesteldDoor: string;
  verleentProductieMigratie: false;
  verleentProductieActivatie: false;
}

export class ProductiekernConcurrencyProefBewijsNietBeschikbaarError extends Error {
  readonly code = 'ACQUISITIE_PRODUCTIEKERN_CONCURRENCY_PROEF_BEWIJS_NIET_BESCHIKBAAR';

  constructor(blokkades: readonly string[]) {
    super(`Geen concurrencyproefbewijs beschikbaar: ${blokkades.join(' | ')}`);
    this.name = 'ProductiekernConcurrencyProefBewijsNietBeschikbaarError';
  }
}

export function legProductiekernConcurrencyProefBewijsVast(
  manifest: ProductiekernConcurrencyProefManifest,
  resultaat: ProductiekernConcurrencyProefResultaat,
  vastgesteldOp: string,
  vastgesteldDoor: string,
): ProductiekernConcurrencyProefBewijs {
  if (!resultaat.geslaagd) {
    throw new ProductiekernConcurrencyProefBewijsNietBeschikbaarError(resultaat.blokkades);
  }
  const datum = vastgesteldOp.trim();
  const actor = vastgesteldDoor.trim();
  if (!datum || Number.isNaN(Date.parse(datum))) {
    throw new Error('vastgesteldOp moet een geldige ISO-datum zijn.');
  }
  if (!actor) throw new Error('vastgesteldDoor is verplicht.');

  return {
    soort: 'geisoleerde_concurrency_rollbackproef',
    geslaagd: true,
    manifestVersie: manifest.versie,
    doelomgeving: manifest.doelomgeving,
    schemaNaam: manifest.schemaNaam,
    paralleliteit: manifest.paralleliteit,
    scenarios: manifest.scenarios,
    vastgesteldOp: datum,
    vastgesteldDoor: actor,
    verleentProductieMigratie: false,
    verleentProductieActivatie: false,
  };
}
