// Pure parser voor adresvoorstellen uit Kadasterbericht-TEKST.
//
// Doel: uit reeds geëxtraheerde platte tekst van een Kadasterbericht
// alleen het EIGENAARSADRES uit het rechten-/gerechtigde-/tenaamstelling-
// gedeelte als VOORSTEL halen, met rubriek-context als bron.
//
// Strikte regels:
//  - Het OBJECTADRES bovenaan (rubriek "Objectinformatie") wordt nooit
//    teruggegeven op basis van de objectinformatie-rubriek.
//  - Alleen adressen die aantoonbaar BINNEN een rechtenblok
//    ("Eigendom (recht van)", "Erfpacht (recht van)", "Opstal (recht van)",
//    "Vruchtgebruik (recht van)", "Gebruik en bewoning",
//    "Appartementsrecht", "Tenaamstelling", "Gerechtigde") staan worden
//    overwogen.
//  - Bij twijfel: geen voorstel.
//  - Rechtspersonen blijven als bedrijfsnaam staan; nooit als persoon
//    afkorten.
//  - Geen Kadaster-aanroep, geen PDF-library, geen storage. Pure functie.
//
// Deze module wordt nog niet door UI of edge functions gebruikt.

import { isRechtspersoonNaam } from '@/lib/format/naam';

export type KadasterAdresConfidence = 'hoog' | 'middel' | 'laag';
export type KadasterRechtType = 'eigendom' | 'erfpacht' | 'overig';

export interface KadasterAdresVoorstel {
  naam?: string;
  bedrijfsnaam?: string;
  /** Multiline: "Straat huisnr\nPostcode PLAATS" */
  verzendadres?: string;
  confidence: KadasterAdresConfidence;
  bron: 'pdf_text';
  reden?: string;
  rechtType?: KadasterRechtType;
  rolLabel?: string;
  aandeel?: string;
}

// ─── Constants ─────────────────────────────────────────────────────────────

/**
 * Headers die een nieuw rechtenblok starten. Volgorde maakt niet uit;
 * matching is case-insensitive op de hele regel (na strippen van markdown
 * en interpunctie). `Overige rechten` is GEEN blok zelf — het is alleen
 * een parent-rubriek waar de kinderen (b.v. Erfpacht) onder hangen.
 */
const BLOK_HEADERS: Array<{ re: RegExp; rolLabel: string; rechtType: KadasterRechtType }> = [
  { re: /^eigendom\s*\(recht van\)\s*$/i,       rolLabel: 'Eigendom (recht van)',      rechtType: 'eigendom' },
  { re: /^erfpacht\s*\(recht van\)\s*$/i,       rolLabel: 'Erfpacht (recht van)',      rechtType: 'erfpacht' },
  { re: /^opstal\s*\(recht van\)\s*$/i,         rolLabel: 'Opstal (recht van)',        rechtType: 'overig'   },
  { re: /^vruchtgebruik\s*\(recht van\)\s*$/i,  rolLabel: 'Vruchtgebruik (recht van)', rechtType: 'overig'   },
  { re: /^gebruik en bewoning\s*$/i,            rolLabel: 'Gebruik en bewoning',       rechtType: 'overig'   },
  { re: /^appartementsrecht\s*$/i,              rolLabel: 'Appartementsrecht',         rechtType: 'overig'   },
  { re: /^tenaamstelling\s*$/i,                 rolLabel: 'Tenaamstelling',            rechtType: 'overig'   },
  { re: /^gerechtigde\s*$/i,                    rolLabel: 'Gerechtigde',               rechtType: 'overig'   },
];

const RECHTEN_SECTIE_START_RE = /^rechten\s*$/i;
const RECHTEN_SECTIE_EIND_RE  = /^(bijzonderheden|koopsom|gemeentelijke lasten|buurtstatistieken|omgeving|publiekrechtelijk(e)? beperkingen?)\s*$/i;
const OBJECTINFO_HEADER_RE    = /^objectinformatie\s*$/i;
const OBJECTINFO_EIND_RE      = /^(algemeen|kadastrale kaart|actualiteitsinformatie|rechten)\s*$/i;
const OVERIGE_RECHTEN_RE      = /^overige rechten\s*$/i;

/**
 * Veld-labels binnen een rechtenblok. Volgorde is bewust; "Geboren" en
 * "te" worden NIET in inline-segmentatie meegenomen (geen waarde nodig
 * en "te" is een te generiek woord).
 */
const VELD_LABELS = ['Aandeel', 'Naam', 'Adres', 'Postbus', 'Zetel', 'KvK-nummer', 'KvK nummer', 'Gebaseerd op'];

const POSTCODE_RE = /\b(\d{4})\s?([A-Z]{2})\b/;

// ─── Helpers ───────────────────────────────────────────────────────────────

function stripMarkdown(line: string): string {
  return line
    .replace(/\*\*/g, '')          // bold
    .replace(/^\s*#+\s*/, '')      // leading headers
    .replace(/\s+$/g, '')          // trailing whitespace
    .replace(/^\s+/, '');          // leading whitespace
}

function normRegels(tekst: string): string[] {
  return tekst
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map(stripMarkdown)
    .filter((l, i, arr) => !(l === '' && (i === 0 || arr[i - 1] === '')));
}

/**
 * Verwijder een trailing dubbele punt op een label en geef terug of de
 * regel een bekend veld-label is + de bijbehorende labelnaam.
 */
function herkenLabel(regel: string): { label: string; rest: string } | null {
  // "Adres:" / "Adres" / "Adres Visserstuin 119" / "**Adres:** X"
  for (const lbl of VELD_LABELS) {
    const re = new RegExp(`^${lbl.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b\\s*:?\\s*(.*)$`, 'i');
    const m = regel.match(re);
    if (m) return { label: normaliseerLabel(lbl), rest: m[1] };
  }
  return null;
}

function normaliseerLabel(lbl: string): string {
  if (/^kvk/i.test(lbl)) return 'KvK-nummer';
  return lbl.charAt(0).toUpperCase() + lbl.slice(1).toLowerCase();
}

/**
 * Inline-segmentatie: splits een regel die meerdere labels achter elkaar
 * bevat (b.v. "Aandeel 1/1 Naam X Adres Y 1234AB STAD Postbus - Zetel Z")
 * naar losse label/value-regels.
 */
function splitInlineLabels(regel: string): string[] {
  const pattern = new RegExp(
    `\\s+(${VELD_LABELS.map(l => l.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')).join('|')})\\b\\s*:?\\s*`,
    'g',
  );
  // Vervang elk label door een newline + label.
  const replaced = regel.replace(pattern, (_m, lbl: string) => `\n${normaliseerLabel(lbl)} `);
  return replaced.split('\n').map(s => s.trim()).filter(Boolean);
}

/**
 * Splits een vrije tekst tussen rechten-headers in genormaliseerde
 * "Label: value"-regels. Geeft per blok één map van label → value(s).
 */
function leesBlokVelden(blokRegels: string[]): Record<string, string[]> {
  // Eerst: inline-splitsing per regel (voor compacte single-line blokken).
  const flat: string[] = [];
  for (const raw of blokRegels) {
    // Detecteer of de regel meerdere labels bevat (minstens twee labelhits).
    const labelHits = (raw.match(new RegExp(
      `\\b(${VELD_LABELS.map(l => l.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')).join('|')})\\b`,
      'gi',
    )) || []).length;
    if (labelHits >= 2) {
      flat.push(...splitInlineLabels(raw));
    } else {
      flat.push(raw);
    }
  }

  // Tweede pass: vouw vervolglijnen onder het laatst geziene label.
  const velden: Record<string, string[]> = {};
  let huidigLabel: string | null = null;
  for (const regel of flat) {
    const herk = herkenLabel(regel);
    if (herk) {
      huidigLabel = herk.label;
      if (!velden[huidigLabel]) velden[huidigLabel] = [];
      if (herk.rest.trim()) velden[huidigLabel].push(herk.rest.trim());
    } else if (huidigLabel && regel.trim()) {
      velden[huidigLabel].push(regel.trim());
    }
  }
  return velden;
}

/**
 * Formatteer adreswaarden naar "Straat huisnr\nPostcode PLAATS". Accepteert
 * zowel meerregelige als single-line waarden. Geeft `null` als geen geldig
 * adres kan worden opgebouwd (geen postcode of "-").
 */
function formatteerAdres(values: string[] | undefined): string | null {
  if (!values || values.length === 0) return null;
  const samen = values.join(' ').replace(/\s+/g, ' ').trim();
  if (!samen || samen === '-' || samen.toLowerCase() === 'onbekend') return null;

  const m = samen.match(POSTCODE_RE);
  if (!m) return null;
  const postcode = `${m[1]} ${m[2].toUpperCase()}`;
  const idx = samen.search(POSTCODE_RE);
  const straatDeel = samen.slice(0, idx).trim().replace(/[,\s]+$/, '');
  const naPostcode = samen.slice(idx + m[0].length).trim().replace(/^[,\s]+/, '');
  const plaats = naPostcode.split(/\s+/)[0]?.toUpperCase() || '';

  if (!straatDeel) return null;
  const regel1 = straatDeel;
  const regel2 = plaats ? `${postcode} ${plaats}` : postcode;
  return `${regel1}\n${regel2}`;
}

/** Normaliseer een adres voor vergelijking (whitespace, hoofdletters). */
function adresKey(s: string | null | undefined): string {
  return (s ?? '').replace(/\s+/g, ' ').trim().toUpperCase();
}

/**
 * Pak het objectadres uit de Objectinformatie-rubriek bovenaan, puur om
 * later te kunnen markeren of het eigenaarsadres gelijk is. Wordt nooit
 * zelf als voorstel geretourneerd.
 */
function leesObjectAdres(regels: string[]): string | null {
  let start = -1;
  for (let i = 0; i < regels.length; i++) {
    if (OBJECTINFO_HEADER_RE.test(regels[i])) { start = i + 1; break; }
  }
  if (start < 0) return null;
  // Verzamel de eerste paar niet-lege regels tot een sectie-einde.
  const buffer: string[] = [];
  for (let i = start; i < regels.length && buffer.length < 6; i++) {
    const r = regels[i];
    if (!r) continue;
    if (OBJECTINFO_EIND_RE.test(r)) break;
    buffer.push(r);
  }
  const samen = buffer.join(' ');
  const m = samen.match(POSTCODE_RE);
  if (!m) return null;
  return formatteerAdres([samen]);
}

// ─── Hoofdfunctie ──────────────────────────────────────────────────────────

/**
 * Extraheer adresvoorstellen uit Kadasterbericht-tekst. Conservatief:
 * geeft alleen voorstellen terug wanneer rubriek + adres binnen een
 * rechtenblok aantoonbaar gekoppeld zijn.
 */
export function extractKadasterAdresVoorstellenUitTekst(
  tekst: string | null | undefined,
): KadasterAdresVoorstel[] {
  if (!tekst || typeof tekst !== 'string') return [];
  const regels = normRegels(tekst);
  if (regels.length === 0) return [];

  // Bepaal rechten-sectie grenzen.
  let secStart = -1;
  let secEind = regels.length;
  for (let i = 0; i < regels.length; i++) {
    if (secStart < 0 && RECHTEN_SECTIE_START_RE.test(regels[i])) {
      secStart = i + 1;
      continue;
    }
    if (secStart >= 0 && RECHTEN_SECTIE_EIND_RE.test(regels[i])) {
      secEind = i; break;
    }
  }
  if (secStart < 0) return [];

  const objectAdres = leesObjectAdres(regels);
  const objectAdresKey = adresKey(objectAdres);

  // Splits sectie in blokken op rechten-headers. Een blok loopt van zijn
  // header tot net vóór de volgende blok-header of het sectie-einde.
  // "Overige rechten" wordt overgeslagen als header — kinderen volgen.
  type Blok = { rolLabel: string; rechtType: KadasterRechtType; regels: string[] };
  const blokken: Blok[] = [];
  let huidig: Blok | null = null;
  for (let i = secStart; i < secEind; i++) {
    const r = regels[i];
    if (!r) continue;
    if (OVERIGE_RECHTEN_RE.test(r)) { continue; }
    const header = BLOK_HEADERS.find(h => h.re.test(r));
    if (header) {
      if (huidig) blokken.push(huidig);
      huidig = { rolLabel: header.rolLabel, rechtType: header.rechtType, regels: [] };
      continue;
    }
    if (huidig) huidig.regels.push(r);
  }
  if (huidig) blokken.push(huidig);
  if (blokken.length === 0) return [];

  const voorstellen: KadasterAdresVoorstel[] = [];
  for (const blok of blokken) {
    const velden = leesBlokVelden(blok.regels);
    const aandeel = velden['Aandeel']?.[0] ?? undefined;
    const naamRaw = velden['Naam']?.join(' ').replace(/\s+/g, ' ').trim() ?? '';
    if (!naamRaw) continue;

    const adresWaarden = velden['Adres'];
    const verzendadres = formatteerAdres(adresWaarden);

    // Conservatief: zonder bruikbaar adres geen voorstel.
    if (!verzendadres) continue;

    const isBedrijf = isRechtspersoonNaam(naamRaw);
    const voorstel: KadasterAdresVoorstel = {
      confidence: 'hoog',
      bron: 'pdf_text',
      rechtType: blok.rechtType,
      rolLabel: blok.rolLabel,
    };
    if (isBedrijf) voorstel.bedrijfsnaam = naamRaw;
    else voorstel.naam = naamRaw;
    if (aandeel) voorstel.aandeel = aandeel.trim();
    voorstel.verzendadres = verzendadres;

    const redenen: string[] = [`Adres staat binnen ${blok.rolLabel}-blok`];
    if (objectAdresKey && adresKey(verzendadres) === objectAdresKey) {
      redenen.push('Adres staat binnen eigenaarblok en is gelijk aan objectadres');
      // Confidence iets lager omdat verwarring mogelijk is, maar de
      // rubriek is duidelijk dus middel (niet laag).
      voorstel.confidence = 'middel';
    }
    voorstel.reden = redenen.join('. ');
    voorstellen.push(voorstel);
  }

  return voorstellen;
}
