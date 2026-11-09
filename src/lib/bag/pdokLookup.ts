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
  /** WGS84: breedtegraad uit PDOK centroide_ll. */
  latitude: number | null;
  /** WGS84: lengtegraad uit PDOK centroide_ll. */
  longitude: number | null;
  type: 'adres' | 'woonplaats' | null;
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
  'centroide_ll','type',
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
  centroide_ll?: string;
  type?: string;
}

/** PDOK WKT POINT geeft eerst longitude, daarna latitude.
 * We accepteren alleen finite Nederlandse landcoördinaten.
 */
export function parsePdokCentroid(wkt: string | null | undefined): { latitude:number; longitude:number } | null {
  const m=wkt?.trim().match(/^POINT\s*\(\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*\)$/i);
  if(!m)return null;
  const longitude=Number(m[1]),latitude=Number(m[2]);
  if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||
    latitude<50||latitude>54||longitude<3||longitude>8)return null;
  return {latitude,longitude};
}

function mapDoc(d: PdokDoc): BagAdresResultaat {
  const pcRaw = (d.postcode ?? '').toString().replace(/\s+/g, '').toUpperCase();
  const centroide=parsePdokCentroid(d.centroide_ll);
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
    latitude: centroide?.latitude ?? null,
    longitude: centroide?.longitude ?? null,
    type: d.type==='adres'||d.type==='woonplaats'?d.type:null,
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

/** Alleen wanneer de gebruiker op Zoeken klikt.
 * Voor zoekradius gebruiken we het PDOK-centrum van een woonplaats,
 * NIET een automatisch afgeleide reistijd of een privéadres.
 */
export async function zoekPdokWoonplaatsen(
  naam:string,
  opts:{rows?:number;signal?:AbortSignal}={},
):Promise<BagAdresResultaat[]> {
  const q=naam.trim();
  if(q.length<2||q.length>100)return [];
  const url=new URL(PDOK_FREE);
  url.searchParams.set('q',q);
  url.searchParams.set('fq','type:woonplaats');
  url.searchParams.set('fl','id,weergavenaam,woonplaatsnaam,centroide_ll,type');
  url.searchParams.set('rows',String(Math.min(Math.max(opts.rows??8,1),15)));
  const res=await fetch(url.toString(),{signal:opts.signal,headers:{Accept:'application/json'}});
  if(!res.ok)throw new Error(`PDOK woonplaats-zoekactie mislukt (HTTP ${res.status})`);
  const data=await res.json() as {response?:{docs?:PdokDoc[]}};
  if(!Array.isArray(data.response?.docs))throw new Error('PDOK gaf geen herleidbare woonplaatsen terug.');
  return data.response.docs.filter(d=>d.type==='woonplaats').map(mapDoc);
}
