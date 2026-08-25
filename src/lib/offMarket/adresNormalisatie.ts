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
// Een toevoeging krijgt alleen een extra deel wanneer er daadwerkelijk een - of / staat.
// Zo blijft "487, 489, 491" een reeks huisnummers en wordt 489 niet opgeslokt als toevoeging van 487.
const HUISNUMMER = '\\d{1,5}[A-Za-z]?(?:[-/][A-Za-z0-9]+)?';
const ADRES_VANAF_BEGIN_RE = new RegExp(
  `^(.+?${STRAAT_SUFFIX})\\s+(${HUISNUMMER}(?:(?:\\s*,\\s*|\\s+en\\s+)${HUISNUMMER})*)`,
  'i',
);

function titleCaseToken(token: string): string {
  if (!token) return token;
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

export function cleanPlaats(raw: string | null | undefined): string {
  if (!raw) return '';
  let t = String(raw).replace(/\s+/g, ' ').trim();
  if (!t) return '';

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
  return titleCasePlaats(t);
}

function basicCleanAdres(raw: string | null | undefined): string {
  if (!raw) return '';
  const schoon = schoonAdresTekst(raw);
  return schoon.replace(/[\s,;:.\-]+$/g, '').trim();
}

/**
 * Knip een expliciete omschrijvingsprefix weg. We nemen bewust de laatste
 * "(op) adres"-marker, zodat tekst vóór de werkelijke straatnaam nooit onderdeel
 * van het gevonden adres kan worden.
 */
function vanafExplicieteAdresMarker(s: string): string {
  const marker = /\b(?:op\s+adres|adres)\s+/gi;
  let laatsteEinde = -1;
  let match: RegExpExecArray | null;
  while ((match = marker.exec(s)) !== null) laatsteEinde = marker.lastIndex;
  return laatsteEinde >= 0 ? s.slice(laatsteEinde).trim() : s;
}

function extractAdresUitSchoneTekst(schoon: string): string {
  if (!schoon) return '';

  // Bron-/titeltekst kan na het adres nog postcode en plaats bevatten. Die hoeven
  // niet in de hoofdnaam van het object terecht te komen.
  const kandidaat = vanafExplicieteAdresMarker(schoon)
    .replace(/\s+\d{4}\s?[A-Z]{2}\b.*$/i, '')
    .trim();

  const streetMatch = kandidaat.match(ADRES_VANAF_BEGIN_RE);
  if (streetMatch?.[1] && streetMatch?.[2]) {
    return `${streetMatch[1].trim()} ${streetMatch[2].replace(/\s+/g, ' ').trim()}`;
  }

  // Korte adressen zonder klassiek straat-suffix (bv. Dam 1 / Rokin 50).
  if (!BESCHRIJVINGS_PATROON.test(kandidaat)
      && kandidaat.split(/\s+/).length <= 6
      && new RegExp(`\\b${HUISNUMMER}\\b`, 'i').test(kandidaat)) {
    return kandidaat;
  }

  return '';
}

/**
 * Maak een adresveld schoon. Een reeds correct adres blijft exact behouden;
 * alleen bij duidelijke vergunning-/omschrijvingstekst proberen we een straatadres
 * uit die tekst te isoleren.
 */
export function cleanAdres(raw: string | null | undefined): string {
  const schoon = basicCleanAdres(raw);
  if (!schoon) return '';
  if (!BESCHRIJVINGS_PATROON.test(schoon)) return schoon;
  return extractAdresUitSchoneTekst(schoon) || schoon;
}

interface SignaalAdresInput {
  adres?: string | null;
  plaats?: string | null;
  postcode?: string | null;
  titel?: string | null;
}

function extractAdresUitTekst(raw: string | null | undefined): string {
  const schoon = basicCleanAdres(raw);
  return extractAdresUitSchoneTekst(schoon);
}

/**
 * Kies het meest betrouwbare display-adres uit de beschikbare signaalvelden.
 * Een reeds correct `adres` blijft leidend. Alleen wanneer dat veld duidelijk
 * een vergunningomschrijving is, proberen we eerst een bruikbaar adres uit de
 * titel en daarna uit het vervuilde adresveld te halen.
 */
export function resolveSignaalAdres(signaal: SignaalAdresInput): string {
  const directRuw = basicCleanAdres(signaal.adres);

  if (directRuw && !BESCHRIJVINGS_PATROON.test(directRuw)) return directRuw;

  const titelExtract = extractAdresUitTekst(signaal.titel);
  if (titelExtract) return titelExtract;

  const directExtract = extractAdresUitTekst(signaal.adres);
  if (directExtract) return directExtract;

  return directRuw;
}

export function formatSignaalAdres(signaal: SignaalAdresInput): string {
  const adres = resolveSignaalAdres(signaal);
  const plaats = cleanPlaats(signaal.plaats ?? '');
  const adresHeeftPlaats = !!plaats && adres.toLowerCase().endsWith(plaats.toLowerCase());

  if (adres && plaats && !adresHeeftPlaats) return `${adres} · ${plaats}`;
  if (adres) return adres;
  if (plaats) return plaats;
  return '';
}

export function formatSignaalTitel(signaal: SignaalAdresInput): string {
  const ruweTitel = (signaal.titel ?? '').replace(/\s+/g, ' ').trim();
  if (ruweTitel) {
    let t = ruweTitel;
    const noise = `(?:${PLAATS_NOISE_WOORDEN.join('|')})`;
    const startRe = new RegExp(`^(?:${noise}\\b[\\s,:.-]*)+`, 'i');
    const endRe = new RegExp(`(?:[\\s,:.-]*\\b${noise})+$`, 'i');
    t = t.replace(startRe, '').replace(endRe, '').trim();
    if (t.length >= 3) return t;
  }
  const fallback = formatSignaalAdres(signaal);
  return fallback || (ruweTitel || '');
}

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
