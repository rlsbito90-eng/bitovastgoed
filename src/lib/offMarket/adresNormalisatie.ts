/**
 * Centrale adresnormalisatie voor de Off-Market Radar.
 *
 * Doel: voorkomen dat vergunnings-/bekendmakingsteksten zoals "Aanvraag",
 * "Vergunning", "Het", "Splitsingsvergunning" in plaats-/adres-/titelvelden
 * blijven hangen en lelijk in de UI worden getoond.
 *
 * Display-first: deze helpers worden overal in de Off-Market UI gebruikt
 * zodat bestaande vervuilde DB-waarden altijd schoon worden weergegeven,
 * los van de eenmalige whitelist-backfill in de migratie.
 */
import { schoonAdresTekst } from './onderzoeksAdres';

/** Woorden die nooit deel uit mogen maken van een plaatsnaam. */
const PLAATS_NOISE_WOORDEN = [
  'aanvraag', 'aanvragen', 'aangevraagd', 'aangevraagde',
  'vergunning', 'vergunningen', 'vergunningaanvraag',
  'omgevingsvergunning', 'splitsingsvergunning', 'omzettingsvergunning',
  'woonvormingsvergunning', 'onttrekkingsvergunning', 'kamerverhuurvergunning',
  'sloopvergunning', 'bouwvergunning',
  'woonvorming', 'omzetting', 'onttrekking', 'ontrekkingsvergunning',
  'bekendmaking', 'bekendmakingen',
  'het', 'de', 'een',
  'besluit', 'besluiten', 'intrekkingsbesluit', 'ontwerpbesluit',
  'melding', 'meldingen',
  'ontwerp', 'kennisgeving', 'kennisgevingen',
  'verleend', 'verleende', 'ingetrokken', 'geweigerd', 'geweigerde',
];

/** Nette schrijfwijze van veel voorkomende NL plaatsnamen (uitzonderingen
 *  op simpele Title Case). Key is lowercase. */
const PLAATS_UITZONDERINGEN: Record<string, string> = {
  'amsterdam': 'Amsterdam',
  'rotterdam': 'Rotterdam',
  'den haag': 'Den Haag',
  "'s-gravenhage": "'s-Gravenhage",
  "s-gravenhage": "'s-Gravenhage",
  "'s-hertogenbosch": "'s-Hertogenbosch",
  "s-hertogenbosch": "'s-Hertogenbosch",
  'den bosch': 'Den Bosch',
  'utrecht': 'Utrecht',
  'eindhoven': 'Eindhoven',
  'groningen': 'Groningen',
  'tilburg': 'Tilburg',
  'almere': 'Almere',
  'breda': 'Breda',
  'nijmegen': 'Nijmegen',
  'haarlem': 'Haarlem',
  'arnhem': 'Arnhem',
  'enschede': 'Enschede',
  'apeldoorn': 'Apeldoorn',
  'amersfoort': 'Amersfoort',
  'zaanstad': 'Zaanstad',
  'zwolle': 'Zwolle',
  'leiden': 'Leiden',
  'maastricht': 'Maastricht',
  'dordrecht': 'Dordrecht',
};

const BESCHRIJVINGS_PATROON = /\b(?:splits(?:en|ing)|gebouw|appartementsrecht(?:en)?|omzetten|omzetting|woning(?:en)?|kamer(?:s)?|realiseren|wijzigen|verbouwen|adres)\b/i;
const STRAAT_SUFFIX = '(?:straat|weg|laan|gracht|kade|plein|singel|dijk|hof|pad|steeg|boulevard|plantsoen|markt|wal|baan|park|allee|avenue|erf)';
const HUISNUMMER = '\\d{1,5}[A-Za-z]?(?:[-/]?[A-Za-z0-9]+)?';
const ADRES_IN_TEKST_RE = new RegExp(
  `\\b([A-ZÀ-Ýa-zà-ÿ'’.-]+(?:\\s+[A-ZÀ-Ýa-zà-ÿ'’.-]+){0,5}${STRAAT_SUFFIX}\\s+${HUISNUMMER}(?:(?:\\s*,\\s*|\\s+en\\s+)${HUISNUMMER})*)\\b`,
  'i',
);

function titleCaseToken(token: string): string {
  if (!token) return token;
  // Houd reeds gemengd geschreven tokens (bv. McDonald) intact, behalve full-upper of full-lower.
  const isAllUpper = token === token.toUpperCase();
  const isAllLower = token === token.toLowerCase();
  if (!isAllUpper && !isAllLower) return token;
  return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
}

function titleCasePlaats(s: string): string {
  return s
    .split(/(\s|-)/)
    .map(part => (/^\s|-$/.test(part) || part === '-' || part === ' ' ? part : titleCaseToken(part)))
    .join('');
}

/**
 * Maak een plaatsveld schoon: strip vergunnings-/bekendmakingsruis en
 * normaliseer hoofdletters. Lege/ongeldige input → lege string.
 */
export function cleanPlaats(raw: string | null | undefined): string {
  if (!raw) return '';
  let t = String(raw).replace(/\s+/g, ' ').trim();
  if (!t) return '';

  // Splits op tokens en filter noise-woorden eruit (case-insensitive).
  const tokens = t.split(' ');
  const filtered = tokens.filter(tok => {
    const low = tok.toLowerCase().replace(/[.,;:]+$/g, '');
    if (!low) return false;
    return !PLAATS_NOISE_WOORDEN.includes(low);
  });
  if (filtered.length === 0) return '';

  t = filtered.join(' ').replace(/\s+/g, ' ').trim();
  const low = t.toLowerCase();
  if (PLAATS_UITZONDERINGEN[low]) return PLAATS_UITZONDERINGEN[low];

  // Probeer ook prefix-match (bv. "amsterdam zuid" → "Amsterdam Zuid")
  return titleCasePlaats(t);
}

/**
 * Maak een adresveld schoon. Hergebruikt de bestaande noise-filter uit
 * `onderzoeksAdres.ts` en trimt trailing leestekens.
 */
export function cleanAdres(raw: string | null | undefined): string {
  if (!raw) return '';
  const schoon = schoonAdresTekst(raw);
  return schoon.replace(/[\s,;:.\-]+$/g, '').trim();
}

interface SignaalAdresInput {
  adres?: string | null;
  plaats?: string | null;
  postcode?: string | null;
  titel?: string | null;
}

function extractAdresUitTekst(raw: string | null | undefined): string {
  const schoon = cleanAdres(raw);
  if (!schoon) return '';

  const suffixMatch = schoon.match(ADRES_IN_TEKST_RE);
  if (suffixMatch?.[1]) return suffixMatch[1].replace(/\s+/g, ' ').trim();

  // Korte adressen zonder klassiek straat-suffix (bv. "Dam 1" / "Rokin 50")
  // accepteren we alleen wanneer de hele waarde compact is en geen omschrijving bevat.
  if (!BESCHRIJVINGS_PATROON.test(schoon)
      && schoon.split(/\s+/).length <= 6
      && /\b\d{1,5}[A-Za-z]?(?:[-/]?[A-Za-z0-9]+)?\b/.test(schoon)) {
    return schoon;
  }

  return '';
}

/**
 * Kies het meest betrouwbare display-adres uit de beschikbare signaalvelden.
 * Een vervuild `adres`-veld met vergunningomschrijving krijgt geen voorrang
 * boven een herleidbaar straat+huisnummer uit `titel`.
 */
export function resolveSignaalAdres(signaal: SignaalAdresInput): string {
  const direct = cleanAdres(signaal.adres ?? '');
  const directExtract = extractAdresUitTekst(signaal.adres);
  const titelExtract = extractAdresUitTekst(signaal.titel);

  if (directExtract && !BESCHRIJVINGS_PATROON.test(direct)) return directExtract;
  if (titelExtract) return titelExtract;
  if (directExtract) return directExtract;
  return direct;
}

/**
 * Display-string voor adres + plaats. Voorbeeld: "Voorbeeldstraat 12 · Amsterdam".
 * - Ontdubbelt als de plaats al in het adres voorkomt.
 * - Toont geen losse separator wanneer een veld ontbreekt.
 */
export function formatSignaalAdres(signaal: SignaalAdresInput): string {
  const adres = resolveSignaalAdres(signaal);
  const plaats = cleanPlaats(signaal.plaats ?? '');
  const adresHeeftPlaats =
    !!plaats && adres.toLowerCase().endsWith(plaats.toLowerCase());

  if (adres && plaats && !adresHeeftPlaats) return `${adres} · ${plaats}`;
  if (adres) return adres;
  if (plaats) return plaats;
  return '';
}

/**
 * Titel-display: gebruikt `signaal.titel` indien aanwezig, strip alleen
 * leidende/afsluitende vergunningsruis. Valt anders terug op het schone adres.
 */
export function formatSignaalTitel(signaal: SignaalAdresInput): string {
  const ruweTitel = (signaal.titel ?? '').replace(/\s+/g, ' ').trim();
  if (ruweTitel) {
    let t = ruweTitel;
    // Verwijder vergunnings-/bekendmakingswoorden enkel aan begin of einde.
    const noise = `(?:${PLAATS_NOISE_WOORDEN.join('|')})`;
    const startRe = new RegExp(`^(?:${noise}\\b[\\s,:.-]*)+`, 'i');
    const endRe = new RegExp(`(?:[\\s,:.-]*\\b${noise})+$`, 'i');
    t = t.replace(startRe, '').replace(endRe, '').trim();
    if (t.length >= 3) return t;
  }
  const fallback = formatSignaalAdres(signaal);
  return fallback || (ruweTitel || '');
}

/**
 * Voor importpad: maak {adres, postcode, plaats} schoon vóór persistentie.
 * Niet-destructief: lege strings blijven leeg (caller bepaalt fallback).
 */
export function normalizeImportedAddressFields(input: {
  adres?: string | null;
  postcode?: string | null;
  plaats?: string | null;
}): { adres: string | null; postcode: string | null; plaats: string | null } {
  const adresSchoon = cleanAdres(input.adres ?? '');
  const plaatsSchoon = cleanPlaats(input.plaats ?? '');
  const postcode = (input.postcode ?? '').toString().trim();
  const postcodeNorm = postcode
    ? postcode.toUpperCase().replace(/^(\d{4})\s*([A-Z]{2})$/, '$1 $2')
    : '';
  return {
    adres: adresSchoon || null,
    postcode: postcodeNorm || null,
    plaats: plaatsSchoon || null,
  };
}
