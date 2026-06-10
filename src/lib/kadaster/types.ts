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
  /**
   * Wanneer true en context.object_id/signaal_id aanwezig is, schrijft de
   * edge function elk product direct in `kadaster_data_records`. Geen
   * extra Kadaster-call.
   */
  persist?: boolean | null;
}

export type KadasterDeliverStatus =
  | 'geleverd'
  | 'gedeeltelijk'
  | 'niet_geleverd'
  | 'niet_beschikbaar'
  | 'onbekend';

export const KADASTER_STATUS_LABELS: Record<KadasterDeliverStatus, string> = {
  geleverd: 'Geleverd',
  gedeeltelijk: 'Gedeeltelijk geleverd',
  niet_geleverd: 'Niet geleverd',
  niet_beschikbaar: 'Niet beschikbaar',
  onbekend: 'Onbekend',
};

export interface KadasterProductResult {
  code: KadasterProductCode;
  beschikbaar: boolean;
  status?: KadasterDeliverStatus;
  deliver?: string | null;
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
  /** Veilige top-level samenvatting van de Kadaster-response (geen inhoud). */
  response_shape?: Record<string, unknown> | null;
  allowed_products?: KadasterProductCode[];
  products_source?: 'live' | 'fallback';
  filtered_out?: KadasterProductCode[];
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
