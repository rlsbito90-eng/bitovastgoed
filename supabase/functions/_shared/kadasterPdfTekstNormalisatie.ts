// Lichte normalisatie van PDF-tekst voor de Kadaster-adresvoorstel-parser.
//
// Doel: alleen layout-ruis verwijderen. GEEN domeinkennis, geen rewrite van
// labels of waarden. Pure functie, geen IO, geen logging.
//
// Regels:
//  - Form-feeds (`\f`) → newline (pagina-boundary).
//  - Per pagina: strip kop/voet-regels die matchen op bekende patronen
//    (Kadaster-watermerk, "Pagina X van Y", losse datumstempel).
//  - Collapse runs van 2+ spaties tot een single newline ALLEEN als er
//    een rechtenblok-label op de regel staat — voorkomt dat kolommen
//    aan elkaar geplakt blijven.
//  - Trim trailing whitespace per regel.
//  - Maximaal één lege regel achter elkaar.
//
// Output: tekst die direct aan `extractKadasterAdresVoorstellenUitTekst`
// kan worden gevoed.

// @ts-nocheck — Deno runtime

const HEADER_FOOTER_PATRONEN: RegExp[] = [
  /^Kadaster\b.*$/i,
  /^Pagina\s+\d+(\s+van\s+\d+)?\s*$/i,
  /^Blad\s+\d+(\s+van\s+\d+)?\s*$/i,
  /^\d{1,2}[-/]\d{1,2}[-/]\d{4}\s*$/,
  /^Voor intern gebruik.*$/i,
  /^Eigendomsinformatie\s*$/i,
  /^Datum\s+\d{1,2}[-/]\d{1,2}[-/]\d{4}\s*$/i,
];

const KOLOM_LABEL_RE = /\b(Aandeel|Naam|Adres|Postbus|Zetel|KvK[\s-]?nummer|Gebaseerd op)\b/;

function isRuis(regel: string): boolean {
  const r = regel.trim();
  if (!r) return false;
  return HEADER_FOOTER_PATRONEN.some(re => re.test(r));
}

export function normaliseerKadasterPdfTekst(raw: string | null | undefined): string {
  if (!raw || typeof raw !== 'string') return '';
  // 1. Pagina-boundaries normaliseren.
  const stap1 = raw.replace(/\f/g, '\n');
  // 2. Per regel: trim trailing, kolom-splits.
  const regels = stap1.replace(/\r\n/g, '\n').split('\n').map(r => r.replace(/\s+$/, ''));
  const uit: string[] = [];
  for (const regel of regels) {
    if (isRuis(regel)) continue;
    // Als er meerdere kolom-labels op één regel staan, split op runs
    // van 2+ spaties (typisch kolom-gap uit pdfjs/unpdf output).
    if (KOLOM_LABEL_RE.test(regel) && / {2,}/.test(regel)) {
      const stukken = regel.split(/ {2,}/).map(s => s.trim()).filter(Boolean);
      uit.push(...stukken);
    } else {
      uit.push(regel);
    }
  }
  // 3. Maximaal één lege regel achter elkaar.
  const samen: string[] = [];
  for (let i = 0; i < uit.length; i++) {
    if (uit[i] === '' && samen.length > 0 && samen[samen.length - 1] === '') continue;
    samen.push(uit[i]);
  }
  return samen.join('\n').trim();
}
