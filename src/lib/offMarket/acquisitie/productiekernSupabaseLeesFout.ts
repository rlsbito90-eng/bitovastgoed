export type ProductiekernLeesFoutcode =
  | 'niet_geautoriseerd'
  | 'record_niet_uniek'
  | 'schema_niet_beschikbaar'
  | 'leesbudget_overschreden'
  | 'transport_tijdelijk_onbeschikbaar'
  | 'onbekende_leesfout';

export interface ProductiekernLeesFout {
  code: ProductiekernLeesFoutcode;
  herstelbaar: boolean;
  publiekeMelding: string;
}

interface MogelijkeTransportfout {
  code?: unknown;
  status?: unknown;
}

/**
 * Normaliseert uitsluitend technische foutcategorieën. Ruwe databaseberichten,
 * SQL, tabelinhoud en persoonsgegevens worden nooit doorgegeven.
 */
export function normaliseerProductiekernLeesFout(error: unknown): ProductiekernLeesFout {
  const kandidaat = error && typeof error === 'object'
    ? error as MogelijkeTransportfout
    : {};
  const code = typeof kandidaat.code === 'string' ? kandidaat.code : '';
  const status = typeof kandidaat.status === 'number' ? kandidaat.status : null;

  if (status === 401 || status === 403 || code === '42501') {
    return {
      code: 'niet_geautoriseerd',
      herstelbaar: false,
      publiekeMelding: 'De productiekern-read is niet geautoriseerd.',
    };
  }
  if (code === 'PGRST116' || code === '21000') {
    return {
      code: 'record_niet_uniek',
      herstelbaar: false,
      publiekeMelding: 'De productiekern-read leverde geen unieke uitkomst.',
    };
  }
  if (code === '42P01' || code === '42703') {
    return {
      code: 'schema_niet_beschikbaar',
      herstelbaar: false,
      publiekeMelding: 'Het geverifieerde productiekernschema is niet beschikbaar.',
    };
  }
  if (code === 'ACQUISITIE_PRODUCTIEKERN_LEESBUDGET_OVERSCHREDEN') {
    return {
      code: 'leesbudget_overschreden',
      herstelbaar: false,
      publiekeMelding: 'Het begrensde productiekern-leesbudget is overschreden.',
    };
  }
  if (status === 408 || status === 429 || (status !== null && status >= 500)) {
    return {
      code: 'transport_tijdelijk_onbeschikbaar',
      herstelbaar: true,
      publiekeMelding: 'De productiekern-read is tijdelijk niet beschikbaar.',
    };
  }
  return {
    code: 'onbekende_leesfout',
    herstelbaar: false,
    publiekeMelding: 'De productiekern-read is veilig afgebroken.',
  };
}
