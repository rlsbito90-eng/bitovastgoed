import type { ProductiekernLeesFoutcode } from './productiekernSupabaseLeesFout';
import type { ProductiekernLeesQueryNaam } from './productiekernSupabaseLeesQueryContract';

export type ProductiekernLeesUitkomst = 'gevonden' | 'niet_gevonden' | 'lijst' | 'geblokkeerd' | 'fout';

export interface ProductiekernLeesAuditInput {
  query: ProductiekernLeesQueryNaam;
  uitkomst: ProductiekernLeesUitkomst;
  duurMs: number;
  aantalRecords?: number;
  foutcode?: ProductiekernLeesFoutcode;
}

export interface ProductiekernLeesAuditRecord {
  query: ProductiekernLeesQueryNaam;
  uitkomst: ProductiekernLeesUitkomst;
  duurMs: number;
  aantalRecords: number | null;
  foutcode: ProductiekernLeesFoutcode | null;
  bevatPersoonsgegevens: false;
  bevatFilterwaarde: false;
}

/**
 * Bouwt een metriek-/auditrecord zonder selectie-ID, brief-ID, adres,
 * geadresseerde of andere inhoudelijke waarden.
 */
export function bouwProductiekernLeesAuditRecord(
  input: ProductiekernLeesAuditInput,
): ProductiekernLeesAuditRecord {
  if (!Number.isFinite(input.duurMs) || input.duurMs < 0) {
    throw new Error('Leesduur moet een niet-negatief eindig getal zijn.');
  }
  const aantalRecords = input.aantalRecords ?? null;
  if (aantalRecords !== null && (!Number.isInteger(aantalRecords) || aantalRecords < 0)) {
    throw new Error('Aantal records moet een niet-negatief geheel getal zijn.');
  }
  if (input.uitkomst === 'fout' && !input.foutcode) {
    throw new Error('Een foutuitkomst vereist een genormaliseerde foutcode.');
  }
  if (input.uitkomst !== 'fout' && input.foutcode) {
    throw new Error('Een foutcode is alleen toegestaan bij een foutuitkomst.');
  }

  return {
    query: input.query,
    uitkomst: input.uitkomst,
    duurMs: input.duurMs,
    aantalRecords,
    foutcode: input.foutcode ?? null,
    bevatPersoonsgegevens: false,
    bevatFilterwaarde: false,
  };
}
