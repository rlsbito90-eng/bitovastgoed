// Deno-kopie van src/lib/kadaster/kadasterPdfAdresParser.ts.
// Functioneel identiek; geen `@/`-aliassen, `isRechtspersoonNaam`
// staat inline zodat deze module geen src-imports nodig heeft.
//
// LET OP: pure functies, geen IO, geen logging van inhoud. Synchroniseer
// handmatig met de src-versie tot we de pure parser naar een
// platform-onafhankelijke locatie verplaatsen.

// @ts-nocheck — Deno runtime

export type KadasterAdresConfidence = 'hoog' | 'middel' | 'laag';
export type KadasterRechtType = 'eigendom' | 'erfpacht' | 'overig';

export interface KadasterAdresVoorstel {
  naam?: string;
  bedrijfsnaam?: string;
  verzendadres?: string;
  confidence: KadasterAdresConfidence;
  bron: 'pdf_text';
  reden?: string;
  rechtType?: KadasterRechtType;
  rolLabel?: string;
  aandeel?: string;
}

const RECHTSVORM_PATRONEN: RegExp[] = [
  /\bB\.?V\.?\b/i, /\bN\.?V\.?\b/i, /\bV\.?O\.?F\.?\b/i, /\bC\.?V\.?\b/i,
  /\bstichting\b/i, /\bvereniging\b/i, /\bco(?:ö|o)peratie\b/i,
  /\bmaatschap\b/i, /\bholding\b/i, /\bbeheer\b/i,
  /\bgmbh\b/i, /\bltd\b/i, /\bs\.?a\.?\b/i,
];

function isRechtspersoonNaam(naam: string | null | undefined): boolean {
  if (!naam) return false;
  const s = naam.trim();
  if (!s) return false;
  if (s.includes('&')) return true;
  return RECHTSVORM_PATRONEN.some((re) => re.test(s));
}

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

const VELD_LABELS = ['Aandeel', 'Naam', 'Geboren', 'te', 'Adres', 'Postbus', 'Zetel', 'KvK-nummer', 'KvK nummer', 'Gebaseerd op'];
const NEGEER_LABELS = new Set(['Geboren', 'Te']);
const INLINE_LABELS = VELD_LABELS.filter(l => l !== 'te' && l !== 'Geboren');
const POSTCODE_RE = /\b(\d{4})\s?([A-Z]{2})\b/;

function stripMarkdown(line: string): string {
  return line.replace(/\*\*/g, '').replace(/^\s*#+\s*/, '').replace(/\s+$/g, '').replace(/^\s+/, '');
}
function normRegels(tekst: string): string[] {
  return tekst.replace(/\r\n/g, '\n').split('\n').map(stripMarkdown)
    .filter((l, i, arr) => !(l === '' && (i === 0 || arr[i - 1] === '')));
}
function normaliseerLabel(lbl: string): string {
  if (/^kvk/i.test(lbl)) return 'KvK-nummer';
  return lbl.charAt(0).toUpperCase() + lbl.slice(1).toLowerCase();
}
function herkenLabel(regel: string): { label: string; rest: string } | null {
  for (const lbl of VELD_LABELS) {
    const re = new RegExp(`^${lbl.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b\\s*:?\\s*(.*)$`, 'i');
    const m = regel.match(re);
    if (m) return { label: normaliseerLabel(lbl), rest: m[1] };
  }
  return null;
}
function splitInlineLabels(regel: string): string[] {
  const pattern = new RegExp(
    `\\s+(${INLINE_LABELS.map(l => l.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')).join('|')})\\b\\s*:?\\s*`, 'g',
  );
  const replaced = regel.replace(pattern, (_m, lbl: string) => `\n${normaliseerLabel(lbl)} `);
  return replaced.split('\n').map(s => s.trim()).filter(Boolean);
}
function leesBlokVelden(blokRegels: string[]): Record<string, string[]> {
  const flat: string[] = [];
  for (const raw of blokRegels) {
    const labelHits = (raw.match(new RegExp(
      `\\b(${INLINE_LABELS.map(l => l.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')).join('|')})\\b`, 'g',
    )) || []).length;
    if (labelHits >= 2) flat.push(...splitInlineLabels(raw));
    else flat.push(raw);
  }
  const velden: Record<string, string[]> = {};
  let huidigLabel: string | null = null;
  for (const regel of flat) {
    const herk = herkenLabel(regel);
    if (herk) {
      if (NEGEER_LABELS.has(herk.label)) { huidigLabel = null; continue; }
      huidigLabel = herk.label;
      if (!velden[huidigLabel]) velden[huidigLabel] = [];
      if (herk.rest.trim()) velden[huidigLabel].push(herk.rest.trim());
    } else if (huidigLabel && regel.trim()) {
      velden[huidigLabel].push(regel.trim());
    }
  }
  return velden;
}
function normaliseerStraatHuisnr(s: string): string {
  return s
    .replace(/([A-Za-zÀ-ÿ.])(\d)/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
}
function formatteerAdres(values: string[] | undefined): string | null {
  if (!values || values.length === 0) return null;
  const samen = values.join(' ').replace(/\s+/g, ' ').trim();
  if (!samen || samen === '-' || samen.toLowerCase() === 'onbekend') return null;
  const m = samen.match(POSTCODE_RE);
  if (!m) return null;
  const postcode = `${m[1]} ${m[2].toUpperCase()}`;
  const idx = samen.search(POSTCODE_RE);
  const straatDeel = normaliseerStraatHuisnr(
    samen.slice(0, idx).trim().replace(/[,\s]+$/, ''),
  );
  const naPostcode = samen.slice(idx + m[0].length).trim().replace(/^[,\s]+/, '');
  const plaats = naPostcode.split(/\s+/)[0]?.toUpperCase() || '';
  if (!straatDeel) return null;
  return `${straatDeel}\n${plaats ? `${postcode} ${plaats}` : postcode}`;
}
function formatteerPostbusAdres(values: string[] | undefined): string | null {
  if (!values || values.length === 0) return null;
  const samen = values.join(' ').replace(/\s+/g, ' ').trim();
  if (!samen || samen === '-') return null;
  const nrMatch = samen.match(/(\d+)/);
  if (!nrMatch) return null;
  const m = samen.match(POSTCODE_RE);
  if (!m) return null;
  const postcode = `${m[1]} ${m[2].toUpperCase()}`;
  const naPostcode = samen.slice(samen.search(POSTCODE_RE) + m[0].length).trim().replace(/^[,\s]+/, '');
  const plaats = naPostcode.split(/\s+/)[0]?.toUpperCase() || '';
  return `Postbus ${nrMatch[1]}\n${plaats ? `${postcode} ${plaats}` : postcode}`;
}
function adresKey(s: string | null | undefined): string {
  return (s ?? '').replace(/\s+/g, ' ').trim().toUpperCase();
}
function leesObjectAdres(regels: string[]): string | null {
  let start = -1;
  for (let i = 0; i < regels.length; i++) {
    if (OBJECTINFO_HEADER_RE.test(regels[i])) { start = i + 1; break; }
  }
  if (start < 0) return null;
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

export function extractKadasterAdresVoorstellenUitTekst(
  tekst: string | null | undefined,
): KadasterAdresVoorstel[] {
  if (!tekst || typeof tekst !== 'string') return [];
  const regels = normRegels(tekst);
  if (regels.length === 0) return [];
  let secStart = -1;
  let secEind = regels.length;
  for (let i = 0; i < regels.length; i++) {
    if (secStart < 0 && RECHTEN_SECTIE_START_RE.test(regels[i])) { secStart = i + 1; continue; }
    if (secStart >= 0 && RECHTEN_SECTIE_EIND_RE.test(regels[i])) { secEind = i; break; }
  }
  if (secStart < 0) return [];
  const objectAdres = leesObjectAdres(regels);
  const objectAdresKey = adresKey(objectAdres);

  type Blok = { rolLabel: string; rechtType: KadasterRechtType; regels: string[] };
  const blokken: Blok[] = [];
  let huidig: Blok | null = null;
  for (let i = secStart; i < secEind; i++) {
    const r = regels[i];
    if (!r) continue;
    if (OVERIGE_RECHTEN_RE.test(r)) continue;
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
    const verzendadres = formatteerAdres(velden['Adres']);
    if (!verzendadres) continue;
    const heeftEntiteitVelden = !!(velden['KvK-nummer']?.length || velden['Zetel']?.length);
    const isBedrijf = isRechtspersoonNaam(naamRaw) || heeftEntiteitVelden;
    const voorstel: KadasterAdresVoorstel = {
      confidence: 'hoog', bron: 'pdf_text',
      rechtType: blok.rechtType, rolLabel: blok.rolLabel,
    };
    if (isBedrijf) voorstel.bedrijfsnaam = naamRaw;
    else voorstel.naam = naamRaw;
    if (aandeel) voorstel.aandeel = aandeel.trim();
    voorstel.verzendadres = verzendadres;
    const redenen: string[] = [`Adres staat binnen ${blok.rolLabel}-blok`];
    if (objectAdresKey && adresKey(verzendadres) === objectAdresKey) {
      redenen.push('Adres staat binnen eigenaarblok en is gelijk aan objectadres');
      voorstel.confidence = 'middel';
    }
    voorstel.reden = redenen.join('. ');
    voorstellen.push(voorstel);
  }
  return voorstellen;
}
