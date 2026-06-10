// Adresparser voor Kadaster-aanvragen.
// Doel: uit het vrije `objecten.adres` veld + losse postcode/plaats
// betrouwbaar (postcode, [huisnummer+letter+toevoeging]) afleiden.
// Bij twijfel: betrouwbaar=false → frontend toont handmatige invoervelden.

export interface ParsedHuisnummer {
  huisnummer: string;       // numeriek deel, bv "92"
  huisletter?: string;      // 1 letter, bv "A"
  toevoeging?: string;      // overige toevoeging (bv "bis", "1")
  label: string;            // mensleesbaar, bv "92A"
}

export interface ParsedAdres {
  postcode: string | null;  // genormaliseerd "5211 MS"
  straat: string | null;
  huisnummers: ParsedHuisnummer[];
  betrouwbaar: boolean;     // false → vraag gebruiker handmatig
}

const POSTCODE_RE = /\b(\d{4})\s*([A-Z]{2})\b/i;

/** Normaliseer postcode naar "1234 AB". Geeft null bij ongeldig. */
export function normaliseerPostcode(input: string | null | undefined): string | null {
  if (!input) return null;
  const m = String(input).toUpperCase().replace(/\s+/g, '').match(/^(\d{4})([A-Z]{2})$/);
  if (!m) {
    const m2 = String(input).match(POSTCODE_RE);
    if (!m2) return null;
    return `${m2[1]} ${m2[2].toUpperCase()}`;
  }
  return `${m[1]} ${m[2]}`;
}

/** Split label "92A" naar { huisnummer:'92', huisletter:'A' }. */
function splitHuisnummerLabel(raw: string): ParsedHuisnummer | null {
  const m = raw.trim().match(/^(\d{1,6})\s*([A-Za-z])?\s*(?:[-\s]?([A-Za-z0-9]{1,8}))?$/);
  if (!m) return null;
  const huisnummer = m[1];
  const huisletter = m[2] ? m[2].toUpperCase() : undefined;
  const toevoeging = m[3] && m[3].toUpperCase() !== huisletter ? m[3] : undefined;
  const label = `${huisnummer}${huisletter ?? ''}${toevoeging ? ' ' + toevoeging : ''}`;
  return { huisnummer, huisletter, toevoeging, label };
}

/**
 * Probeer een "t/m"-range te expanderen.
 * Voorbeelden die we proberen te dekken:
 *   "92A t/m F"   → 92A..92F
 *   "92A t/m 92F" → 92A..92F
 *   "92 t/m 96"   → 92,93,94,95,96   (cap op 10 om misbruik te voorkomen)
 */
function expandRange(token: string): ParsedHuisnummer[] | null {
  const tm = token.match(/^(\d{1,6})\s*([A-Za-z])?\s*t\/?m\s*(\d{1,6})?\s*([A-Za-z])?$/i);
  if (!tm) return null;
  const startNum = tm[1];
  const startLetter = tm[2]?.toUpperCase();
  const endNum = tm[3] ?? startNum;
  const endLetter = tm[4]?.toUpperCase();

  // Letter-range op zelfde huisnummer
  if (startLetter && endLetter && startNum === endNum) {
    const a = startLetter.charCodeAt(0);
    const b = endLetter.charCodeAt(0);
    if (b < a || b - a > 26) return null;
    const out: ParsedHuisnummer[] = [];
    for (let c = a; c <= b; c++) {
      const L = String.fromCharCode(c);
      out.push({ huisnummer: startNum, huisletter: L, label: `${startNum}${L}` });
    }
    return out;
  }
  // Pure numeric range
  if (!startLetter && !endLetter) {
    const s = parseInt(startNum, 10), e = parseInt(endNum, 10);
    if (e < s || e - s > 10) return null;
    const out: ParsedHuisnummer[] = [];
    for (let n = s; n <= e; n++) out.push({ huisnummer: String(n), label: String(n) });
    return out;
  }
  return null;
}

/** Hoofdparser. */
export function parseObjectAdres(
  adres: string | null | undefined,
  postcodeApart: string | null | undefined,
  plaatsApart: string | null | undefined,
): ParsedAdres {
  const tekst = (adres ?? '').trim();
  let postcode = normaliseerPostcode(postcodeApart);
  if (!postcode) postcode = normaliseerPostcode(tekst);

  if (!tekst) {
    return { postcode, straat: null, huisnummers: [], betrouwbaar: false };
  }

  // Strip postcode + plaats uit de tekst
  let rest = tekst;
  if (postcode) {
    rest = rest.replace(new RegExp(postcode.replace(' ', '\\s*'), 'i'), '').trim();
  }
  if (plaatsApart) {
    rest = rest.replace(new RegExp('\\b' + plaatsApart.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i'), '').trim();
  }
  // Strip trailing leestekens
  rest = rest.replace(/[,;]+\s*$/, '').trim();

  // Eerste niet-cijfer-deel is straat
  const straatMatch = rest.match(/^([A-Za-zÀ-ÿ.'\-\s]+?)(?=\s+\d|$)/);
  const straat = straatMatch ? straatMatch[1].trim() : null;
  const numDeel = straat ? rest.slice(straat.length).trim() : rest;

  // Split op komma's
  const tokens = numDeel.split(/[,;]+/).map(t => t.trim()).filter(Boolean);
  const huisnummers: ParsedHuisnummer[] = [];

  for (const token of tokens) {
    const range = expandRange(token);
    if (range) { huisnummers.push(...range); continue; }
    const single = splitHuisnummerLabel(token);
    if (single) { huisnummers.push(single); continue; }
    // Probeer meerdere getallen binnen één token: "90A 92B"
    const sub = token.split(/\s+/);
    for (const s of sub) {
      const one = splitHuisnummerLabel(s);
      if (one) huisnummers.push(one);
    }
  }

  // Dedup op label
  const uniq = new Map<string, ParsedHuisnummer>();
  for (const h of huisnummers) uniq.set(h.label, h);
  const lijst = Array.from(uniq.values());

  const betrouwbaar = !!postcode && lijst.length > 0;
  return { postcode, straat, huisnummers: lijst, betrouwbaar };
}
