// Server-side, Deno-/Node-compatible PDOK Locatieserver `free`-geocoder
// voor Off-Market signalen. Pure functies — geen netwerkcall in evaluatie,
// `pdokFreeZoek` doet de daadwerkelijke fetch.
//
// Doel: bepaal veilig lat/lng voor een signaal aan de hand van adres,
// postcode en plaats, zonder ooit gemeente-/woonplaats-/wijk-/buurtcentroïden
// te accepteren en zonder Kadaster of BAG te raken.

export const PDOK_FREE_URL = 'https://api.pdok.nl/bzk/locatieserver/search/v3_1/free';
export const PDOK_FIELDS = [
  'id', 'type', 'score', 'weergavenaam',
  'straatnaam', 'huisnummer', 'huisletter', 'huisnummertoevoeging',
  'postcode', 'woonplaatsnaam', 'centroide_ll',
].join(',');

/** Acceptatiegrenzen voor lat/lng (Nederland incl. waddeneilanden). */
export const NL_BOUNDS = { latMin: 50.5, latMax: 53.7, lngMin: 3.2, lngMax: 7.4 };

export interface GeocodeInput {
  adres: string | null;
  postcode: string | null;
  plaats: string | null;
}

export interface GeocodeMatch {
  lat: number;
  lng: number;
  pdokId: string;
  weergavenaam: string;
  reden: 'postcode_exact' | 'adres_exact';
}

export type GeocodeUitkomst =
  | { status: 'ok'; match: GeocodeMatch }
  | { status: 'geen_adres' }
  | { status: 'geen_match'; reden: string };

function stripDiacritics(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function normTekst(s: string | null | undefined): string {
  if (!s) return '';
  return stripDiacritics(String(s))
    .toLowerCase()
    .replace(/[.,;:]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normPostcode(pc: string | null | undefined): string | null {
  if (!pc) return null;
  const c = String(pc).replace(/\s+/g, '').toUpperCase();
  return /^\d{4}[A-Z]{2}$/.test(c) ? c : null;
}

export interface ParsedStraatHuisnr {
  straat: string | null;
  huisnummer: string | null;
}

/** Lichtgewicht straat+huisnummer parser; bewust simpel om server-onafhankelijk te blijven. */
export function parseStraatHuisnr(adres: string | null | undefined): ParsedStraatHuisnr {
  if (!adres) return { straat: null, huisnummer: null };
  const opgeschoond = String(adres)
    .replace(/\s+/g, ' ')
    .replace(/\s+\d{4}\s*[A-Z]{2}\b.*$/i, '')
    .trim();
  const m = opgeschoond.match(/^(.+?)\s+(\d{1,5})(?:[\s-/][A-Za-z0-9-]+)?\s*$/);
  if (!m) return { straat: opgeschoond || null, huisnummer: null };
  return { straat: m[1].trim() || null, huisnummer: m[2] };
}

/** Bouw een PDOK-zoekopdracht uit adres + postcode + plaats. Geeft null bij onvoldoende input. */
export function bouwQuery(inv: GeocodeInput): string | null {
  const pc = normPostcode(inv.postcode);
  const parsed = parseStraatHuisnr(inv.adres);
  const plaats = inv.plaats?.trim() || null;
  const heeftPcHuisnr = !!(pc && parsed.huisnummer);
  const heeftAdresPlaats = !!(parsed.straat && parsed.huisnummer && plaats);
  if (!heeftPcHuisnr && !heeftAdresPlaats) return null;
  const delen: string[] = [];
  if (pc) delen.push(`${pc.slice(0, 4)} ${pc.slice(4)}`);
  if (parsed.straat) delen.push(parsed.straat);
  if (parsed.huisnummer) delen.push(parsed.huisnummer);
  if (plaats) delen.push(plaats);
  const q = delen.join(' ').trim();
  return q || null;
}

/**
 * Parse PDOK `centroide_ll` veld. Formaat: `POINT(lng lat)` — longitude staat
 * eerst, latitude tweede. Retourneert `{lat, lng}` in WGS84.
 * Wordt geweigerd als coördinaten niet binnen Nederland-bounds vallen.
 */
export function parseCentroideLL(raw: string | null | undefined): { lat: number; lng: number } | null {
  if (!raw) return null;
  const m = String(raw).match(/POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i);
  if (!m) return null;
  const lng = Number(m[1]);
  const lat = Number(m[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < NL_BOUNDS.latMin || lat > NL_BOUNDS.latMax) return null;
  if (lng < NL_BOUNDS.lngMin || lng > NL_BOUNDS.lngMax) return null;
  return { lat, lng };
}

export interface PdokDoc {
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

/**
 * Selecteer een betrouwbare PDOK-kandidaat volgens strikte regels.
 * Eisen:
 *  - alleen `type=adres`
 *  - coördinaten binnen NL-bounds
 *  - bij beschikbare postcode: exacte postcode-match verplicht
 *  - zonder postcode: straat + huisnummer + plaats moeten exact matchen
 *  - centroïden van gemeente/woonplaats/wijk/buurt worden expliciet geweigerd
 */
export function kiesKandidaat(inv: GeocodeInput, docs: PdokDoc[]): GeocodeUitkomst {
  const parsed = parseStraatHuisnr(inv.adres);
  const pc = normPostcode(inv.postcode);
  const plaatsNorm = normTekst(inv.plaats);

  if (!parsed.huisnummer || (!pc && !plaatsNorm)) {
    return { status: 'geen_adres' };
  }

  const adresKandidaten = docs.filter((d) => String(d.type ?? '').toLowerCase() === 'adres');
  if (adresKandidaten.length === 0) {
    return { status: 'geen_match', reden: 'geen_adres_type' };
  }

  for (const d of adresKandidaten) {
    const ll = parseCentroideLL(d.centroide_ll);
    if (!ll) continue;

    const docHuisnr = d.huisnummer != null ? String(d.huisnummer) : null;
    if (docHuisnr !== parsed.huisnummer) continue;

    const docPc = normPostcode(d.postcode);

    if (pc) {
      if (docPc !== pc) continue;
      return {
        status: 'ok',
        match: { lat: ll.lat, lng: ll.lng, pdokId: d.id ?? '', weergavenaam: d.weergavenaam ?? '', reden: 'postcode_exact' },
      };
    }

    // Geen postcode → eis exacte straat- en plaatsmatch.
    const docStraat = normTekst(d.straatnaam);
    const docPlaats = normTekst(d.woonplaatsnaam);
    const inputStraat = normTekst(parsed.straat);
    if (!docStraat || !docPlaats || !inputStraat) continue;
    if (docStraat !== inputStraat) continue;
    if (docPlaats !== plaatsNorm) continue;
    return {
      status: 'ok',
      match: { lat: ll.lat, lng: ll.lng, pdokId: d.id ?? '', weergavenaam: d.weergavenaam ?? '', reden: 'adres_exact' },
    };
  }

  return { status: 'geen_match', reden: 'geen_betrouwbare_kandidaat' };
}

/** Live PDOK `free`-call met retry. Faalt hard bij niet-200 na retries. */
export async function pdokFreeZoek(
  query: string,
  opts: { rows?: number; fetchImpl?: typeof fetch } = {},
): Promise<PdokDoc[]> {
  const f = opts.fetchImpl ?? fetch;
  const url = new URL(PDOK_FREE_URL);
  url.searchParams.set('q', query);
  url.searchParams.set('fq', 'type:adres');
  url.searchParams.set('fl', PDOK_FIELDS);
  url.searchParams.set('rows', String(Math.min(Math.max(opts.rows ?? 10, 1), 20)));
  let lastStatus = 0;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await f(url.toString(), { headers: { Accept: 'application/json' } });
      lastStatus = res.status;
      if (res.status === 429 || res.status >= 500) {
        await new Promise((r) => setTimeout(r, 250 * (attempt + 1)));
        continue;
      }
      if (!res.ok) throw new Error(`PDOK HTTP ${res.status}`);
      const json = await res.json() as { response?: { docs?: PdokDoc[] } };
      return json?.response?.docs ?? [];
    } catch (err) {
      if (attempt === 2) throw err;
      await new Promise((r) => setTimeout(r, 250 * (attempt + 1)));
    }
  }
  throw new Error(`PDOK onbereikbaar (laatste status ${lastStatus})`);
}

/** Eind-tot-eind: bouw query, doe call, selecteer kandidaat. */
export async function ensureCoords(
  inv: GeocodeInput,
  opts: { fetchImpl?: typeof fetch } = {},
): Promise<GeocodeUitkomst> {
  const q = bouwQuery(inv);
  if (!q) return { status: 'geen_adres' };
  const docs = await pdokFreeZoek(q, { fetchImpl: opts.fetchImpl });
  return kiesKandidaat(inv, docs);
}

/** Hard cap voor automatische GEO-triggers per normalize-run. */
export const GEO_TRIGGER_CAP_PER_RUN = 25;
