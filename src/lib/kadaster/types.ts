// Frontend mirror van supabase/functions/kadaster-objectinformatie/_types.ts.
// Houden gesynchroniseerd; geen import van edge-function bestanden in src.

export type KadasterModus = 'gebiedsdata' | 'kadaster';

export type KadasterProductCode =
  | 'object' | 'waarde' | 'rechten' | 'lasten' | 'buurt';

export interface KadasterAdresInput {
  postalcode: string;
  houseNumber: string;
  houseLetter?: string | null;
  houseNumberAddition?: string | null;
}

export interface KadasterRequestInput {
  modus: KadasterModus;
  bagId?: string | null;
  adres?: KadasterAdresInput | null;
  /**
   * Optionele expliciete productselectie. In modus 'kadaster' vereist
   * minimaal één betaald product ('object' of 'waarde'); gratis producten
   * ('lasten', 'buurt') worden alleen meegeleverd binnen die betaalde
   * aanvraag — Kadaster weigert standalone gratis bestellingen.
   */
  producten?: KadasterProductCode[] | null;
  context?: { object_id?: string | null; signaal_id?: string | null };
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
  opgehaald_op: string;
  productcodes: KadasterProductCode[];
  /** `null` betekent: prijs volgens Kadaster (niet vooraf bekend). */
  kosten_indicatie_eur: number | null;
  zoekadres: { type: 'bagId' | 'pht'; waarde: string };
  producten: KadasterProductResult[];
  /** Veilige debug-info (bevat NOOIT API-key). Optioneel. */
  debug?: KadasterDebug | null;
}

export interface KadasterDebug {
  endpoint?: string;
  base_url?: string;
  request_preview?: Record<string, unknown>;
  zoekadres?: { type: 'bagId' | 'pht'; waarde: string };
  product_codes?: KadasterProductCode[];
  upstream_status?: number | null;
  upstream_message?: string | null;
  upstream_identifier?: string | null;
  upstream_snippet?: string | null;
}

export interface KadasterErrorCode {
  code?:
    | 'unauthorized' | 'forbidden' | 'invalid_input' | 'key_invalid'
    | 'budget_exceeded' | 'not_found' | 'product_invalid'
    | 'upstream_unavailable' | 'unknown';
  http_status?: number;
  error: string;
}

export const KADASTER_BETAALDE_PRODUCTEN: KadasterProductCode[] = ['object', 'waarde'];
export const KADASTER_GRATIS_PRODUCTEN: KadasterProductCode[] = ['lasten', 'buurt'];

export const KADASTER_LABELS_PER_PRODUCT: Record<KadasterProductCode, string> = {
  object: 'WOZ-object',
  waarde: 'Koopsom',
  rechten: 'Eigendomsinformatie',
  lasten: 'Gemeentelijke lasten',
  buurt: 'Buurtstatistieken',
};
