// PDOK Locatieserver — publieke BAG adreslookup.
// Doel: officiële BAG-match vinden voor straat + huisnummer + plaats om
// postcode/huisnummer voor Kadasteraanvragen aan te vullen.
//
// Belangrijk:
//  - Dit is GEEN Kadasteraanvraag en kost niets.
//  - Endpoint is publiek en vereist geen API-key.
//  - Functies hieronder doen geen automatische calls; alleen op verzoek.

export interface BagAdresResultaat {
  /** Stabiele id (BAG nummeraanduiding of verblijfsobject id). */
  id: string;
  weergavenaam: string;
  straat: string | null;
  huisnummer: string | null;
  huisletter: string | null;
  huisnummertoevoeging: string | null;
  postcode: string | null;          // normaal "1234AB" (zonder spatie)
  woonplaats: string | null;
  /** BAG nummeraanduiding-id (16 cijfers). */
  nummeraanduiding_id: string | null;
  /** BAG verblijfsobject-id indien aanwezig. */
  adresseerbaar_object_id: string | null;
}

export interface BagZoekInput {
  straat?: string | null;
  huisnummer?: string | null;
  plaats?: string | null;
  postcode?: string | null;
}

const PDOK_FREE = 'https://api.pdok.nl/bzk/locatieserver/search/v3_1/free';
const PDOK_FIELDS = [
  'id', 'weergavenaam', 'straatnaam', 'huisnummer', 'huisletter',
  'huisnummertoevoeging', 'postcode', 'woonplaatsnaam',
  'nummeraanduiding_id', 'adresseerbaar_object_id',
].join(',');

/** Normaliseer postcode strikt naar "1234AB" (geen spatie, hoofdletters). */
export function normaliseerPostcodeStrikt(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const compact = String(raw).replace(/\s+/g, '').toUpperCase();
  return /^\d{4}[A-Z]{2}$/.test(compact) ? compact : null;
}

/** Bouw vrije-tekst-zoekstring voor PDOK Locatieserver. */
export function bouwZoekQuery(input: BagZoekInput): string {
  const delen: string[] = [];
  const pc = normaliseerPostcodeStrikt(input.postcode);
  if (pc) delen.push(`${pc.slice(0, 4)} ${pc.slice(4)}`);
  if (input.straat) delen.push(input.straat.trim());
  if (input.huisnummer) delen.push(String(input.huisnummer).trim());
  if (input.plaats) delen.push(input.plaats.trim());
  return delen.filter(Boolean).join(' ').trim();
}

interface PdokDoc {
  id?: string;
  weergavenaam?: string;
  straatnaam?: string;
  huisnummer?: number | string;
  huisletter?: string;
  huisnummertoevoeging?: string;
  postcode?: string;
  woonplaatsnaam?: string;
  nummeraanduiding_id?: string;
  adresseerbaar_object_id?: string;
}

function mapDoc(d: PdokDoc): BagAdresResultaat {
  const pcRaw = (d.postcode ?? '').toString().replace(/\s+/g, '').toUpperCase();
  return {
    id: d.id ?? d.nummeraanduiding_id ?? d.adresseerbaar_object_id ?? d.weergavenaam ?? '',
    weergavenaam: d.weergavenaam ?? '',
    straat: d.straatnaam ?? null,
    huisnummer: d.huisnummer != null ? String(d.huisnummer) : null,
    huisletter: d.huisletter ? d.huisletter.toUpperCase() : null,
    huisnummertoevoeging: d.huisnummertoevoeging ?? null,
    postcode: /^\d{4}[A-Z]{2}$/.test(pcRaw) ? pcRaw : null,
    woonplaats: d.woonplaatsnaam ?? null,
    nummeraanduiding_id: d.nummeraanduiding_id ?? null,
    adresseerbaar_object_id: d.adresseerbaar_object_id ?? null,
  };
}

/**
 * Zoek BAG-adressen via PDOK Locatieserver.
 * - Doet alleen iets bij een niet-lege query.
 * - Filtert op `type:adres` zodat we geen postcodes/straten/woonplaatsen krijgen.
 * - Retourneert maximaal `rows` (default 10) genormaliseerde resultaten.
 */
export async function zoekBagAdressen(
  input: BagZoekInput,
  opts: { rows?: number; signal?: AbortSignal } = {},
): Promise<BagAdresResultaat[]> {
  const q = bouwZoekQuery(input);
  if (!q) return [];
  const rows = Math.min(Math.max(opts.rows ?? 10, 1), 25);
  const url = new URL(PDOK_FREE);
  url.searchParams.set('q', q);
  url.searchParams.set('fq', 'type:adres');
  url.searchParams.set('fl', PDOK_FIELDS);
  url.searchParams.set('rows', String(rows));

  const res = await fetch(url.toString(), { signal: opts.signal, headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`PDOK lookup mislukt (HTTP ${res.status})`);
  const json = await res.json() as { response?: { docs?: PdokDoc[] } };
  const docs = json?.response?.docs ?? [];
  return docs.map(mapDoc);
}
