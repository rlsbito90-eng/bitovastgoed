import type { ProductiekernLeesActivatieBesluit } from './productiekernLeesActivatieBesluit';

export interface ProductieLeesActivatieBewijs {
  actueleDdlGeverifieerd: boolean;
  actueleRlsGeverifieerd: boolean;
  geisoleerdeMigratieproefGroen: boolean;
  gerichteReadmodelTestsGroen: boolean;
  productiebuildGroen: boolean;
  explicietLeesakkoord: boolean;
}

export type ProductieLeesActivatieBesluit = ProductiekernLeesActivatieBesluit;

const LEESBEWIJS_LABELS: Array<[keyof ProductieLeesActivatieBewijs, string]> = [
  ['actueleDdlGeverifieerd', 'Actuele productie-DDL is niet geverifieerd.'],
  ['actueleRlsGeverifieerd', 'Actuele productie-RLS is niet geverifieerd.'],
  ['geisoleerdeMigratieproefGroen', 'Geïsoleerde migratieproef is niet groen.'],
  ['gerichteReadmodelTestsGroen', 'Gerichte readmodeltests zijn niet groen.'],
  ['productiebuildGroen', 'Productiebuild is niet groen.'],
  ['explicietLeesakkoord', 'Expliciet akkoord voor productiekern-lezen ontbreekt.'],
];

/**
 * Afzonderlijke fail-closed poort voor een latere read-only dual-readfase.
 *
 * Deze poort activeert nooit schrijven. Zij maakt het mogelijk om de nieuwe
 * productiekern eerst uitsluitend te vergelijken met legacydata, nadat de
 * actuele databasecontracten en de geïsoleerde proef aantoonbaar groen zijn.
 */
export function bepaalProductieLeesActivatie(
  bewijs: Partial<ProductieLeesActivatieBewijs> | null | undefined,
): ProductieLeesActivatieBesluit {
  const ontbrekendBewijs = LEESBEWIJS_LABELS
    .filter(([sleutel]) => bewijs?.[sleutel] !== true)
    .map(([, label]) => label);

  return {
    lezenActief: ontbrekendBewijs.length === 0,
    ontbrekendBewijs,
  };
}

export const productiekernLezenStandaardUitgeschakeld =
  bepaalProductieLeesActivatie(undefined);
