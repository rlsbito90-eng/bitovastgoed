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
  /**
   * Optioneel: expliciete productselectie. In modus 'kadaster' verplicht
   * minimaal één betaald product ('object' of 'waarde'). Gratis producten
   * ('lasten', 'buurt') mogen alleen meegestuurd worden binnen dezelfde
   * (betaalde) aanvraag — Kadaster weigert standalone gratis aanvragen.
   */
  producten?: KadasterProductCode[] | null;
  /** Optioneel: object_id of signaal_id voor audit-log (geen DB-write in V1.1). */
  context?: {
    object_id?: string | null;
    signaal_id?: string | null;
  };
}

export type KadasterDeliverStatus =
  | 'geleverd'
  | 'gedeeltelijk'
  | 'niet_geleverd'
  | 'niet_beschikbaar'
  | 'onbekend';

export interface KadasterProductResult {
  code: KadasterProductCode;
  beschikbaar: boolean;
  /** Mapping van Kadaster-status naar UI-status. */
  status?: KadasterDeliverStatus;
  /** Deliver-mode zoals Kadaster die teruggaf (bv. "WithoutProduct"). */
  deliver?: string | null;
  data?: Record<string, unknown>;
  foutmelding?: string;
}

export interface KadasterPreview {
  modus: KadasterModus;
  bron: 'kadaster_objectinformatie_api';
  opgehaald_op: string; // ISO
  productcodes: KadasterProductCode[];
  /**
   * Indicatieve kosten in EUR. `null` wanneer de prijs niet vooraf bekend
   * is — UI moet dan "prijs volgens Kadaster" tonen i.p.v. een hardgecodeerd
   * bedrag.
   */
  kosten_indicatie_eur: number | null;
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
