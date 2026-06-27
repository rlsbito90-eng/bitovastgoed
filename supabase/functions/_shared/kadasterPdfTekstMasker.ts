// Privacy-veilig maskeer-helper voor PDF-debugoutput.
//
// Doel: behoud structuur (regels, spaties, interpunctie, labels) maar maak
// alle persoonsgegevens, adressen, postcodes en datums onleesbaar.
//
// Regels:
//   - elk cijfer → '9'
//   - elke letter in een woord → 'x', TENZIJ het woord exact voorkomt in
//     STRUCTUUR_WOORDEN (case-sensitive op token-niveau).
//   - witruimte, interpunctie en regelovergangen blijven intact.
//
// Pure functie, geen IO, geen logging.

// @ts-nocheck — Deno runtime

const STRUCTUUR_WOORDEN: Set<string> = new Set([
  'Objectinformatie',
  'Algemeen',
  'Rechten',
  'Eigendom',
  'Erfpacht',
  'Overige',
  'Bijzonderheden',
  'Aandeel',
  'Naam',
  'Adres',
  'Postbus',
  'Zetel',
  'Zetel:',
  'KvK-nummer',
  'KvK',
  'Geboren',
  'recht',
  'van',
  'te',
  'Gebaseerd',
  'op',
  'Register',
  'Hyp4',
  'Deel',
  'nummer',
]);

function maskeerToken(token: string): string {
  if (STRUCTUUR_WOORDEN.has(token)) return token;
  let uit = '';
  for (const ch of token) {
    if (/[0-9]/.test(ch)) uit += '9';
    else if (/[A-Za-zÀ-ÿ]/.test(ch)) uit += 'x';
    else uit += ch;
  }
  return uit;
}

export function maskeerPdfDebugTekst(input: string | null | undefined): string {
  if (!input || typeof input !== 'string') return '';
  // Split per regel zodat we regelovergangen behouden.
  const regels = input.split('\n');
  const out: string[] = [];
  for (const regel of regels) {
    // Splits op woordgrenzen die niet-letter/cijfer zijn — behoudt scheiders.
    const stukken = regel.split(/([^A-Za-zÀ-ÿ0-9\-]+)/);
    out.push(stukken.map(s => {
      if (s.length === 0) return s;
      // pure scheider (geen letter/cijfer)
      if (!/[A-Za-zÀ-ÿ0-9]/.test(s)) return s;
      return maskeerToken(s);
    }).join(''));
  }
  return out.join('\n');
}

export function maskeerEersteRegels(input: string | null | undefined, max = 40): string[] {
  if (!input || typeof input !== 'string') return [];
  return input.split('\n').slice(0, max).map(r => maskeerPdfDebugTekst(r));
}

export function maskeerPreview(input: string | null | undefined, maxChars = 1500): string {
  const m = maskeerPdfDebugTekst(input);
  return m.length > maxChars ? m.slice(0, maxChars) : m;
}
