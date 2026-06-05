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
 * Relevantiescore (0-100). Retourneert ook `componenten` met expliciete deltas
 * zodat zichtbaar is waarom een signaal is gepromoveerd of geskipt.
 */
export function scoreRecord(input: NormalizedInput, config: BronConfig): {
  score: number;
  redenen: string[];
  componenten: ScoreComponent[];
} {
  const blob = `${input.titel} ${input.samenvatting} ${input.subjects.join(' ')}`.toLowerCase();
  const redenen: string[] = [];
  const componenten: ScoreComponent[] = [];
  let score = 0;

  const negHits = config.negatieve_keywords.filter(k => blob.includes(k.toLowerCase()));
  if (negHits.length > 0) {
    score -= 40;
    redenen.push(`negatief: ${negHits.join(',')}`);
    componenten.push({ label: `onderhoud/ruis (${negHits.join(',')})`, delta: -40 });
  }

  const posHits = config.positieve_keywords.filter(k => blob.includes(k.toLowerCase()));
  if (posHits.length > 0) {
    score += 30;
    redenen.push(`positief: ${posHits.join(',')}`);
    componenten.push({ label: `positief (${posHits.join(',')})`, delta: 30 });
  }

  const adres = parseAdres(`${input.titel} ${input.samenvatting}`);
  if (adres.adres) {
    score += 20;
    redenen.push('adres');
    componenten.push({ label: 'adres', delta: 20 });
  }

  const assettype = detectAssettype(blob);
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
