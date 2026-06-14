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
  | 'exact_text_match'
  | 'exact_addition_match'
  | 'basic_address_unique'
  | 'top_score_dominant'
  | 'multiple_addresses'
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
  | { status: 'auto'; lat: number; lng: number; kandidaat: GeocodeKandidaat; reden: GeocodeReden; debug?: GeocodeDebugInfo }
  | { status: 'controleren'; kandidaten: GeocodeKandidaat[]; reden: string; redenCode: GeocodeReden; debug?: GeocodeDebugInfo }
  | { status: 'geen'; reden: string; redenCode: GeocodeReden; debug?: GeocodeDebugInfo }
  | { status: 'overslaan'; reden: string; redenCode: GeocodeReden; debug?: GeocodeDebugInfo };

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

export interface GeocodeDebugKandidaat {
  id: string;
  weergavenaam: string;
  straat: string | null;
  huisnummer: string | null;
  toevoeging: string | null;
  postcode: string | null;
  plaats: string | null;
  score: number;
  reden: string;
}

export interface GeocodeDebugInfo {
  signal_id?: string;
  titel: string | null;
  adres: string | null;
  plaats: string | null;
  geparseerde_straat: string | null;
  geparseerd_huisnummer: string | null;
  geparseerde_huisletter: string | null;
  geparseerde_toevoeging: string | null;
  gebruikte_pdok_query: string | null;
  resultaat: GeocodeReden | null;
  kandidaten: GeocodeDebugKandidaat[];
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
 * en eventueel trailing postcode + plaats zodat
 * "Maaskade 77A-02 3071ND Rotterdam" netjes naar "Maaskade 77A-02" wordt
 * teruggebracht. Alleen veilig vóór het laatste huisnummer-deel.
 */
function schoonAdres(adres: string): string {
  let s = adres.trim().replace(/\s+/g, ' ');
  // Strip trailing postcode (1234 AB / 1234AB) + eventueel plaatsnaam
  s = s.replace(/\s+\d{4}\s*[A-Z]{2}\b.*$/i, '').trim();
  s = s.replace(/\b(\d{1,5})\s+(in|te|voor)\b\s+[A-Z][A-Za-z'\-\s]+$/u, '$1');
  s = s.replace(/\b(\d{1,5})\s+(in|te|voor)\s*$/u, '$1');
  return s.trim();
}

/**
 * Parser voor vrije-tekst adresvelden (NL).
 * Accepteert o.a. "Damrak 1", "Damrak 1A", "Rijnstraat 101-2",
 * "Derde Schinkelstraat 20-3L", "Damrak 4 hs", "Maaskade 77A-02",
 * "Van Spilbergenstraat 9-H". "Surinameplein 46 in Amsterdam" wordt
 * netjes als huisnummer 46 zonder toevoeging geparseerd.
 *
 * Toevoegingen kunnen alfanumeriek zijn met streep/spatie als interne
 * scheiding (bv "A-02", "3L", "1HG"). Normalisatie strips spaties/strepen
 * en handhaaft max 6 chars.
 */
export function parseAdres(adres: string | null | undefined): ParsedAdres {
  if (!adres) return { straat: null, huisnummer: null, toevoeging: null };
  const trimmed = schoonAdres(adres);
  const m = trimmed.match(
    /^(.+?)\s+(\d{1,5})(?:\s*[-\s/]?\s*([A-Za-z0-9][A-Za-z0-9\-\s/]{0,7}))?\s*$/,
  );
  if (!m) return { straat: trimmed || null, huisnummer: null, toevoeging: null };
  const [, straat, nr, rest] = m;
  return {
    straat: straat.trim() || null,
    huisnummer: nr,
    toevoeging: normToevoeging(rest),
  };
}

/**
 * Whitelist van bekende Nederlandse straat-voorvoegsels. Alleen wanneer het
 * extra deel uit deze whitelist bestaat mag titel-parse de adres-straat
 * verlengen. Voorkomt dat "Vergunning kamerverhuur IJsselmondselaan" als
 * straatnaam wordt opgevat.
 */
const STRAAT_PREFIX_WOORDEN = new Set<string>([
  'van', 'de', 'der', 'den', 'het', "'s", "'s-", 'ten', 'ter', 'op', 'aan',
  'in', 'bij', 'te', 'sint', 'st', 'st.',
  'oude', 'nieuwe', 'korte', 'lange', 'grote', 'groote', 'kleine', 'hoge', 'hooge', 'lage',
  '1e', '2e', '3e', '4e', '5e', '6e', '7e', '8e', '9e',
  'eerste', 'tweede', 'derde', 'vierde', 'vijfde', 'zesde', 'zevende', 'achtste', 'negende',
  'prof', 'prof.', 'dr', 'dr.', 'mr', 'mr.', 'ir', 'ir.', 'jhr', 'jhr.',
  'oud', 'nieuw', 'noord', 'zuid', 'oost', 'west',
]);

const STRAAT_TUSSENVOEGSELS = new Set<string>([
  'van', 'de', 'der', 'den', 'ten', 'ter', 'op', 'aan', 'in', 'bij', 'te', "'s", "'s-",
]);

const TITEL_GEEN_STRAAT_WOORDEN = new Set<string>([
  'aanvraag', 'aangevraagde', 'vergunning', 'omgevingsvergunning', 'kamerverhuur',
  'besluit', 'melding', 'verleend', 'geweigerd', 'ontvangen', 'bekendmaking',
]);

function isLegitiemStraatPrefix(extra: string): boolean {
  const woorden = extra.trim().split(/\s+/).filter(Boolean);
  if (woorden.length === 0 || woorden.length > 3) return false;
  return woorden.every(w => STRAAT_PREFIX_WOORDEN.has(w.toLowerCase()));
}

function straatVerlengingUitTitel(extra: string, basisStraat: string): string | null {
  const woorden = extra.trim().split(/\s+/).filter(Boolean);
  if (woorden.length === 0) return null;
  if (isLegitiemStraatPrefix(extra)) return `${extra.trim()} ${basisStraat}`.trim();

  // Straatnamen als "Godijn van Dormaalstraat" worden soms in het adresveld
  // als alleen "Dormaalstraat" opgeslagen. Pak dan de kortste plausibele
  // suffix uit de titel, maar nooit documentwoorden zoals "Vergunning".
  for (let i = Math.max(0, woorden.length - 3); i < woorden.length; i += 1) {
    const deel = woorden.slice(i);
    if (deel.length < 2 || deel.length > 3) continue;
    const lower = deel.map(w => w.toLowerCase());
    if (lower.some(w => TITEL_GEEN_STRAAT_WOORDEN.has(w))) continue;
    if (STRAAT_TUSSENVOEGSELS.has(lower[lower.length - 1])) {
      return `${deel.join(' ')} ${basisStraat}`.trim();
    }
  }
  return null;
}

/**
 * Combineer adres-parse met titel-parse: adres heeft prioriteit, titel vult
 * alleen aan (toevoeging, langere straat zoals "Derde Schinkelstraat"). Het
 * extra deel uit titel moet uit bekende voorvoegsels bestaan, anders blijft
 * de adres-straat ongewijzigd.
 */
export function combineerParsed(adresParsed: ParsedAdres, titel: string | null | undefined): ParsedAdres {
  if (!titel) return adresParsed;
  const t = parseAdres(titel);
  if (!t.huisnummer) return adresParsed;
  if (adresParsed.huisnummer && t.huisnummer !== adresParsed.huisnummer) return adresParsed;
  const out: ParsedAdres = { ...adresParsed };
  if (!out.huisnummer) out.huisnummer = t.huisnummer;
  // Toevoeging: titel mag aanvullen of verfijnen. Als titel-toevoeging
  // specifieker is dan adres-toevoeging (bv adres "A", titel "A02"),
  // gebruik dan de specifiekere variant uit de titel.
  if (t.toevoeging) {
    if (!out.toevoeging) {
      out.toevoeging = t.toevoeging;
    } else if (
      t.toevoeging !== out.toevoeging &&
      t.toevoeging.length > out.toevoeging.length &&
      t.toevoeging.startsWith(out.toevoeging)
    ) {
      out.toevoeging = t.toevoeging;
    }
  }
  if (out.straat && t.straat) {
    const aN = stripDiacritics(out.straat.toLowerCase()).replace(/\s+/g, ' ');
    const tN = stripDiacritics(t.straat.toLowerCase()).replace(/\s+/g, ' ');
    if (tN !== aN && tN.endsWith(' ' + aN) && tN.length > aN.length) {
      const extra = tN.slice(0, tN.length - aN.length).trim();
      if (isLegitiemStraatPrefix(extra)) {
        out.straat = t.straat;
      } else {
        const extraOrig = t.straat.slice(0, t.straat.length - out.straat.length).trim();
        const verlengd = straatVerlengingUitTitel(extraOrig, out.straat);
        if (verlengd) out.straat = verlengd;
      }
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
  const re = new RegExp(`\\b${huisnummer}\\s*([A-Za-z](?:\\s*[-/]?\\s*[A-Za-z0-9]{1,3})?|[-/]\\s*[A-Za-z0-9]{1,4})?(?=\\s*,|\\s|$)`, 'i');
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

function normVrijeTekst(s: string | null | undefined): string {
  if (!s) return '';
  let n = stripDiacritics(s)
    .toLowerCase()
    .replace(/\b(\d{4})\s*([a-z]{2})\b/g, '$1$2')
    .replace(/[,.;:()]+/g, ' ');
  // Normaliseer huisletter/toevoeging zodat titel en PDOK-weergave dezelfde
  // vorm krijgen: 67A-1 = 67A-01, 300-2 = 300-02, 22-H blijft 22 H.
  n = n
    .replace(/\b(\d{1,5})\s*([a-z])\s*[-/]?\s*0*(\d{1,3})\b/g, '$1$2 $3')
    .replace(/\b(\d{1,5})\s*[-/]\s*0*(\d{1,3})\b/g, '$1 $2')
    .replace(/\b(\d{1,5})\s*[-/]\s*([a-z]{1,3})\b/g, '$1 $2')
    .replace(/\b(\d{1,5})\s+([a-z])\b/g, '$1$2');
  return n
    .replace(/[\s\-/]+/g, ' ')
    .trim();
}

function normStraat(s: string | null | undefined): string | null {
  if (!s) return null;
  let n = stripDiacritics(s.trim().toLowerCase()).replace(/\s+/g, ' ');
  // OCR/typo: lowercase L gevolgd door J aan begin van een woord → ij
  // ("lJsselmondselaan" → "ijsselmondselaan").
  n = n.replace(/(^|\s)lj/g, '$1ij');
  // Verwijder leestekens die niet zinvol zijn voor vergelijking
  n = n.replace(/[.,;:]/g, '').replace(/\s+/g, ' ').trim();
  return n || null;
}

function kandidaatTeksten(k: GeocodeKandidaat): string[] {
  const pc = normPostcode(k.postcode);
  const basis = [k.straat, k.huisnummer, k.toevoeging].filter(Boolean).join(' ');
  const weergaveZonderPlaats = k.weergavenaam.split(',')[0] ?? k.weergavenaam;
  return [
    k.weergavenaam,
    weergaveZonderPlaats,
    [basis, pc, k.woonplaats].filter(Boolean).join(' '),
    basis,
  ].filter(Boolean);
}

function kandidaatMatchKey(k: GeocodeKandidaat): string {
  return normVrijeTekst(k.weergavenaam.split(',')[0] ?? k.weergavenaam);
}

function tekstBevatKandidaat(inv: SignaalLocatieInvoer, k: GeocodeKandidaat): boolean {
  const bron = normVrijeTekst([inv.titel, inv.adres, inv.postcode, inv.plaats].filter(Boolean).join(' '));
  if (!bron) return false;
  return kandidaatTeksten(k).some(t => {
    const nt = normVrijeTekst(t);
    if (nt.length < 8) return false;
    const esc = nt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(^|\\s)${esc}(\\s|$)`).test(bron);
  });
}

function straatKomtVoorInTekst(inv: SignaalLocatieInvoer, straat: string | null | undefined): boolean {
  const ns = normVrijeTekst(straat);
  if (!ns || ns.length < 6) return false;
  const bron = normVrijeTekst([inv.titel, inv.adres].filter(Boolean).join(' '));
  if (!bron) return false;
  const esc = ns.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|\\s)${esc}(\\s|$)`).test(bron);
}

function langereKandidaatStraatUitTekst(
  inv: SignaalLocatieInvoer,
  kandidaten: GeocodeKandidaat[],
  inputStraat: string | null,
): string | null {
  if (!inputStraat) return null;
  const mogelijke = kandidaten
    .map(k => ({ raw: k.straat, norm: normStraat(k.straat) }))
    .filter((s): s is { raw: string; norm: string } => !!s.raw && !!s.norm)
    .filter(s => s.norm !== inputStraat && s.norm.endsWith(` ${inputStraat}`))
    .filter(s => straatKomtVoorInTekst(inv, s.raw))
    .sort((a, b) => b.norm.length - a.norm.length);
  return mogelijke[0]?.norm ?? null;
}

function splitHuisletterToevoeging(toevoeging: string | null): { huisletter: string | null; toevoeging: string | null } {
  if (!toevoeging) return { huisletter: null, toevoeging: null };
  const m = toevoeging.match(/^([A-Z])(.+)?$/);
  if (!m) return { huisletter: null, toevoeging };
  return { huisletter: m[1], toevoeging: m[2] ?? null };
}

function kandidaatDebugReden(
  inv: SignaalLocatieInvoer,
  k: GeocodeKandidaat,
  parsed: ParsedAdres,
  pc: string | null,
  plaats: string | null,
  inputStraat: string | null,
): string {
  if (tekstBevatKandidaat(inv, k)) return 'Exacte kandidaat gevonden in titel.';
  if (!parsed.huisnummer) return 'Geen huisnummer in input.';
  if (String(k.huisnummer ?? '') !== String(parsed.huisnummer)) return 'Huisnummer wijkt af.';
  const pcOk = pc && k.postcode && pc === k.postcode;
  const plaatsOk = plaats && k.woonplaats && normPlaats(k.woonplaats) === plaats;
  if (!pcOk && !plaatsOk) return 'Postcode noch plaats komt overeen.';
  if (inputStraat && normStraat(k.straat) !== inputStraat) return 'Straatnaam wijkt af van parser-output.';
  if (parsed.toevoeging) {
    return k.toevoeging === parsed.toevoeging ? 'Exacte toevoeging.' : 'Toevoeging wijkt af.';
  }
  return k.toevoeging ? 'Kandidaat heeft toevoeging, signaal niet.' : 'Basisadres match.';
}

export function maakGeocodeDebug(
  inv: SignaalLocatieInvoer,
  kandidaten: GeocodeKandidaat[],
  resultaat: GeocodeReden | null,
  debugCtx: { signaal_id?: string } = {},
): GeocodeDebugInfo {
  const parsed = combineerParsed(parseAdres(inv.adres), inv.titel);
  const pc = normPostcode(inv.postcode);
  const plaats = normPlaats(inv.plaats);
  const inputStraat = normStraat(parsed.straat);
  const split = splitHuisletterToevoeging(parsed.toevoeging);
  return {
    signal_id: debugCtx.signaal_id,
    titel: inv.titel ?? null,
    adres: inv.adres ?? null,
    plaats: inv.plaats ?? null,
    geparseerde_straat: parsed.straat,
    geparseerd_huisnummer: parsed.huisnummer,
    geparseerde_huisletter: split.huisletter,
    geparseerde_toevoeging: split.toevoeging,
    gebruikte_pdok_query: bouwQuery(inv),
    resultaat,
    kandidaten: kandidaten.slice(0, 10).map(k => ({
      id: k.id,
      weergavenaam: k.weergavenaam,
      straat: k.straat,
      huisnummer: k.huisnummer,
      toevoeging: k.toevoeging,
      postcode: k.postcode,
      plaats: k.woonplaats,
      score: tekstBevatKandidaat(inv, k) ? Math.max(95, k.score) : k.score,
      reden: kandidaatDebugReden(inv, k, parsed, pc, plaats, inputStraat),
    })),
  };
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

  // Sterkste runtime-regel: als de volledige PDOK-adresstring letterlijk in
  // titel/originele tekst staat, wint die vóór parser-twijfel of suffix-fouten.
  const tekstMatches = kandidaten
    .filter(k => tekstBevatKandidaat(inv, k))
    .sort((a, b) => b.score - a.score);
  const tekstMatchKeys = new Set(tekstMatches.map(kandidaatMatchKey).filter(Boolean));
  if (tekstMatches.length > 0 && tekstMatchKeys.size === 1) {
    const w = { ...tekstMatches[0], score: Math.max(95, tekstMatches[0].score) };
    debugLog({ ...baseDebug, gekozen: true, reden: 'exact_text_match' });
    return { status: 'auto', lat: w.lat, lng: w.lng, kandidaat: w, reden: 'exact_text_match' };
  }
  if (tekstMatchKeys.size > 1) {
    const keys = [...tekstMatchKeys].sort((a, b) => b.length - a.length);
    const langsteKey = keys[0];
    const kortereSuffixenVanZelfdeAdres = keys.slice(1).every(k => langsteKey.endsWith(` ${k}`));
    if (kortereSuffixenVanZelfdeAdres) {
      const w0 = tekstMatches.find(k => kandidaatMatchKey(k) === langsteKey) ?? tekstMatches[0];
      const w = { ...w0, score: Math.max(95, w0.score) };
      debugLog({ ...baseDebug, gekozen: true, reden: 'exact_text_match' });
      return { status: 'auto', lat: w.lat, lng: w.lng, kandidaat: w, reden: 'exact_text_match' };
    }
    debugLog({ ...baseDebug, gekozen: false, reden: 'multiple_addresses' });
    return { status: 'controleren', kandidaten, reden: 'Meerdere adressen gevonden.', redenCode: 'multiple_addresses' };
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
  const effectieveInputStraat = langereKandidaatStraatUitTekst(inv, adresMatch, inputStraat) ?? inputStraat;
  const straatMatch = effectieveInputStraat
    ? adresMatch.filter(k => normStraat(k.straat) === effectieveInputStraat)
    : adresMatch;
  if (effectieveInputStraat && straatMatch.length === 0) {
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
    return {
      status: 'overslaan',
      reden: 'Onvoldoende adresgegevens (geen huisnummer + postcode/plaats).',
      redenCode: 'insufficient_input',
      debug: maakGeocodeDebug(inv, [], 'insufficient_input', { signaal_id: opts.signaal_id }),
    };
  }
  const kandidaten = await pdokAdresZoek(inv, opts);
  const resultaat = beoordeelKandidaten(inv, kandidaten, { signaal_id: opts.signaal_id });
  const debugReden = resultaat.status === 'auto' ? resultaat.reden : resultaat.redenCode;
  return { ...resultaat, debug: maakGeocodeDebug(inv, kandidaten, debugReden, { signaal_id: opts.signaal_id }) };
}

/** UI label voor reden code (NL). */
export function redenLabel(code: GeocodeReden | undefined | null): string {
  switch (code) {
    case 'multiple_addresses': return 'Meerdere adressen gevonden';
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
    case 'exact_text_match':
    case 'exact_addition_match':
    case 'basic_address_unique':
    case 'top_score_dominant': return 'Automatisch gematcht';
    default: return 'Controle nodig';
  }
}
