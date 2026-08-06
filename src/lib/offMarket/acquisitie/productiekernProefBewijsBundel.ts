import type { ProductiekernSchemaProefBewijsGeldigheid } from './productiekernSchemaProefBewijsGeldigheid';
import type { ProductiekernConcurrencyProefBewijsGeldigheid } from './productiekernConcurrencyProefBewijsGeldigheid';

export interface ProductiekernProefBewijsBundelInput {
  schemaBewijs: ProductiekernSchemaProefBewijsGeldigheid;
  concurrencyBewijs: ProductiekernConcurrencyProefBewijsGeldigheid;
  zelfdeDoelomgeving: boolean;
  zelfdeSchemaBasis: boolean;
}

export interface ProductiekernProefBewijsBundel {
  volledig: boolean;
  blokkades: string[];
  verleentProductieMigratie: false;
  verleentProductieActivatie: false;
}

export function bundelProductiekernProefBewijs(
  input: ProductiekernProefBewijsBundelInput,
): ProductiekernProefBewijsBundel {
  const blokkades: string[] = [];
  if (!input.schemaBewijs.geldig) {
    blokkades.push(...input.schemaBewijs.blokkades.map((b) => `Schema-proefbewijs: ${b}`));
  }
  if (!input.concurrencyBewijs.geldig) {
    blokkades.push(...input.concurrencyBewijs.blokkades.map((b) => `Concurrencyproefbewijs: ${b}`));
  }
  if (!input.zelfdeDoelomgeving) {
    blokkades.push('Schema- en concurrencyproef zijn niet op dezelfde doelomgeving uitgevoerd.');
  }
  if (!input.zelfdeSchemaBasis) {
    blokkades.push('Schema- en concurrencyproef zijn niet op dezelfde schemabasis uitgevoerd.');
  }

  return {
    volledig: blokkades.length === 0,
    blokkades,
    verleentProductieMigratie: false,
    verleentProductieActivatie: false,
  };
}
