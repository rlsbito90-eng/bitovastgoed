import type { ProductiekernVolgendeStapBesluit } from './productiekernVolgendeStapBesluit';

export const PRODUCTIEKERN_CONCURRENCY_SCENARIOS = [
  'briefnummer_parallel_reserveren',
  'batchnummer_parallel_reserveren',
  'brief_definitief_idempotente_retry',
  'batchdocumenten_optimistic_lock',
  'batch_geprint_dubbele_aanroep',
  'brief_gepost_dubbele_aanroep',
] as const;

export type ProductiekernConcurrencyScenario =
  typeof PRODUCTIEKERN_CONCURRENCY_SCENARIOS[number];

export interface ProductiekernConcurrencyProefManifestInput {
  besluit: ProductiekernVolgendeStapBesluit;
  doelomgeving: string;
  schemaNaam: string;
  paralleliteit: number;
  aangemaaktOp: string;
  aangemaaktDoor: string;
}

export interface ProductiekernConcurrencyProefManifest {
  versie: 1;
  modus: 'geisoleerd_rollback_only';
  doelomgeving: string;
  schemaNaam: string;
  paralleliteit: number;
  scenarios: readonly ProductiekernConcurrencyScenario[];
  aangemaaktOp: string;
  aangemaaktDoor: string;
  productieMigratieToegestaan: false;
  productieActivatieToegestaan: false;
}

export class ProductiekernConcurrencyProefNietToegestaanError extends Error {
  readonly code = 'ACQUISITIE_PRODUCTIEKERN_CONCURRENCY_PROEF_NIET_TOEGESTAAN';

  constructor(blokkades: readonly string[]) {
    super(`Concurrencyproef niet toegestaan: ${blokkades.join(' | ')}`);
    this.name = 'ProductiekernConcurrencyProefNietToegestaanError';
  }
}

function verplicht(waarde: string, veld: string): string {
  const resultaat = waarde.trim();
  if (!resultaat) throw new Error(`${veld} is verplicht.`);
  return resultaat;
}

export function bouwProductiekernConcurrencyProefManifest(
  input: ProductiekernConcurrencyProefManifestInput,
): ProductiekernConcurrencyProefManifest {
  if (!input.besluit.concurrencyProefVoorbereiden) {
    throw new ProductiekernConcurrencyProefNietToegestaanError(input.besluit.blokkades);
  }
  if (!Number.isInteger(input.paralleliteit) || input.paralleliteit < 2 || input.paralleliteit > 50) {
    throw new Error('paralleliteit moet een geheel getal tussen 2 en 50 zijn.');
  }
  const aangemaaktOp = verplicht(input.aangemaaktOp, 'aangemaaktOp');
  if (Number.isNaN(Date.parse(aangemaaktOp))) {
    throw new Error('aangemaaktOp moet een geldige ISO-datum zijn.');
  }

  return {
    versie: 1,
    modus: 'geisoleerd_rollback_only',
    doelomgeving: verplicht(input.doelomgeving, 'doelomgeving'),
    schemaNaam: verplicht(input.schemaNaam, 'schemaNaam'),
    paralleliteit: input.paralleliteit,
    scenarios: PRODUCTIEKERN_CONCURRENCY_SCENARIOS,
    aangemaaktOp,
    aangemaaktDoor: verplicht(input.aangemaaktDoor, 'aangemaaktDoor'),
    productieMigratieToegestaan: false,
    productieActivatieToegestaan: false,
  };
}
