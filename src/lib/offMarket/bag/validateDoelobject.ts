// V2.4 — pure helper voor strikte BAG-doelobject validatie.
// Wordt parallel in supabase/functions/off-market-bag-verrijk/index.ts gespiegeld
// (edge function = Deno, hier = browser/test). Houd de twee implementaties identiek.

export interface ValidateSignaalInput {
  adres?: string | null;
  postcode?: string | null;
  titel?: string | null;
}
export interface ValidateKandidaatInput {
  postcode: string | null;
  huisnummer: string | number | null;
  huisletter: string | null;
  huisnummertoevoeging: string | null;
}

function normPc(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const c = String(raw).replace(/\s+/g, '').toUpperCase();
  return /^\d{4}[A-Z]{2}$/.test(c) ? c : null;
}

interface Parsed { huisnummer: string | null; huisletter: string | null; toevoeging: string | null; }

function stripPostcode(s: string): string {
  // Voorkom dat postcode (1234AB / 1234 AB) als huisletter/toevoeging wordt gelezen.
  return s.replace(/\b\d{4}\s?[A-Za-z]{2}\b/g, ' ');
}

// V2.4 — stopwoorden die NOOIT als huisletter/toevoeging mogen gelden.
const STOPWORDS_NA_HUISNUMMER = new Set<string>([
  'IN','TE','AAN','BIJ','VOOR','VAN','OP','NABIJ','NA','MET','UIT','OM','DE','HET','EEN',
  'AMSTERDAM','ROTTERDAM','UTRECHT','HAAG','DEN','HAARLEM','EINDHOVEN','GRONINGEN',
  'TILBURG','ALMERE','BREDA','NIJMEGEN','APELDOORN','ARNHEM','ZAANSTAD','HAARLEMMERMEER',
  'AMERSFOORT','LEIDEN','MAASTRICHT','DORDRECHT','ZOETERMEER','ZWOLLE','DELFT','DEVENTER',
]);

/** Echte toevoeging/huisletter? Letter, cijfers, cijfer+letter, letter+cijfer of Romeins II/III/IV. */
export function isRealToevoeging(raw: string | null | undefined): boolean {
  if (!raw) return false;
  const t = String(raw).trim().toUpperCase();
  if (!t) return false;
  if (STOPWORDS_NA_HUISNUMMER.has(t)) return false;
  if (/^\d{4}[A-Z]{0,2}$/.test(t)) return false; // postcode-fragment
  if (/^[A-Z]$/.test(t)) return true;
  if (/^\d{1,4}$/.test(t)) return true;
  if (/^\d{1,3}[A-Z]$/.test(t)) return true;
  if (/^[A-Z]\d{1,3}$/.test(t)) return true;
  if (/^(II|III|IV|V|VI|VII|VIII|IX|X)$/.test(t)) return true;
  return false;
}

function parseHuisnummer(raw: string | null | undefined): Parsed {
  if (!raw) return { huisnummer: null, huisletter: null, toevoeging: null };
  const s = stripPostcode(String(raw));
  // 1a) "<nr>-<rest>" met streepje
  let m = s.match(/\b(\d{1,5})-([A-Za-z0-9]{1,6})\b/);
  if (m && isRealToevoeging(m[2])) {
    const nr = m[1]; const tv = m[2].toUpperCase();
    if (/^[A-Z]$/.test(tv)) return { huisnummer: nr, huisletter: tv, toevoeging: null };
    return { huisnummer: nr, huisletter: null, toevoeging: tv };
  }
  // 1b) "<nr> <rest>" met spatie — strenger
  m = s.match(/\b(\d{1,5})\s+([A-Za-z0-9]{1,6})\b/);
  if (m && isRealToevoeging(m[2])) {
    const nr = m[1]; const tv = m[2].toUpperCase();
    if (/^[A-Z]$/.test(tv)) return { huisnummer: nr, huisletter: tv, toevoeging: null };
    return { huisnummer: nr, huisletter: null, toevoeging: tv };
  }
  // 2) "<nr><letter>"
  m = s.match(/\b(\d{1,5})([A-Za-z])\b/);
  if (m) return { huisnummer: m[1], huisletter: m[2].toUpperCase(), toevoeging: null };
  // 3) alleen nummer
  m = s.match(/\b(\d{1,5})\b/);
  if (m) return { huisnummer: m[1], huisletter: null, toevoeging: null };
  return { huisnummer: null, huisletter: null, toevoeging: null };
}

function parseSignaal(s: ValidateSignaalInput): Parsed {
  const a = parseHuisnummer(s.adres);
  if (a.huisnummer && (a.huisletter || a.toevoeging)) return a;
  const t = parseHuisnummer(s.titel);
  const huisnummer = a.huisnummer ?? t.huisnummer ?? null;
  let huisletter: string | null = null;
  let toevoeging: string | null = null;
  if (a.huisnummer && huisnummer && a.huisnummer === huisnummer) {
    huisletter = a.huisletter; toevoeging = a.toevoeging;
  }
  if (!huisletter && !toevoeging && t.huisnummer === huisnummer) {
    huisletter = t.huisletter; toevoeging = t.toevoeging;
  }
  return { huisnummer, huisletter, toevoeging };
}

// Exporteer parser voor tests
export function parseSignaalAdres(s: ValidateSignaalInput): Parsed {
  return parseSignaal(s);
}

export function validateDoelobject(
  s: ValidateSignaalInput,
  c: ValidateKandidaatInput,
): { ok: boolean; reden?: string } {
  const sPc = normPc(s.postcode);
  const parsed = parseSignaal(s);
  const sHn = parsed.huisnummer;
  const sLet = (parsed.huisletter ?? '').toUpperCase() || null;
  const sToe = (parsed.toevoeging ?? '').toUpperCase() || null;
  const sLetReal = isRealToevoeging(sLet) ? sLet : null;
  const sToeReal = isRealToevoeging(sToe) ? sToe : null;

  const cPc = c.postcode ? String(c.postcode).replace(/\s+/g, '').toUpperCase() : null;
  const cHn = c.huisnummer != null ? String(c.huisnummer) : null;
  const cLet = c.huisletter ? String(c.huisletter).toUpperCase() : null;
  const cToe = c.huisnummertoevoeging ? String(c.huisnummertoevoeging).toUpperCase() : null;

  if (!sHn) return { ok: false, reden: 'Signaal mist huisnummer' };
  if (!cHn) return { ok: false, reden: 'Kandidaat mist huisnummer' };
  if (sHn !== cHn) return { ok: false, reden: `huisnummer ${cHn} wijkt af van signaal ${sHn}` };
  if (sPc && cPc && sPc !== cPc) return { ok: false, reden: `postcode ${cPc} wijkt af van signaal ${sPc}` };
  if (sLetReal || sToeReal) {
    const ok =
      (sLetReal && (cLet === sLetReal || cToe === sLetReal)) ||
      (sToeReal && (cToe === sToeReal || cLet === sToeReal));
    if (!ok) return { ok: false, reden: `toevoeging "${cLet ?? cToe ?? '-'}" wijkt af van signaal "${sLetReal ?? sToeReal}"` };
  }
  return { ok: true };
}
