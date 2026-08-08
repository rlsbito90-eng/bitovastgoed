import type { ProductiekernSchemaProefBewijsGeldigheid } from './productiekernSchemaProefBewijsGeldigheid';

export interface ProductiekernVolgendeStapBewijs {
  schemaProefBewijs: ProductiekernSchemaProefBewijsGeldigheid;
  actueleProductieDdlReadOnlyGeverifieerd: boolean;
  actueleProductieRlsReadOnlyGeverifieerd: boolean;
  sqlConceptNaVerificatieBijgewerkt: boolean;
  gerichteTypecheckGroen: boolean;
  gerichteTestsGroen: boolean;
  productiebuildGroen: boolean;
  explicietAkkoordVoorConcurrencyProef: boolean;
}

export interface ProductiekernVolgendeStapBesluit {
  concurrencyProefVoorbereiden: boolean;
  productieMigratieToegestaan: false;
  productieActivatieToegestaan: false;
  blokkades: string[];
}

/**
 * Beslist uitsluitend of een afzonderlijke, geïsoleerde concurrencyproef mag
 * worden voorbereid. Dit is nadrukkelijk geen toestemming om SQL toe te passen,
 * productie te benaderen, rechten te wijzigen of functionaliteit te activeren.
 */
export function beoordeelProductiekernVolgendeStap(
  bewijs: ProductiekernVolgendeStapBewijs,
): ProductiekernVolgendeStapBesluit {
  const blokkades: string[] = [];

  if (!bewijs.schemaProefBewijs.geldig) {
    blokkades.push(
      ...bewijs.schemaProefBewijs.blokkades.map(
        (blokkade) => `Schema-only proefbewijs: ${blokkade}`,
      ),
    );
  }
  if (!bewijs.actueleProductieDdlReadOnlyGeverifieerd) {
    blokkades.push('Actuele productie-DDL is niet read-only geverifieerd.');
  }
  if (!bewijs.actueleProductieRlsReadOnlyGeverifieerd) {
    blokkades.push('Actuele productie-RLS is niet read-only geverifieerd.');
  }
  if (!bewijs.sqlConceptNaVerificatieBijgewerkt) {
    blokkades.push('Het SQL-concept is nog niet bijgewerkt na de actuele verificatie.');
  }
  if (!bewijs.gerichteTypecheckGroen) {
    blokkades.push('De gerichte typecheck is niet groen.');
  }
  if (!bewijs.gerichteTestsGroen) {
    blokkades.push('De gerichte productiekern-tests zijn niet groen.');
  }
  if (!bewijs.productiebuildGroen) {
    blokkades.push('De productiebuild is niet groen.');
  }
  if (!bewijs.explicietAkkoordVoorConcurrencyProef) {
    blokkades.push('Expliciet akkoord voor de geïsoleerde concurrencyproef ontbreekt.');
  }

  return {
    concurrencyProefVoorbereiden: blokkades.length === 0,
    productieMigratieToegestaan: false,
    productieActivatieToegestaan: false,
    blokkades,
  };
}
