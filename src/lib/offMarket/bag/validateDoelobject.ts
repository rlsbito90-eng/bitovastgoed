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

function parseHuisnummer(raw: string | null | undefined): Parsed {
  if (!raw) return { huisnummer: null, huisletter: null, toevoeging: null };
  const s = stripPostcode(String(raw));
  let m = s.match(/\b(\d{1,5})[\s\-]+([A-Za-z0-9]{1,6})\b/);
  if (m) {
    const nr = m[1]; const tv = m[2];
    if (!/^\d{4}[A-Za-z]{0,2}$/.test(tv)) {
      if (/^[A-Za-z]$/.test(tv)) return { huisnummer: nr, huisletter: tv.toUpperCase(), toevoeging: null };
      return { huisnummer: nr, huisletter: null, toevoeging: tv.toUpperCase() };
    }
  }
  m = s.match(/\b(\d{1,5})([A-Za-z])\b/);
  if (m) return { huisnummer: m[1], huisletter: m[2].toUpperCase(), toevoeging: null };
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

export function validateDoelobject(
  s: ValidateSignaalInput,
  c: ValidateKandidaatInput,
): { ok: boolean; reden?: string } {
  const sPc = normPc(s.postcode);
  const parsed = parseSignaal(s);
  const sHn = parsed.huisnummer;
  const sLet = (parsed.huisletter ?? '').toUpperCase() || null;
  const sToe = (parsed.toevoeging ?? '').toUpperCase() || null;

  const cPc = c.postcode ? String(c.postcode).replace(/\s+/g, '').toUpperCase() : null;
  const cHn = c.huisnummer != null ? String(c.huisnummer) : null;
  const cLet = c.huisletter ? String(c.huisletter).toUpperCase() : null;
  const cToe = c.huisnummertoevoeging ? String(c.huisnummertoevoeging).toUpperCase() : null;

  if (!sHn) return { ok: false, reden: 'Signaal mist huisnummer' };
  if (!cHn) return { ok: false, reden: 'Kandidaat mist huisnummer' };
  if (sHn !== cHn) return { ok: false, reden: `huisnummer ${cHn} wijkt af van signaal ${sHn}` };
  if (sPc && cPc && sPc !== cPc) return { ok: false, reden: `postcode ${cPc} wijkt af van signaal ${sPc}` };
  if (sLet || sToe) {
    const ok =
      (sLet && (cLet === sLet || cToe === sLet)) ||
      (sToe && (cToe === sToe || cLet === sToe));
    if (!ok) return { ok: false, reden: `toevoeging "${cLet ?? cToe ?? '-'}" wijkt af van signaal "${sLet ?? sToe}"` };
  }
  return { ok: true };
}
