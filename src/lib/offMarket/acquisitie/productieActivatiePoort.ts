export interface ProductieActivatieBewijs {
  actueleDdlGeverifieerd: boolean;
  actueleRlsGeverifieerd: boolean;
  geisoleerdeMigratieproefGroen: boolean;
  concurrencyproefGroen: boolean;
  volledigeTestsuiteGroen: boolean;
  productiebuildGroen: boolean;
  explicietProductieakkoord: boolean;
}

export interface ProductieActivatieBesluit {
  lezenActief: boolean;
  schrijvenActief: boolean;
  ontbrekendBewijs: string[];
}

const BEWIJS_LABELS: Array<[keyof ProductieActivatieBewijs, string]> = [
  ['actueleDdlGeverifieerd', 'Actuele productie-DDL is niet geverifieerd.'],
  ['actueleRlsGeverifieerd', 'Actuele productie-RLS is niet geverifieerd.'],
  ['geisoleerdeMigratieproefGroen', 'Geïsoleerde migratieproef is niet groen.'],
  ['concurrencyproefGroen', 'Concurrencyproef is niet groen.'],
  ['volledigeTestsuiteGroen', 'Volledige testsuite is niet groen.'],
  ['productiebuildGroen', 'Productiebuild is niet groen.'],
  ['explicietProductieakkoord', 'Expliciet productieakkoord ontbreekt.'],
];

/**
 * Centrale fail-closed releasepoort.
 *
 * Lezen en schrijven worden uitsluitend samen geactiveerd wanneer ieder
 * afzonderlijk bewijs expliciet waar is. Ontbrekende configuratie, gedeeltelijk
 * bewijs of een vergeten vlag resulteert dus altijd in uitgeschakelde toegang.
 */
export function bepaalProductieActivatie(
  bewijs: Partial<ProductieActivatieBewijs> | null | undefined,
): ProductieActivatieBesluit {
  const ontbrekendBewijs = BEWIJS_LABELS
    .filter(([sleutel]) => bewijs?.[sleutel] !== true)
    .map(([, label]) => label);

  const actief = ontbrekendBewijs.length === 0;
  return {
    lezenActief: actief,
    schrijvenActief: actief,
    ontbrekendBewijs,
  };
}

export const productiekernStandaardUitgeschakeld = bepaalProductieActivatie(undefined);
