// V2.3 — BAG pre-check types.
// Loose input-type i.p.v. afhankelijkheid van de auto-gen Database['off_market_signalen']['Row']
// zodat helpers test- en evolutiebestendig zijn (nieuwe kolommen worden via `as any` doorgegeven).

export type BagStatus =
  | 'niet_verrijkt'
  | 'bezig'
  | 'verrijkt'
  | 'geen_match'
  | 'meerdere_matches'
  | 'fout';

export type BagMatchKwaliteit =
  | 'exact'
  | 'postcode_huisnummer'
  | 'straat_huisnummer'
  | 'onzeker';

export type Kadasteradvies =
  | 'laag'
  | 'voorzichtig'
  | 'aanbevolen'
  | 'sterk_aanbevolen';

export interface BagVbo {
  nummeraanduiding_id: string;
  vbo_id: string;
  adres: string;
  opp_m2: number | null;
  gebruiksdoel: string[];
  status: string | null;
}

/** Subset-input voor pure helpers — ondersteunt zowel verse rows als test-fixtures. */
export interface SignaalBagInput {
  id?: string;
  gearchiveerd_op?: string | null;
  status?: string | null;
  ai_status?: string | null;
  ai_score?: number | null;
  ai_skip_reden?: string | null;
  ai_strategie_suggestie?: string | null;
  potentiele_strategie?: string | null;
  vergunningtype?: string | null;
  assettype?: string | null;
  titel?: string | null;
  plaats?: string | null;
  adres?: string | null;
  postcode?: string | null;
  bron_url?: string | null;
  bag_status?: string | null;
  bag_match_kwaliteit?: string | null;
  bag_aantal_vbo?: number | null;
  bag_aantal_panden?: number | null;
  bag_totaal_oppervlakte_m2?: number | null;
  bag_gebruiksdoelen?: string[] | null;
  bag_bouwjaar?: number | null;
  bag_pand_status?: string | null;
  bag_vbos?: BagVbo[] | null;
}

export const BAG_STATUS_LABEL: Record<BagStatus, string> = {
  niet_verrijkt: 'Niet verrijkt',
  bezig: 'Bezig…',
  verrijkt: 'Verrijkt',
  geen_match: 'Geen BAG-match',
  meerdere_matches: 'Meerdere matches',
  fout: 'Fout',
};

export const KADASTERADVIES_LABEL: Record<Kadasteradvies, string> = {
  laag: 'Laag',
  voorzichtig: 'Voorzichtig',
  aanbevolen: 'Aanbevolen',
  sterk_aanbevolen: 'Sterk aanbevolen',
};
