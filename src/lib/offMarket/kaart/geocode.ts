// Veilige PDOK-geocoding voor Off Market Radar Kaart.
//
// Doel:
//  - Probeer voor signalen zonder lat/lng exact coördinaten op te halen.
//  - Automatisch opslaan mag ALLEEN bij een betrouwbare match
//    (type=adres, huisnummer komt overeen, postcode of plaats komt overeen,
//     geen tweede kandidaat met vergelijkbare score).
//  - Onzekere resultaten worden teruggegeven als 'controleren' met
//    kandidaten zodat de gebruiker handmatig kan kiezen.
//  - Geen Kadaster-call, geen kosten, geen AI.

export interface GeocodeKandidaat {
  id: string;
  weergavenaam: string;
  straat: string | null;
  huisnummer: string | null;
  postcode: string | null;
  woonplaats: string | null;
  lat: number;
  lng: number;
  score: number;
  type: string;
}

export type GeocodeResultaat =
  | { status: 'auto'; lat: number; lng: number; kandidaat: GeocodeKandidaat }
  | { status: 'controleren'; kandidaten: GeocodeKandidaat[]; reden: string }
  | { status: 'geen'; reden: string }
  | { status: 'overslaan'; reden: string };

const PDOK_FREE = 'https://api.pdok.nl/bzk/locatieserver/search/v3_1/free';
const PDOK_FIELDS = [
  'id', 'type', 'score', 'weergavenaam',
  'straatnaam', 'huisnummer', 'huisletter', 'huisnummertoevoeging',
  'postcode', 'woonplaatsnaam', 'centroide_ll',
].join(',');

export interface ParsedAdres {
  straat: string | null;
  huisnummer: string | null;
  toevoeging: string | null;
}

/** Eenvoudige parser voor vrije-tekst adresvelden. */
export function parseAdres(adres: string | null | undefined): ParsedAdres {
  if (!adres) return { straat: null, huisnummer: null, toevoeging: null };
  const trimmed = adres.trim().replace(/\s+/g, ' ');
  // Match: straat (woorden) + huisnummer (cijfers) + optioneel letter/toevoeging
  const m = trimmed.match(/^(.+?)\s+(\d{1,5})\s*([A-Za-z])?\s*(?:[-/\s]+([\w\d-]+))?$/);
  if (!m) return { straat: trimmed || null, huisnummer: null, toevoeging: null };
  const [, straat, nr, letter, toev] = m;
  const toevoeging = [letter, toev].filter(Boolean).join('').toUpperCase() || null;
  return {
    straat: straat.trim() || null,
    huisnummer: nr,
    toevoeging,
  };
}

function normPostcode(pc: string | null | undefined): string | null {
  if (!pc) return null;
  const c = String(pc).replace(/\s+/g, '').toUpperCase();
  return /^\d{4}[A-Z]{2}$/.test(c) ? c : null;
}

function normPlaats(p: string | null | undefined): string | null {
  if (!p) return null;
  return p.trim().toLowerCase().replace(/\s+/g, ' ') || null;
}

function parseCentroideLL(raw: string | undefined): { lng: number; lat: number } | null {
  if (!raw) return null;
  // PDOK levert WGS84 als "POINT(lng lat)"
  const m = raw.match(/POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i);
  if (!m) return null;
  const lng = Number(m[1]);
  const lat = Number(m[2]);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  // Plausibiliteitscheck Nederland-ish (ruim)
  if (lat < 50 || lat > 54 || lng < 3 || lng > 8) return null;
  return { lng, lat };
}

export interface SignaalLocatieInvoer {
  adres: string | null;
  postcode: string | null;
  plaats: string | null;
}

/** Bouw PDOK-zoekquery uit signaal-locatievelden. */
export function bouwQuery(inv: SignaalLocatieInvoer): string | null {
  const pc = normPostcode(inv.postcode);
  const parsed = parseAdres(inv.adres);
  const plaats = inv.plaats?.trim() || null;
  const heeftAdresplus = !!(parsed.huisnummer && (pc || plaats));
  const heeftPcHuisnr = !!(pc && parsed.huisnummer);
  if (!heeftAdresplus && !heeftPcHuisnr) return null;
  const delen = [
    pc ? `${pc.slice(0, 4)} ${pc.slice(4)}` : null,
    parsed.straat,
    parsed.huisnummer,
    parsed.toevoeging,
    plaats,
  ].filter(Boolean) as string[];
  return delen.join(' ').trim() || null;
}

interface PdokDoc {
  id?: string;
  type?: string;
  score?: number;
  weergavenaam?: string;
  straatnaam?: string;
  huisnummer?: number | string;
  huisletter?: string;
  huisnummertoevoeging?: string;
  postcode?: string;
  woonplaatsnaam?: string;
  centroide_ll?: string;
}

function mapDoc(d: PdokDoc): GeocodeKandidaat | null {
  const ll = parseCentroideLL(d.centroide_ll);
  if (!ll) return null;
  const pc = (d.postcode ?? '').toString().replace(/\s+/g, '').toUpperCase();
  return {
    id: d.id ?? d.weergavenaam ?? `${ll.lng},${ll.lat}`,
    weergavenaam: d.weergavenaam ?? '',
    straat: d.straatnaam ?? null,
    huisnummer: d.huisnummer != null ? String(d.huisnummer) : null,
    postcode: /^\d{4}[A-Z]{2}$/.test(pc) ? pc : null,
    woonplaats: d.woonplaatsnaam ?? null,
    lat: ll.lat,
    lng: ll.lng,
    score: typeof d.score === 'number' ? d.score : 0,
    type: d.type ?? '',
  };
}

/**
 * Doe een PDOK-call en map naar kandidaten met coördinaten.
 * Alleen `type:adres` resultaten worden meegenomen.
 */
export async function pdokAdresZoek(
  inv: SignaalLocatieInvoer,
  opts: { signal?: AbortSignal; rows?: number; fetchImpl?: typeof fetch } = {},
): Promise<GeocodeKandidaat[]> {
  const q = bouwQuery(inv);
  if (!q) return [];
  const f = opts.fetchImpl ?? fetch;
  const url = new URL(PDOK_FREE);
  url.searchParams.set('q', q);
  url.searchParams.set('fq', 'type:adres');
  url.searchParams.set('fl', PDOK_FIELDS);
  url.searchParams.set('rows', String(Math.min(Math.max(opts.rows ?? 5, 1), 20)));
  const res = await f(url.toString(), { signal: opts.signal, headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`PDOK lookup mislukt (HTTP ${res.status})`);
  const json = await res.json() as { response?: { docs?: PdokDoc[] } };
  const docs = json?.response?.docs ?? [];
  return docs.map(mapDoc).filter((x): x is GeocodeKandidaat => x !== null);
}

/** Beoordeel of de top-kandidaat veilig automatisch opgeslagen mag worden. */
export function beoordeelKandidaten(
  inv: SignaalLocatieInvoer,
  kandidaten: GeocodeKandidaat[],
): GeocodeResultaat {
  if (kandidaten.length === 0) {
    return { status: 'geen', reden: 'Geen PDOK-adresmatch gevonden.' };
  }
  const top = kandidaten[0];
  const tweede = kandidaten[1];
  const parsed = parseAdres(inv.adres);
  const pc = normPostcode(inv.postcode);
  const plaats = normPlaats(inv.plaats);

  // 1. huisnummer moet matchen als we er een hebben
  if (!parsed.huisnummer) {
    return { status: 'controleren', kandidaten, reden: 'Geen huisnummer in signaal-adres.' };
  }
  if (String(top.huisnummer ?? '') !== String(parsed.huisnummer)) {
    return { status: 'controleren', kandidaten, reden: 'Huisnummer wijkt af van top-resultaat.' };
  }

  // 2. postcode OF plaats moet matchen
  const postcodeMatch = pc && top.postcode && pc === top.postcode;
  const plaatsMatch = plaats && top.woonplaats && normPlaats(top.woonplaats) === plaats;
  if (!postcodeMatch && !plaatsMatch) {
    return { status: 'controleren', kandidaten, reden: 'Postcode noch plaats komt overeen.' };
  }

  // 3. mag niet meerdere bijna-gelijke kandidaten hebben
  if (tweede && tweede.score > 0 && top.score > 0) {
    const verhouding = top.score / tweede.score;
    if (verhouding < 1.3) {
      // Tenzij top een sterke postcode+huisnummer match heeft en tweede niet
      const tweedePc = tweede.postcode && pc && tweede.postcode === pc;
      const tweedeHuisnr = String(tweede.huisnummer ?? '') === String(parsed.huisnummer);
      if (tweedePc && tweedeHuisnr) {
        return { status: 'controleren', kandidaten, reden: 'Meerdere vergelijkbare kandidaten.' };
      }
    }
  }

  return { status: 'auto', lat: top.lat, lng: top.lng, kandidaat: top };
}

/** Volledige flow: query bouwen, PDOK aanroepen, beoordelen. */
export async function geocodeSignaalLocatie(
  inv: SignaalLocatieInvoer,
  opts: { signal?: AbortSignal; fetchImpl?: typeof fetch } = {},
): Promise<GeocodeResultaat> {
  const q = bouwQuery(inv);
  if (!q) {
    return { status: 'overslaan', reden: 'Onvoldoende adresgegevens (geen huisnummer + postcode/plaats).' };
  }
  const kandidaten = await pdokAdresZoek(inv, opts);
  return beoordeelKandidaten(inv, kandidaten);
}
