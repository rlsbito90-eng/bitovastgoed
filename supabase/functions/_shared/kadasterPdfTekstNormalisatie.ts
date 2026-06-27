// Lichte normalisatie van PDF-tekst voor de Kadaster-adresvoorstel-parser.
//
// Doel: alleen layout-ruis verwijderen en doorlopende `unpdf`-tekst weer
// in een regelstructuur brengen die de bestaande pure parser begrijpt.
// GEEN domeinkennis-rewrites, geen wijziging van waarden, geen IO, geen
// logging van inhoud.
//
// Stappen:
//  0. PRE-SPLIT: `unpdf` levert vaak één lange regel. We voegen newlines
//     in vóór bekende Kadaster-rubrieken, rechtenblok-headers en
//     veldlabels, zodat stap 2 daarna echte regels heeft om mee te
//     werken. We doen dit met zero-width lookaheads / sleutelwoorden,
//     zonder de tekst verder te veranderen.
//  1. Form-feeds (`\f`) → newline (pagina-boundary).
//  2. Per pagina: strip kop/voet-regels die matchen op bekende patronen
//     (Kadaster-watermerk, "Pagina X van Y", losse datumstempel).
//  3. Collapse runs van 2+ spaties tot een single newline ALLEEN als er
//     een rechtenblok-label op de regel staat — voorkomt dat kolommen
//     aan elkaar geplakt blijven.
//  4. Trim trailing whitespace per regel.
//  5. Maximaal één lege regel achter elkaar.
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

// ─── PRE-SPLIT ────────────────────────────────────────────────────────────
//
// Anker-lijsten. Volgorde maakt niet uit, omdat we alleen newlines
// invoegen op zero-width / single-space matches. Hoofdletter-gevoelig
// waar de Kadaster-PDF dat ook is (anders verstoren we woorden als
// "Overige rechten").

// 1) Rubriek/sectiekoppen — meestal op eigen regel in de bron-PDF.
const RUBRIEK_PATRONEN: RegExp[] = [
  // "Rechten & aantekeningen" hoort bij actualiteits-/objectinformatie en
  // is NIET de echte rechtensectie. Eerst splitsen zodat de kale "Rechten"
  // hierna apart wordt herkend.
  /(?<!\n)(?=Rechten\s*&\s*aantekeningen\b)/g,
  // Kale "Rechten" — echte rechtensectie. Niet matchen wanneer gevolgd
  // door " & aantekeningen" (lookahead) of wanneer onderdeel van
  // "Overige rechten" (hoofdletter-R vereist via case-sensitive vlag).
  /(?<!\n)(?=Rechten\b(?!\s*&\s*aantekeningen))/g,
  /(?<!\n)(?=Objectinformatie\b)/g,
  /(?<!\n)(?=Algemeen\b)/g,
  /(?<!\n)(?=Kadastrale kaart\b)/g,
  /(?<!\n)(?=Actualiteitsinformatie\b)/g,
  /(?<!\n)(?=Overige rechten\b)/g,
  /(?<!\n)(?=Bijzonderheden\b)/g,
  /(?<!\n)(?=Koopsom\b)/g,
  /(?<!\n)(?=Gemeentelijke lasten\b)/g,
  /(?<!\n)(?=Buurtstatistieken\b)/g,
  /(?<!\n)(?=Omgeving\b)/g,
  /(?<!\n)(?=Publiekrechtelijke beperkingen\b)/g,
];

// 2) Rechtenblok-headers binnen de rechtensectie.
const BLOK_HEADER_PATRONEN: RegExp[] = [
  /(?<!\n)(?=Eigendom \(recht van\))/g,
  /(?<!\n)(?=Erfpacht \(recht van\))/g,
  /(?<!\n)(?=Opstal \(recht van\))/g,
  /(?<!\n)(?=Vruchtgebruik \(recht van\))/g,
  /(?<!\n)(?=Gebruik en bewoning\b)/g,
  /(?<!\n)(?=Appartementsrecht\b)/g,
  /(?<!\n)(?=Tenaamstelling\b)/g,
  /(?<!\n)(?=Gerechtigde\b)/g,
];

// 3) Veldlabels — alleen splitsen op een single space tussen een niet-
// whitespace en het label. Zo splitsen we labels uit één doorlopende
// regel zonder ze los te trekken van prefix-tekst zoals "Voor". De
// labels zijn voldoende uniek (Aandeel, Geboren, Postbus, Zetel,
// "Gebaseerd op Register"). "Naam"/"Adres" kunnen in andere
// rubrieken voorkomen — dat is onschuldig, het levert alleen extra
// regels op zonder rechten-context.
const VELD_LABEL_PATRONEN: RegExp[] = [
  /(?<=\S) (?=Aandeel\b)/g,
  /(?<=\S) (?=Naam\b)/g,
  /(?<=\S) (?=Geboren\b)/g,
  /(?<=\S) (?=Adres\b)/g,
  /(?<=\S) (?=Postbus\b)/g,
  /(?<=\S) (?=Zetel\b)/g,
  /(?<=\S) (?=KvK[\s-]?nummer\b)/g,
  /(?<=\S) (?=Gebaseerd op Register\b)/g,
];

// 4) "te <plaats>" — alleen splitsen na een datum-pattern (DD-MM-JJJJ).
// Voorkomt valse splits op het woord "te" in willekeurige zinnen.
const TE_NA_DATUM_RE = /(\d{2}-\d{2}-\d{4}) (?=te\b)/g;

function preSplit(raw: string): string {
  let s = raw;
  for (const re of RUBRIEK_PATRONEN) s = s.replace(re, '\n');
  for (const re of BLOK_HEADER_PATRONEN) s = s.replace(re, '\n');
  for (const re of VELD_LABEL_PATRONEN) s = s.replace(re, '\n');
  s = s.replace(TE_NA_DATUM_RE, '$1\n');
  return s;
}

export function normaliseerKadasterPdfTekst(raw: string | null | undefined): string {
  if (!raw || typeof raw !== 'string') return '';
  // 0. PRE-SPLIT: doorlopende `unpdf`-regel weer in stukken hakken.
  const stap0 = preSplit(raw);
  // 1. Pagina-boundaries normaliseren.
  const stap1 = stap0.replace(/\f/g, '\n');
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
