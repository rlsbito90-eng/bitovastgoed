// Gedeelde types voor Kadaster Objectinformatie API (Fase 4K.1).
// Frontend en edge function delen deze types via copy in src/lib/kadaster/types.ts.

export type KadasterModus = 'gebiedsdata' | 'kadaster'; // gratis | betaald (object+waarde)

export type KadasterProductCode =
  | 'object'    // WOZ-object — betaald ±€ 0,10
  | 'waarde'    // Koopsom — betaald ±€ 0,10
  | 'rechten'   // V2 — betaald ±€ 2,40
  | 'lasten'    // Gemeentelijke lasten — gratis
  | 'buurt';    // Buurtstatistieken — gratis

export type Deliver = 'onlyComplete' | 'withoutProduct' | 'partialProduct';

export interface KadasterAdresInput {
  postalcode: string;          // "1057 DB"
  houseNumber: string;         // "160"
  houseLetter?: string | null; // "H"
  houseNumberAddition?: string | null; // "1"
}

export interface KadasterRequestInput {
  modus: KadasterModus;
  /** Eén van beide vereist. BAG-ID heeft voorrang. */
  bagId?: string | null;
  adres?: KadasterAdresInput | null;
  /** Optioneel: object_id of signaal_id voor audit-log (geen DB-write in V1.1). */
  context?: {
    object_id?: string | null;
    signaal_id?: string | null;
  };
}

export interface KadasterProductResult {
  code: KadasterProductCode;
  beschikbaar: boolean;
  data?: Record<string, unknown>;
  foutmelding?: string;
}

export interface KadasterPreview {
  modus: KadasterModus;
  bron: 'kadaster_objectinformatie_api';
  opgehaald_op: string; // ISO
  productcodes: KadasterProductCode[];
  kosten_indicatie_eur: number; // 0 voor gebiedsdata
  zoekadres: {
    type: 'bagId' | 'pht';
    waarde: string;
  };
  producten: KadasterProductResult[];
}

export interface KadasterErrorResponse {
  error: string;
  code?: 'unauthorized' | 'forbidden' | 'invalid_input' | 'key_invalid'
       | 'budget_exceeded' | 'not_found' | 'product_invalid'
       | 'upstream_unavailable' | 'unknown';
  http_status?: number;
}
