import type { ProductiekernSchemaDekking } from './productiekernSchemaDekking';

export interface ProductiekernSchemaProefBewijs {
  schemaDekking: ProductiekernSchemaDekking;
  actueleProductieDdlReadOnlyGeverifieerd: boolean;
  actueleProductieRlsReadOnlyGeverifieerd: boolean;
  kolomtypenEnNullabilityVergeleken: boolean;
  constraintnamenGecontroleerd: boolean;
  rollbackplanBeoordeeld: boolean;
  explicietProefakkoord: boolean;
}

export interface ProductiekernSchemaProefBesluit {
  toegestaan: boolean;
  blokkades: string[];
}

/**
 * Beslist uitsluitend of een geïsoleerde schema-only proef voorbereid mag
 * worden. Dit past geen SQL toe en verleent geen rechten.
 */
export function beoordeelProductiekernSchemaProef(
  bewijs: ProductiekernSchemaProefBewijs,
): ProductiekernSchemaProefBesluit {
  const blokkades: string[] = [];

  if (!bewijs.schemaDekking.volledig) {
    blokkades.push(
      `Minimale schemaonderdelen ontbreken: ${bewijs.schemaDekking.ontbrekend.join(', ') || 'onbekend'}.`,
    );
  }
  if (!bewijs.actueleProductieDdlReadOnlyGeverifieerd) {
    blokkades.push('Actuele productie-DDL is niet read-only geverifieerd.');
  }
  if (!bewijs.actueleProductieRlsReadOnlyGeverifieerd) {
    blokkades.push('Actuele productie-RLS is niet read-only geverifieerd.');
  }
  if (!bewijs.kolomtypenEnNullabilityVergeleken) {
    blokkades.push('Kolomtypen en nullability zijn niet vergeleken.');
  }
  if (!bewijs.constraintnamenGecontroleerd) {
    blokkades.push('Bestaande constraint- en indexnamen zijn niet gecontroleerd.');
  }
  if (!bewijs.rollbackplanBeoordeeld) {
    blokkades.push('Het rollbackplan is niet beoordeeld.');
  }
  if (!bewijs.explicietProefakkoord) {
    blokkades.push('Expliciet akkoord voor een geïsoleerde schema-only proef ontbreekt.');
  }

  return {
    toegestaan: blokkades.length === 0,
    blokkades,
  };
}
