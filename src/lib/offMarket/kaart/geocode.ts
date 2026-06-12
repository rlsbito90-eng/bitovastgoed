// Veilige, maar slimme PDOK-geocoding voor Off Market Radar Kaart.
//
// Doel:
//  - Voor de hand liggende adressen worden automatisch opgeslagen.
//  - Echte twijfelgevallen komen in "Locatie controleren".
//  - Geen Kadaster-call, geen kosten, geen AI.
//
// Auto-regels (samenvatting):
//  * type=adres
//  * huisnummer exact
//  * straatnaam genormaliseerd gelijk (zonder diakritieken, lowercase)
//  * postcode exact (indien in signaal aanwezig) OF plaats genormaliseerd gelijk
//  * input mét toevoeging  → exacte toevoegings-match vereist
//  * input zónder toevoeging → kies de unieke kandidaat ZONDER toevoeging
//    (basisadres bestaat in BAG). Subadressen worden genegeerd zolang het
//    basisadres uniek is.
//  * meerdere kandidaten zonder toevoeging → alleen auto als topscore
//    duidelijk hoger is (≥ MIN_SCORE_GAP) en topscore ≥ MIN_TOP_SCORE.

export interface GeocodeKandidaat {
  id: string;
  weergavenaam: string;
  straat: string | null;
  huisnummer: string | null;
  /** Genormaliseerde combinatie van huisletter + huisnummertoevoeging, uppercase, zonder spaties/streepjes. */
  toevoeging: string | null;
  postcode: string | null;
  woonplaats: string | null;
  lat: number;
  lng: number;
  score: number;
  type: string;
}

export type GeocodeReden =
  | 'exact_match'
  | 'exact_addition_match'
  | 'basic_address_unique'
  | 'top_score_dominant'
  | 'multiple_candidates'
  | 'multiple_additions'
  | 'addition_mismatch'
  | 'street_mismatch'
  | 'postcode_mismatch'
  | 'too_uncertain'
  | 'no_housenumber'
  | 'no_candidates'
  | 'insufficient_input';

export type GeocodeResultaat =
  | { status: 'auto'; lat: number; lng: number; kandidaat: GeocodeKandidaat; reden: GeocodeReden }
  | { status: 'controleren'; kandidaten: GeocodeKandidaat[]; reden: string; redenCode: GeocodeReden }
  | { status: 'geen'; reden: string; redenCode: GeocodeReden }
  | { status: 'overslaan'; reden: string; redenCode: GeocodeReden };

const PDOK_FREE = 'https://api.pdok.nl/bzk/locatieserver/search/v3_1/free';
const PDOK_FIELDS = [
  'id', 'type', 'score', 'weergavenaam',
  'straatnaam', 'huisnummer', 'huisletter', 'huisnummertoevoeging',
  'postcode', 'woonplaatsnaam', 'centroide_ll',
].join(',');

const MIN_TOP_SCORE = 8;
const MIN_SCORE_GAP = 2;

export interface ParsedAdres {
  straat: string | null;
  huisnummer: string | null;
  /** Genormaliseerd: uppercase, zonder spaties/streepjes, bv "A", "2", "BS", "1HG". */
  toevoeging: string | null;
}

function stripDiacritics(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// Stopwoorden die per ongeluk in een toevoeging-positie kunnen belanden,
// vooral wanneer een ruwe titel/adresregel woorden als "in Amsterdam" bevat.
const TOEVOEGING_STOPWOORDEN = new Set<string>([
  'IN', 'TE', 'VOOR', 'VAN', 'OP', 'AAN', 'BIJ', 'MET',
  'AANVRAAG', 'VERGUNNING', 'BESLUIT', 'VERLEEND', 'GEWEIGERD',
  'OMGEVINGSVERGUNNING', 'SPLITSINGSVERGUNNING', 'WOONVORMINGSVERGUNNING',
  'AMSTERDAM', 'ROTTERDAM', 'UTRECHT', 'DENHAAG', 'EINDHOVEN',
]);

function normToevoeging(...delen: Array<string | null | undefined>): string | null {
  const raw = delen.filter(Boolean).join(' ').toUpperCase();
  const s = raw.replace(/[\s\-/.,]+/g, '');
  if (!s) return null;
  if (s.length > 6) return null; // echte toevoegingen zijn kort
  if (TOEVOEGING_STOPWOORDEN.has(s)) return null;
  if (s === 'HUIS') return 'HS';
  return s;
}

/**
 * Strip vulwoorden zoals "in <Plaats>" / "te <Plaats>" achter een huisnummer,
 * zodat "Surinameplein 46 in Amsterdam" niet als toevoeging "in" wordt
 * geparseerd. Alleen veilig na het huisnummer.
 */
function schoonAdres(adres: string): string {
  let s = adres.trim().replace(/\s+/g, ' ');
  s = s.replace(/\b(\d{1,5})\s+(in|te|voor)\b\s+[A-Z][A-Za-z'\-\s]+$/u, '$1');
  s = s.replace(/\b(\d{1,5})\s+(in|te|voor)\s*$/u, '$1');
  return s.trim();
}

/**
 * Parser voor vrije-tekst adresvelden (NL). Strikte toevoeging: max ~4 chars.
 * Accepteert o.a. "Damrak 1", "Damrak 1A", "Rijnstraat 101-2",
 * "Derde Schinkelstraat 20-3L", "Damrak 4 hs". "Surinameplein 46 in Amsterdam"
 * wordt netjes als huisnummer 46 zonder toevoeging geparseerd.
 */
export function parseAdres(adres: string | null | undefined): ParsedAdres {
  if (!adres) return { straat: null, huisnummer: null, toevoeging: null };
  const trimmed = schoonAdres(adres);
  const m = trimmed.match(/^(.+?)\s+(\d{1,5})\s*[-\s/]?\s*([A-Za-z][A-Za-z0-9]{0,3}|\d{1,3}[A-Za-z]?)?\s*$/);
  if (!m) return { straat: trimmed || null, huisnummer: null, toevoeging: null };
  const [, straat, nr, rest] = m;
  return {
    straat: straat.trim() || null,
    huisnummer: nr,
    toevoeging: normToevoeging(rest),
  };
}

/**
 * Combineer adres-parse met titel-parse: adres heeft prioriteit, titel vult
 * alleen aan (toevoeging, langere straat zoals "Derde Schinkelstraat").
 */
export function combineerParsed(adresParsed: ParsedAdres, titel: string | null | undefined): ParsedAdres {
  if (!titel) return adresParsed;
  const t = parseAdres(titel);
  if (!t.huisnummer) return adresParsed;
  if (adresParsed.huisnummer && t.huisnummer !== adresParsed.huisnummer) return adresParsed;
  const out: ParsedAdres = { ...adresParsed };
  if (!out.huisnummer) out.huisnummer = t.huisnummer;
  if (!out.toevoeging && t.toevoeging) out.toevoeging = t.toevoeging;
  if (out.straat && t.straat) {
    const aN = stripDiacritics(out.straat.toLowerCase()).replace(/\s+/g, ' ');
    const tN = stripDiacritics(t.straat.toLowerCase()).replace(/\s+/g, ' ');
    if (tN !== aN && tN.endsWith(aN) && tN.length > aN.length) {
      out.straat = t.straat;
    }
  } else if (!out.straat && t.straat) {
    out.straat = t.straat;
  }
  return out;
}

/**
 * Haal toevoeging uit PDOK-weergavenaam ("Straat 101-H, 1079 HA Amsterdam" → "H";
 * "Straat 20-3L, …" → "3L"). Robuuster dan losse huisletter/huisnummertoevoeging
 * velden waarvan de volgorde per record verschilt.
 */
function toevoegingUitWeergavenaam(weergavenaam: string | null | undefined, huisnummer: string | null): string | null {
  if (!weergavenaam || !huisnummer) return null;
  const re = new RegExp(`\\b${huisnummer}\\b([^,]*)`, 'i');
  const m = weergavenaam.match(re);
  if (!m) return null;
  return normToevoeging(m[1]);
}

function normPostcode(pc: string | null | undefined): string | null {
  if (!pc) return null;
  const c = String(pc).replace(/\s+/g, '').toUpperCase();
  return /^\d{4}[A-Z]{2}$/.test(c) ? c : null;
}

function normPlaats(p: string | null | undefined): string | null {
  if (!p) return null;
  return stripDiacritics(p.trim().toLowerCase()).replace(/\s+/g, ' ') || null;
}

function normStraat(s: string | null | undefined): string | null {
  if (!s) return null;
  return stripDiacritics(s.trim().toLowerCase()).replace(/\s+/g, ' ') || null;
}

function parseCentroideLL(raw: string | undefined): { lng: number; lat: number } | null {
  if (!raw) return null;
  const m = raw.match(/POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i);
  if (!m) return null;
  const lng = Number(m[1]);
  const lat = Number(m[2]);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  if (lat < 50 || lat > 54 || lng < 3 || lng > 8) return null;
  return { lng, lat };
}

export interface SignaalLocatieInvoer {
  adres: string | null;
  postcode: string | null;
  plaats: string | null;
  /** Optionele titel/omschrijving voor toevoeging-fallback (alleen aanvullend). */
  titel?: string | null;
}

/** Bouw PDOK-zoekquery uit signaal-locatievelden (adres heeft prioriteit). */
export function bouwQuery(inv: SignaalLocatieInvoer): string | null {
  const pc = normPostcode(inv.postcode);
  const parsed = combineerParsed(parseAdres(inv.adres), inv.titel);
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
  const huisnummer = d.huisnummer != null ? String(d.huisnummer) : null;
  // Primair: parse uit weergavenaam (volgorde-onafhankelijk).
  // Fallback: combineer huisletter + huisnummertoevoeging.
  const toevWeergave = toevoegingUitWeergavenaam(d.weergavenaam, huisnummer);
  const toevFallback = normToevoeging(d.huisnummertoevoeging, d.huisletter);
  return {
    id: d.id ?? d.weergavenaam ?? `${ll.lng},${ll.lat}`,
    weergavenaam: d.weergavenaam ?? '',
    straat: d.straatnaam ?? null,
    huisnummer,
    toevoeging: toevWeergave ?? toevFallback,
    postcode: /^\d{4}[A-Z]{2}$/.test(pc) ? pc : null,
    woonplaats: d.woonplaatsnaam ?? null,
    lat: ll.lat,
    lng: ll.lng,
    score: typeof d.score === 'number' ? d.score : 0,
    type: d.type ?? '',
  };
}

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
  url.searchParams.set('rows', String(Math.min(Math.max(opts.rows ?? 10, 1), 20)));
  const res = await f(url.toString(), { signal: opts.signal, headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`PDOK lookup mislukt (HTTP ${res.status})`);
  const json = await res.json() as { response?: { docs?: PdokDoc[] } };
  const docs = json?.response?.docs ?? [];
  return docs.map(mapDoc).filter((x): x is GeocodeKandidaat => x !== null);
}

interface DebugInfo {
  signaal_id?: string;
  input: { straat: string | null; huisnummer: string | null; toevoeging: string | null; postcode: string | null; plaats: string | null };
  aantal: number;
  gekozen: boolean;
  reden: GeocodeReden;
}

function debugLog(info: DebugInfo) {
  if (import.meta.env?.DEV) {
    // eslint-disable-next-line no-console
    console.debug('[kaart-geocode]', info);
  }
}

/** Beoordeel of de top-kandidaat veilig automatisch opgeslagen mag worden. */
export function beoordeelKandidaten(
  inv: SignaalLocatieInvoer,
  kandidaten: GeocodeKandidaat[],
  debugCtx: { signaal_id?: string } = {},
): GeocodeResultaat {
  const parsed = combineerParsed(parseAdres(inv.adres), inv.titel);
  const pc = normPostcode(inv.postcode);
  const plaats = normPlaats(inv.plaats);
  const inputStraat = normStraat(parsed.straat);

  const baseDebug = {
    signaal_id: debugCtx.signaal_id,
    input: { straat: inputStraat, huisnummer: parsed.huisnummer, toevoeging: parsed.toevoeging, postcode: pc, plaats },
    aantal: kandidaten.length,
  };

  if (kandidaten.length === 0) {
    debugLog({ ...baseDebug, gekozen: false, reden: 'no_candidates' });
    return { status: 'geen', reden: 'Geen PDOK-adresmatch gevonden.', redenCode: 'no_candidates' };
  }
  if (!parsed.huisnummer) {
    debugLog({ ...baseDebug, gekozen: false, reden: 'no_housenumber' });
    return { status: 'controleren', kandidaten, reden: 'Geen huisnummer in signaal-adres.', redenCode: 'no_housenumber' };
  }

  // 1) Huisnummer + (postcode of plaats) match
  const huisnummerMatch = kandidaten.filter(k => String(k.huisnummer ?? '') === String(parsed.huisnummer));
  if (huisnummerMatch.length === 0) {
    debugLog({ ...baseDebug, gekozen: false, reden: 'addition_mismatch' });
    return { status: 'controleren', kandidaten, reden: 'Huisnummer wijkt af van resultaten.', redenCode: 'addition_mismatch' };
  }
  const adresMatch = huisnummerMatch.filter(k => {
    const pcOk = pc && k.postcode && pc === k.postcode;
    const plaatsOk = plaats && k.woonplaats && normPlaats(k.woonplaats) === plaats;
    return pcOk || plaatsOk;
  });
  if (adresMatch.length === 0) {
    debugLog({ ...baseDebug, gekozen: false, reden: 'postcode_mismatch' });
    return { status: 'controleren', kandidaten, reden: 'Postcode noch plaats komt overeen.', redenCode: 'postcode_mismatch' };
  }

  // 2) Straatnaam (genormaliseerd)
  const straatMatch = inputStraat
    ? adresMatch.filter(k => normStraat(k.straat) === inputStraat)
    : adresMatch;
  if (inputStraat && straatMatch.length === 0) {
    debugLog({ ...baseDebug, gekozen: false, reden: 'street_mismatch' });
    return { status: 'controleren', kandidaten, reden: 'Straatnaam wijkt af.', redenCode: 'street_mismatch' };
  }

  // 3) Toevoegingen
  if (parsed.toevoeging) {
    const exact = straatMatch.filter(k => k.toevoeging === parsed.toevoeging)
      .sort((a, b) => b.score - a.score);
    if (exact.length >= 1) {
      const w = exact[0];
      debugLog({ ...baseDebug, gekozen: true, reden: 'exact_addition_match' });
      return { status: 'auto', lat: w.lat, lng: w.lng, kandidaat: w, reden: 'exact_addition_match' };
    }
    debugLog({ ...baseDebug, gekozen: false, reden: 'addition_mismatch' });
    return { status: 'controleren', kandidaten, reden: 'Toevoeging wijkt af van resultaten.', redenCode: 'addition_mismatch' };
  }

  // Input zónder toevoeging
  const zonder = straatMatch.filter(k => !k.toevoeging).sort((a, b) => b.score - a.score);

  // 3a) Basisadres bestaat uniek → auto, ook al zijn er subadressen
  if (zonder.length === 1) {
    const w = zonder[0];
    debugLog({ ...baseDebug, gekozen: true, reden: 'basic_address_unique' });
    return { status: 'auto', lat: w.lat, lng: w.lng, kandidaat: w, reden: 'basic_address_unique' };
  }
  // 3b) Meerdere basisadressen → pick top als duidelijk hoger
  if (zonder.length > 1) {
    const gap = zonder[0].score - zonder[1].score;
    if (zonder[0].score >= MIN_TOP_SCORE && gap >= MIN_SCORE_GAP) {
      const w = zonder[0];
      debugLog({ ...baseDebug, gekozen: true, reden: 'top_score_dominant' });
      return { status: 'auto', lat: w.lat, lng: w.lng, kandidaat: w, reden: 'top_score_dominant' };
    }
    debugLog({ ...baseDebug, gekozen: false, reden: 'multiple_candidates' });
    return { status: 'controleren', kandidaten, reden: 'Meerdere vergelijkbare kandidaten.', redenCode: 'multiple_candidates' };
  }

  // 3c) Geen basisadres-resultaat, alleen subadressen
  if (straatMatch.length === 1) {
    debugLog({ ...baseDebug, gekozen: false, reden: 'too_uncertain' });
    return { status: 'controleren', kandidaten, reden: 'Resultaat heeft toevoeging, signaal niet.', redenCode: 'too_uncertain' };
  }
  debugLog({ ...baseDebug, gekozen: false, reden: 'multiple_additions' });
  return { status: 'controleren', kandidaten, reden: 'Meerdere toevoegingen gevonden bij dit huisnummer.', redenCode: 'multiple_additions' };
}

export async function geocodeSignaalLocatie(
  inv: SignaalLocatieInvoer,
  opts: { signal?: AbortSignal; fetchImpl?: typeof fetch; signaal_id?: string } = {},
): Promise<GeocodeResultaat> {
  const q = bouwQuery(inv);
  if (!q) {
    return { status: 'overslaan', reden: 'Onvoldoende adresgegevens (geen huisnummer + postcode/plaats).', redenCode: 'insufficient_input' };
  }
  const kandidaten = await pdokAdresZoek(inv, opts);
  return beoordeelKandidaten(inv, kandidaten, { signaal_id: opts.signaal_id });
}

/** UI label voor reden code (NL). */
export function redenLabel(code: GeocodeReden | undefined | null): string {
  switch (code) {
    case 'multiple_candidates': return 'Meerdere vergelijkbare kandidaten';
    case 'multiple_additions': return 'Meerdere toevoegingen bij dit huisnummer';
    case 'addition_mismatch': return 'Toevoeging onzeker';
    case 'street_mismatch': return 'Straatnaam wijkt af';
    case 'postcode_mismatch': return 'Postcode/plaats komt niet overeen';
    case 'too_uncertain': return 'Resultaat heeft toevoeging, signaal niet';
    case 'no_housenumber': return 'Geen huisnummer in signaal';
    case 'no_candidates': return 'Geen PDOK-resultaat';
    case 'insufficient_input': return 'Onvoldoende adresgegevens';
    case 'exact_match':
    case 'exact_addition_match':
    case 'basic_address_unique':
    case 'top_score_dominant': return 'Automatisch gematcht';
    default: return 'Controle nodig';
  }
}
