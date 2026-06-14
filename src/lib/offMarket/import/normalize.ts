// Normalisatie + relevantiescore + dedupe voor off-market auto-import.
// Pure functies — testbaar in Vitest, gedeeld met edge function (inline gekopieerd).

export interface BronConfig {
  positieve_keywords: string[];
  negatieve_keywords: string[];
  score_drempel: number;
  gemeente: string;
  provincie: string;
}

export interface NormalizedInput {
  titel: string;
  samenvatting: string;
  subjects: string[];
  datum: string | null;
}

export interface AdresParseResult {
  adres: string | null;
  postcode: string | null;
  plaats: string | null;
}

const STRAAT_SUFFIXEN = [
  'straat','laan','weg','plein','kade','gracht','singel','dreef','hof','park',
  'baan','dijk','markt','wal','pad','steeg','rak','sloot','burg','polder',
  'plantsoen','brink','boulevard','allee',
].join('|');

// Toegestane tussenvoegsels (lowercase) voor straatnamen als "Van der Helststraat".
const TUSSENVOEGSEL = '(?:van|der|den|de|het|ten|ter|aan|op|in|t)';
// Woorden die nooit deel uitmaken van een straatnaam (titel-ruis).
const NOISE_WOORD = '(?:aanvraag|aangevraagd|vergunning|omgevingsvergunning|omzettingsvergunning|splitsingsvergunning|woonvormingsvergunning|onttrekkingsvergunning|verleende|verleend|besluit|besluiten|bekendmaking|kennisgeving|melding|voor|het|de|een|aan|locatie|adres|pand|gebouw|complex|wijzigen|veranderen|verbouwen|intern|aangevraagde)';
const PREFIX_WOORD = `(?!${NOISE_WOORD}\\b)(?:[A-ZÀ-Ý][\\wÀ-ÿ'\\-]*|${TUSSENVOEGSEL})\\.?`;

// Hoofdregex: optioneel 0–3 prefixwoorden ("John ", "Van der "),
// dan een woord dat eindigt op een straatsuffix, dan huisnummer +
// optionele huisletter + optionele toevoeging na streepje.
const STRAAT_RE = new RegExp(
  `((?:${PREFIX_WOORD}\\s+){0,3}(?!${NOISE_WOORD}\\b)[A-ZÀ-Ý][\\wÀ-ÿ'\\-]*?(?:${STRAAT_SUFFIXEN}))\\.?\\s+(\\d{1,4})([A-Za-z])?(?:-([A-Za-z0-9]{1,4}))?\\b`,
);
const POSTCODE_RE = /\b([1-9]\d{3})\s?([A-Z]{2})\b/;
// Plaats direct na postcode: "1075EP Amsterdam".
const PLAATS_NA_POSTCODE_RE = /\b[1-9]\d{3}\s?[A-Z]{2}\s+([A-ZÀ-Ý][\wÀ-ÿ'\-]+(?:\s+[A-ZÀ-Ý][\wÀ-ÿ'\-]+){0,2})/;
// Plaats achter "in"/"te": "in Amsterdam", "te Rotterdam".
const PLAATS_IN_TE_RE = /\b(?:in|te)\s+([A-ZÀ-Ý][\wÀ-ÿ'\-]+(?:\s+[A-ZÀ-Ý][\wÀ-ÿ'\-]+){0,2})\b/;

/** Adres-extractor: vindt meest specifieke straat+huisnummer(+letter+toevoeging)
 * en, indien aanwezig, postcode en plaats. */
export function parseAdres(text: string): AdresParseResult {
  if (!text) return { adres: null, postcode: null, plaats: null };
  const norm = text.replace(/\s+/g, ' ').trim();
  const straat = norm.match(STRAAT_RE);
  const postcode = norm.match(POSTCODE_RE);
  let adres: string | null = null;
  if (straat) {
    const straatnaam = straat[1].replace(/\s+/g, ' ').trim();
    const nr = straat[2];
    const letter = straat[3] ?? '';
    const toev = straat[4] ?? '';
    adres = `${straatnaam} ${nr}${letter}${toev ? `-${toev}` : ''}`.trim();
  }
  let plaats: string | null = null;
  const naPc = norm.match(PLAATS_NA_POSTCODE_RE);
  if (naPc) plaats = naPc[1].trim();
  else {
    const inTe = norm.match(PLAATS_IN_TE_RE);
    if (inTe) plaats = inTe[1].trim();
  }
  return {
    adres,
    postcode: postcode ? `${postcode[1]} ${postcode[2]}` : null,
    plaats,
  };
}

/**
 * Bepaalt of een nieuwe (uit tekst geparste) adresvariant strikter/specifieker
 * is dan de huidig opgeslagen waarden. Retourneert alleen de velden die echt
 * verbeterd moeten worden (anders null). Wijzigt nooit een bestaand huisnummer
 * en overschrijft nooit een al-ingevulde postcode/plaats.
 */
export function verfijnAdresUitTekst(
  huidig: { adres: string | null; postcode: string | null; plaats: string | null },
  text: string,
): { adres?: string; postcode?: string; plaats?: string } | null {
  const nieuw = parseAdres(text);
  const patch: { adres?: string; postcode?: string; plaats?: string } = {};
  const norm = (s: string | null | undefined) => (s ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (nieuw.adres) {
    const h = norm(huidig.adres);
    const n = norm(nieuw.adres);
    if (n && n !== h && (h === '' || n.length > h.length)) {
      const hNr = h.match(/(\d{1,4})/)?.[1];
      const nNr = n.match(/(\d{1,4})/)?.[1];
      if (!hNr || hNr === nNr) patch.adres = nieuw.adres;
    }
  }
  if (nieuw.postcode && !huidig.postcode) patch.postcode = nieuw.postcode;
  if (nieuw.plaats && !huidig.plaats) patch.plaats = nieuw.plaats;
  return Object.keys(patch).length ? patch : null;
}

const ASSETTYPE_KEYWORDS: Array<[RegExp, string]> = [
  // Transformatie eerst — heeft voorrang op losse 'kantoor'/'winkel' match
  [/\b(transformatie|kantoor\s+naar\s+wonen|winkel\s+naar\s+wonen|herontwikkeling)\b/i, 'transformatieobject'],
  [/\b(woon[-\s]?\/?winkelpand|woon\s+winkel)\b/i, 'woon_winkelpand'],
  [/\b(ontwikkellocatie|bouwkavel)\b/i, 'ontwikkellocatie'],
  [/\b(light\s*industrial)\b/i, 'light_industrial'],
  [/\b(logistiek|distributiecentrum|dc\b)/i, 'logistiek'],
  [/\b(zorg|verpleeg|zorginstelling)\b/i, 'zorgvastgoed'],
  [/\b(bedrijfshal|bedrijfscomplex|bedrijfspand)\b/i, 'bedrijfscomplex'],
  [/\b(kantoor|kantoren|office)\b/i, 'kantoor'],
  [/\b(winkel|winkelpand|retail)\b/i, 'winkelpand'],
];

export function detectAssettype(text: string): string {
  for (const [re, type] of ASSETTYPE_KEYWORDS) if (re.test(text)) return type;
  return 'overig';
}

const SIGNAALTYPE_KEYWORDS: Array<[RegExp, string]> = [
  [/\b(transformatie|kantoor\s+naar\s+wonen|winkel\s+naar\s+wonen)\b/i, 'transformatiepotentie'],
  [/\b(functiewijziging|wijzigen\s+gebruik|gebruikswijziging)\b/i, 'functiewijziging'],
  [/\b(leegstand)\b/i, 'leegstand'],
  [/\b(bedrijfsbe[eë]indiging|opheffing|liquidatie)\b/i, 'bedrijfsbeeindiging'],
];

export function detectSignaaltype(text: string): string {
  for (const [re, type] of SIGNAALTYPE_KEYWORDS) if (re.test(text)) return type;
  return 'vergunning_bekendmaking';
}

/** Bron-type-mapping op basis van subjects. */
export function detectBronType(subjects: string[]): 'vergunning' | 'bekendmaking' {
  const blob = subjects.join(' ').toLowerCase();
  return /vergunning/.test(blob) ? 'vergunning' : 'bekendmaking';
}

export interface ScoreComponent {
  label: string;
  delta: number;
}

/**
 * Gewogen positieve patronen — vastgoedrelevante vergunningstypes en signalen.
 * Volgorde = relevantievolgorde voor Bito (splitsing > woonvorming > omzetting > onttrekking > ontwikkeling).
 * Elk patroon telt onafhankelijk op, dus combinaties (bv. omzettingsvergunning + onzelfstandige woonruimten)
 * krijgen automatisch een hogere score.
 */
export const WEIGHTED_POSITIVE: Array<{ re: RegExp; label: string; delta: number }> = [
  // Splitsing / uitponding (hoogste prioriteit — waardecreatie)
  { re: /\bsplitsingsvergunning\b/i, label: 'splitsingsvergunning', delta: 40 },
  // Geen trailing \b zodat "splitsing" óók binnen "splitsingsvergunning" mag stapelen
  { re: /\bsplitsing/i, label: 'splitsing', delta: 30 },
  { re: /\bappartementsrecht(en)?\b/i, label: 'appartementsrecht', delta: 20 },
  { re: /\b(uitponding|uitponden|kadastrale\s+splitsing|juridische\s+splitsing)\b/i, label: 'uitponding', delta: 20 },
  // Woonvorming
  { re: /\bwoonvormingsvergunning\b/i, label: 'woonvormingsvergunning', delta: 35 },
  { re: /\bwoningvorm(?:ing|en)\b/i, label: 'woningvorming', delta: 30 },
  { re: /\b(?:nieuwe\s+)?zelfstandige\s+woonruimte[n]?\b/i, label: 'zelfstandige woonruimte', delta: 20 },
  // Omzetting / kamerverhuur
  { re: /\bomzettingsvergunning\b/i, label: 'omzettingsvergunning', delta: 35 },
  { re: /\bonzelfstandige\s+woonruimte[n]?\b/i, label: 'onzelfstandige woonruimte', delta: 35 },
  { re: /\b(kamergewijze\s+verhuur|kamerverhuur|woningdelen)\b/i, label: 'kamerverhuur', delta: 25 },
  { re: /\bvan\s+\d+\b[^.\n]{0,60}\b(?:naar|in)\s+\d+\b/i, label: 'wijziging aantal kamers', delta: 20 },
  // Onttrekking
  { re: /\bonttrekkingsvergunning\b/i, label: 'onttrekkingsvergunning', delta: 20 },
  // 'tweede woning' = onttrekking voor particuliere tweede-woning-vergunning → geen acquisitiekans.
  // Wordt expliciet negatief gescoord zodat de combinatie onttrekking + tweede woning niet promoveert,
  // maar wel zichtbaar blijft in afgekeurde records met duidelijke skip-reden.
  { re: /\btweede\s+woning\b/i, label: 'tweede woning (geen acquisitiekans)', delta: -40 },
  // Bergingen / niet-woonruimte naar woonruimte (typische transformatie-binnen-pand)
  { re: /\bbergingen?\s+naar\s+woonruimte[n]?\b/i, label: 'bergingen naar woonruimte', delta: 30 },
  { re: /\b(garage|kelder|zolder|bedrijfsruimte)\s+naar\s+woonruimte[n]?\b/i, label: 'ruimte naar woonruimte', delta: 25 },
  // Grotere ontwikkeling / nieuwbouw
  { re: /\bwoningbouwproject\b/i, label: 'woningbouwproject', delta: 25 },
  // Geen leading \b zodat ook "huurappartementen" matcht
  { re: /appartement(?:en|encomplex)?\b/i, label: 'appartementen', delta: 20 },
  { re: /\bnieuwbouw\b/i, label: 'nieuwbouw', delta: 20 },
  // Geen trailing \b zodat ook "sociale huurappartementen" matcht
  { re: /\bsociale\s+huur/i, label: 'sociale huur', delta: 15 },
  { re: /\b(projectontwikkeling|gebiedsontwikkeling|grotere\s+ontwikkeling)\b/i, label: 'projectontwikkeling', delta: 15 },
  // Klassieke transformatiesignalen
  { re: /\b(transformatie|kantoor\s+naar\s+wonen|winkel\s+naar\s+wonen|herontwikkeling)\b/i, label: 'transformatie', delta: 25 },
  { re: /\b(functiewijziging|wijzigen\s+gebruik|gebruikswijziging)\b/i, label: 'functiewijziging', delta: 20 },
  { re: /\bleegstand\b/i, label: 'leegstand', delta: 15 },
  { re: /\b(bedrijfsbe[eë]indiging|opheffing|liquidatie)\b/i, label: 'bedrijfsbeeindiging', delta: 20 },
];

/**
 * Relevantiescore (0-100). Retourneert ook `componenten` met expliciete deltas
 * zodat zichtbaar is waarom een signaal is gepromoveerd of geskipt.
 */
export function scoreRecord(input: NormalizedInput, config: BronConfig): {
  score: number;
  redenen: string[];
  componenten: ScoreComponent[];
} {
  const blob = `${input.titel} ${input.samenvatting} ${input.subjects.join(' ')}`;
  const blobLower = blob.toLowerCase();
  const redenen: string[] = [];
  const componenten: ScoreComponent[] = [];
  let score = 0;

  // Negatieve keywords (ruis / onderhoud) blijven hard -40
  const negHits = config.negatieve_keywords.filter(k => blobLower.includes(k.toLowerCase()));
  if (negHits.length > 0) {
    score -= 40;
    redenen.push(`negatief: ${negHits.join(',')}`);
    componenten.push({ label: `onderhoud/ruis (${negHits.join(',')})`, delta: -40 });
  }

  // Gewogen positieve patronen (vergunningstypes met expliciet gewicht)
  for (const w of WEIGHTED_POSITIVE) {
    if (w.re.test(blob)) {
      score += w.delta;
      redenen.push(`+${w.delta} ${w.label}`);
      componenten.push({ label: w.label, delta: w.delta });
    }
  }

  // Backwards-compat: extra losse positieve keywords uit bron-config (zonder dubbeltelling)
  const posHits = config.positieve_keywords.filter(k => {
    const kl = k.toLowerCase();
    if (!blobLower.includes(kl)) return false;
    // sla over als al gedekt door een gewogen patroon
    return !componenten.some(c => c.label.toLowerCase().includes(kl) || kl.includes(c.label.toLowerCase()));
  });
  if (posHits.length > 0) {
    score += 10;
    redenen.push(`extra config-keywords: ${posHits.join(',')}`);
    componenten.push({ label: `config-keywords (${posHits.join(',')})`, delta: 10 });
  }

  const adres = parseAdres(`${input.titel} ${input.samenvatting}`);
  if (adres.adres) {
    score += 20;
    redenen.push('adres');
    componenten.push({ label: 'adres', delta: 20 });
  }

  const assettype = detectAssettype(blobLower);
  if (assettype !== 'overig') {
    score += 15;
    redenen.push(`assettype:${assettype}`);
    componenten.push({ label: `assettype:${assettype}`, delta: 15 });
  }

  if (/\b(pand|gebouw|complex|portefeuille|mixed[-\s]?use)\b/i.test(blob)) {
    score += 10;
    redenen.push('commercieel');
    componenten.push({ label: 'commercieel', delta: 10 });
  }

  return { score: Math.max(0, Math.min(100, score)), redenen, componenten };
}

/** Formatteer score-componenten als leesbare regel voor notities/debug. */
export function formatScoreComponenten(componenten: ScoreComponent[]): string {
  if (!componenten.length) return '(geen componenten)';
  return componenten
    .map(c => `${c.delta >= 0 ? '+' : ''}${c.delta} ${c.label}`)
    .join(' · ');
}

/** YYYY-MM uit datum (of "onbekend" als geen datum). */
export function yyyymm(datum: string | null): string {
  if (!datum) return 'onbekend';
  const m = datum.match(/^(\d{4})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}` : 'onbekend';
}

/** Input voor dedupe-hash: stabiel, lowercase. */
export function dedupeHashInput(
  adres: string | null,
  plaats: string | null,
  assettype: string,
  datum: string | null,
): string {
  const a = (adres ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
  const p = (plaats ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
  return `${a}|${p}|${assettype}|${yyyymm(datum)}`;
}

/** sha256 hex via Web Crypto API (werkt in Node 18+, Deno, browser). */
export async function sha256Hex(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// ===== Vergunningtype + aanvraag/besluit detectie (D.1.5) =====

export type Vergunningtype =
  | 'splitsing' | 'woonvorming' | 'omzetting' | 'onttrekking'
  | 'functiewijziging' | 'transformatie' | 'ontwikkeling' | 'overig';

export type AanvraagOfBesluit = 'aanvraag' | 'besluit' | 'melding' | 'onbekend';

const VERGUNNINGTYPE_PATTERNS: Array<[RegExp, Vergunningtype]> = [
  [/\bsplitsingsvergunning\b|\bsplitsing\b|appartementsrecht|uitponding|kadastrale\s+splitsing|juridische\s+splitsing/i, 'splitsing'],
  [/woonvormingsvergunning|woningvorm(?:ing|en)/i, 'woonvorming'],
  [/omzettingsvergunning|onzelfstandige\s+woonruimte|kamergewijze|kamerverhuur|woningdelen/i, 'omzetting'],
  [/onttrekkingsvergunning|onttrekking/i, 'onttrekking'],
  [/functiewijziging|wijzigen\s+gebruik|gebruikswijziging/i, 'functiewijziging'],
  [/transformatie|kantoor\s+naar\s+wonen|winkel\s+naar\s+wonen|bergingen?\s+naar\s+woonruimte/i, 'transformatie'],
  [/woningbouwproject|nieuwbouw|projectontwikkeling|gebiedsontwikkeling|herontwikkeling|appartement/i, 'ontwikkeling'],
];

/** Bepaal vergunningtype op basis van titel + omschrijving. */
export function detectVergunningtype(text: string): Vergunningtype {
  if (!text) return 'overig';
  for (const [re, type] of VERGUNNINGTYPE_PATTERNS) {
    if (re.test(text)) return type;
  }
  return 'overig';
}

/** Bepaal of het om een aanvraag, besluit of melding gaat. */
export function detectAanvraagOfBesluit(text: string, subjects: string[] = []): AanvraagOfBesluit {
  const blob = `${text} ${subjects.join(' ')}`.toLowerCase();
  if (/\b(verleende|verleend|besluit|besluiten|toegekend|toekenning|geweigerd|weigering|ingetrokken|intrekking)\b/.test(blob)) {
    return 'besluit';
  }
  if (/\b(aanvraag|aangevraagd|ingediende?|ingediend)\b/.test(blob)) {
    return 'aanvraag';
  }
  if (/\b(melding|gemeld|kennisgeving)\b/.test(blob)) {
    return 'melding';
  }
  return 'onbekend';
}

