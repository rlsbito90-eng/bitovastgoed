// V2.3 + V2.4 — BAG pre-check types.
// Loose input-type i.p.v. afhankelijkheid van de auto-gen Database['off_market_signalen']['Row']
// zodat helpers test- en evolutiebestendig zijn.

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
  /** V2.4 — BAG-pand identificatie. */
  pandid?: string | null;
  /** V2.4 — Oorspronkelijk bouwjaar (van pand). */
  pand_bouwjaar?: number | null;
  /** V2.4 — Status van het pand (bv "Pand in gebruik"). */
  pand_status?: string | null;
  /** V2.4 — true voor het gekozen doelobject. */
  is_doelobject?: boolean;
  /** V2.4 — UI-badge ("MATCH" / "Zelfde BAG-pand"). */
  match_badge?: string | null;
}

/** V2.4 — Match-type voor een kandidaat. */
export type BagMatchType =
  | 'exact_doelobject'
  | 'zelfde_huisnummer'
  | 'zelfde_bag_pand'
  | 'nabijgelegen_adres'
  | 'onzeker';

/** V2.4 — kandidaat tijdens multiple-match resolver. */
export interface BagMatchKandidaat {
  adres: string;
  vbo_id?: string | null;
  nummeraanduiding_id?: string | null;
  /** PDOK locatieserver document-id (vorm "adr-..."). Nodig voor latere lookup. */
  pdok_id?: string | null;
  opp_m2?: number | null;
  gebruiksdoel?: string[] | null;
  status?: string | null;
  pandid?: string | null;

  // Adresvelden (V2.4)
  postcode?: string | null;
  postcode_normalized?: string | null;
  huisnummer?: string | number | null;
  huisletter?: string | null;
  huisnummertoevoeging?: string | null;
  openbareruimte?: string | null;
  woonplaats?: string | null;

  match_type?: BagMatchType | null;
  is_doelobject_match?: boolean | null;
  match_kwaliteit?: string | null;
  match_reden?: string | null;
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

  // V2.4 — doelobject + pandcontext + matchkandidaten
  bag_match_kandidaten?: BagMatchKandidaat[] | null;
  bag_geselecteerd_vbo_id?: string | null;
  bag_geselecteerd_nummeraanduiding_id?: string | null;
  bag_geselecteerd_adres?: string | null;
  bag_geselecteerd_opp_m2?: number | null;
  bag_geselecteerd_gebruiksdoel?: string[] | null;
  bag_pandcontext_aantal_vbo?: number | null;
  bag_pandcontext_totaal_opp_m2?: number | null;
  bag_pandcontext_incompleet?: boolean | null;
  /** V2.4 — 'pandid' | 'huisnummer' | 'gemengd' | 'leeg' */
  bag_pandcontext_bron?: string | null;
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
