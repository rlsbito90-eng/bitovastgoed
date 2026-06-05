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

const STRAAT_RE =
  /([A-ZÀ-Ý][\wÀ-ÿ\-']{2,40}(?:straat|laan|weg|plein|kade|gracht|singel|dreef|hof|park|baan|dijk|markt|wal|pad|steeg|rak))\.?\s+(\d{1,4})\s*([a-zA-Z]{0,3})\b/;
const POSTCODE_RE = /\b([1-9]\d{3})\s?([A-Z]{2})\b/;

/** Eenvoudige adres-extractor: zoek straat+huisnummer en postcode in tekst. */
export function parseAdres(text: string): AdresParseResult {
  if (!text) return { adres: null, postcode: null, plaats: null };
  const norm = text.replace(/\s+/g, ' ').trim();
  const straat = norm.match(STRAAT_RE);
  const postcode = norm.match(POSTCODE_RE);
  let adres: string | null = null;
  if (straat) {
    adres = `${straat[1].trim()} ${straat[2]}${straat[3] ? straat[3] : ''}`.trim();
  }
  return {
    adres,
    postcode: postcode ? `${postcode[1]} ${postcode[2]}` : null,
    plaats: null, // plaats komt uit bronconfig (gemeente)
  };
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
  { re: /\btweede\s+woning\b/i, label: 'tweede woning', delta: 15 },
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
