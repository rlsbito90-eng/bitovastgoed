export type ProductiekernSchemaOnderdeel =
  | 'acquisitiedossier'
  | 'briefkern'
  | 'briefversies'
  | 'printbatches'
  | 'batchbrieven'
  | 'batchdocumenten'
  | 'productieaudit'
  | 'nummerreeksen';

export interface ProductiekernSchemaDekking {
  aanwezig: ProductiekernSchemaOnderdeel[];
  ontbrekend: ProductiekernSchemaOnderdeel[];
  volledig: boolean;
}

const PATRONEN: Record<ProductiekernSchemaOnderdeel, RegExp[]> = {
  acquisitiedossier: [
    /create\s+table\s+(?:if\s+not\s+exists\s+)?public\.off_market_acquisitie_dossiers\b/i,
    /\bselectie_id\b/i,
    /\bsignaal_id\b/i,
    /\bprimaire_werkbak\b/i,
  ],
  briefkern: [
    /create\s+table\s+(?:if\s+not\s+exists\s+)?public\.off_market_productie_brieven\b/i,
    /\bbriefnummer\b/i,
    /\bactieve_versie\b/i,
  ],
  briefversies: [
    /create\s+table\s+(?:if\s+not\s+exists\s+)?public\.off_market_brief_versies\b/i,
  ],
  printbatches: [
    /create\s+table\s+(?:if\s+not\s+exists\s+)?public\.off_market_printbatches\b/i,
  ],
  batchbrieven: [
    /create\s+table\s+(?:if\s+not\s+exists\s+)?public\.off_market_printbatch_brieven\b/i,
  ],
  batchdocumenten: [
    /create\s+table\s+(?:if\s+not\s+exists\s+)?public\.off_market_batchdocumenten\b/i,
  ],
  productieaudit: [
    /create\s+table\s+(?:if\s+not\s+exists\s+)?public\.off_market_productie_events\b/i,
  ],
  nummerreeksen: [
    /create\s+table\s+(?:if\s+not\s+exists\s+)?public\.off_market_productie_nummerreeksen\b/i,
  ],
};

/**
 * Controleert uitsluitend of het SQL-concept de minimale persistente
 * productiekernonderdelen expliciet bevat.
 *
 * De audit bewijst geen correcte DDL, constraints, RLS of migratiegeschiktheid.
 * Een ontbrekend onderdeel houdt schema- en productieactivatie fail-closed.
 */
export function controleerProductiekernSchemaDekking(
  sql: string,
): ProductiekernSchemaDekking {
  const onderdelen = Object.keys(PATRONEN) as ProductiekernSchemaOnderdeel[];
  const aanwezig = onderdelen.filter((onderdeel) =>
    PATRONEN[onderdeel].every((patroon) => patroon.test(sql))
  );
  const ontbrekend = onderdelen.filter((onderdeel) => !aanwezig.includes(onderdeel));

  return {
    aanwezig,
    ontbrekend,
    volledig: ontbrekend.length === 0,
  };
}
