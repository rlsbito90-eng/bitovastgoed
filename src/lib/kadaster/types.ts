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
  kosten_indicatie_eur: number;
  zoekadres: { type: 'bagId' | 'pht'; waarde: string };
  producten: KadasterProductResult[];
}

export interface KadasterErrorCode {
  code?:
    | 'unauthorized' | 'forbidden' | 'invalid_input' | 'key_invalid'
    | 'budget_exceeded' | 'not_found' | 'product_invalid'
    | 'upstream_unavailable' | 'unknown';
  http_status?: number;
  error: string;
}

export const KADASTER_KOSTEN_PER_MODUS: Record<KadasterModus, number> = {
  gebiedsdata: 0,
  kadaster: 0.20,
};

export const KADASTER_LABELS_PER_PRODUCT: Record<KadasterProductCode, string> = {
  object: 'WOZ-object',
  waarde: 'Koopsom',
  rechten: 'Eigendomsinformatie',
  lasten: 'Gemeentelijke lasten',
  buurt: 'Buurtstatistieken',
};
