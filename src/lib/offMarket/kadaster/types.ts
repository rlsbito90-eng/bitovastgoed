// Gedeelde types voor de Kadaster Check-flow.
// Wordt gebruikt door frontend, edge function en tests.

export type KadasterModus = 'mock' | 'handmatig' | 'api';
export type KadasterStatus = 'geslaagd' | 'geen_resultaat' | 'meerdere_resultaten' | 'mislukt';
export type KadasterEigenaarType = 'particulier' | 'bv' | 'stichting' | 'vve' | 'overheid' | 'onbekend';

/** Genormaliseerde adresinput voor een Kadaster-lookup. */
export interface AdresInput {
  origineel: string;            // ruwe regel zoals "Hoofdweg 160-H 1057 DB Amsterdam"
  straat: string | null;
  huisnummer: string | null;    // numeriek deel "160"
  toevoeging: string | null;    // "H", "1", null
  postcode: string | null;      // "1057 DB"
  plaats: string | null;
}

/** Eén zoekvariant die we naar Kadaster kunnen sturen. */
export interface ZoekVariant {
  id: string;                   // stabiele id, bv. "straat-huisnr-plaats"
  label: string;                // mens-leesbaar
  /** breder => meer kans op match, lager => exacter. Range 0..1. */
  precisie: number;
  /** Bevat de huisnummertoevoeging in de zoekopdracht. */
  metToevoeging: boolean;
  query: {
    straat?: string;
    huisnummer?: string;
    toevoeging?: string;
    postcode?: string;
    plaats?: string;
    vrij?: string;              // fallback: originele regel
  };
}

/** Eén gevonden resultaat (genormaliseerd, geen ruwe response). */
export interface KadasterResultaat {
  adres: string;
  eigenaar_naam: string;
  eigenaar_type?: KadasterEigenaarType;
  eigenaar_bedrijfsnaam?: string;
  kadastrale_aanduiding: string;
  /** 0..1, hoger = beter. */
  confidence: number;
  bron: 'mock' | 'kadaster';
  /** Optioneel: timestamp van Kadaster zelf. */
  brondatum?: string;
}

export interface KadasterCheckResponse {
  check_id: string;
  modus: KadasterModus;
  status: KadasterStatus;
  zoekvariant: string;
  resultaten: KadasterResultaat[];
  foutmelding?: string;
}

/** Detecteert complexe adressen waarbij we geen automatische overname willen. */
export interface AdresComplexiteit {
  complex: boolean;
  redenen: string[];
}
