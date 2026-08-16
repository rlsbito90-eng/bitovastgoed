export type PdfRechtssituatie =
  | 'volle_eigendom'
  | 'erfpacht'
  | 'opstal'
  | 'appartementsrecht'
  | 'overig';

export interface PdfRechthebbende {
  rolLabel: string;
  rechtssituatie: PdfRechtssituatie;
  aandeel: string | null;
  naam: string;
  kvk: string | null;
  straatHuisnummer: string | null;
  postcode: string | null;
  plaats: string | null;
  verzendadres: string | null;
}

const HEADER_DEFS: Array<{
  re: RegExp;
  label: string;
  situatie: PdfRechtssituatie;
}> = [
  { re: /^erfpacht\s*\(recht van\)$/i, label: 'Erfpacht (recht van)', situatie: 'erfpacht' },
  { re: /^opstal\s*\(recht van\)$/i, label: 'Opstal (recht van)', situatie: 'opstal' },
  { re: /^appartementsrecht$/i, label: 'Appartementsrecht', situatie: 'appartementsrecht' },
  { re: /^eigendom\s*\(recht van\)$/i, label: 'Eigendom (recht van)', situatie: 'volle_eigendom' },
  { re: /^vruchtgebruik\s*\(recht van\)$/i, label: 'Vruchtgebruik (recht van)', situatie: 'overig' },
];

const HEADER_GLOBAL = /(Erfpacht\s*\(recht van\)|Opstal\s*\(recht van\)|Appartementsrecht|Eigendom\s*\(recht van\)|Vruchtgebruik\s*\(recht van\))/gi;
const FIELD_GLOBAL = /(Aandeel|Naam|Adres|Postbus|Zetel|KvK[- ]nummer|Gebaseerd op)\b\s*:?\s*/gi;
const POSTCODE_RE = /\b(\d{4})\s*([A-Z]{2})\b/i;

function compactPdfText(raw: string): string {
  return String(raw ?? '')
    .replace(/\u00ad/g, '')
    .replace(/[\r\n\f\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseFields(body: string): Map<string, string> {
  const matches = [...body.matchAll(FIELD_GLOBAL)];
  const fields = new Map<string, string>();

  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const rawLabel = match[1];
    const label = /^kvk/i.test(rawLabel)
      ? 'KvK-nummer'
      : rawLabel[0].toUpperCase() + rawLabel.slice(1).toLowerCase();
    const start = (match.index ?? 0) + match[0].length;
    const end = index + 1 < matches.length ? (matches[index + 1].index ?? body.length) : body.length;
    const value = body.slice(start, end).replace(/\s+/g, ' ').trim();
    if (value && value !== '-') fields.set(label, value);
  }

  return fields;
}

export function parseKadasterPdfAdres(value: string | null | undefined): {
  straatHuisnummer: string;
  postcode: string;
  plaats: string;
  verzendadres: string;
} | null {
  const compact = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (!compact || compact === '-') return null;

  const postcodeMatch = compact.match(POSTCODE_RE);
  if (!postcodeMatch) return null;

  const postcodeIndex = compact.search(POSTCODE_RE);
  let straatHuisnummer = compact.slice(0, postcodeIndex).trim().replace(/[,\s]+$/, '');
  if (!straatHuisnummer) return null;
  straatHuisnummer = straatHuisnummer
    .replace(/([A-Za-zÀ-ÿ.])(\d)/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();

  const plaats = compact
    .slice(postcodeIndex + postcodeMatch[0].length)
    .trim()
    .replace(/^[,\s]+/, '')
    .replace(/\s+/g, ' ');
  if (!plaats) return null;

  const postcode = `${postcodeMatch[1]} ${postcodeMatch[2].toUpperCase()}`;
  return {
    straatHuisnummer,
    postcode,
    plaats,
    verzendadres: `${straatHuisnummer}\n${postcode} ${plaats}`,
  };
}

export function parseKadasterPdfRechten(raw: string): PdfRechthebbende[] {
  const text = compactPdfText(raw);
  if (!text) return [];

  const matches = [...text.matchAll(HEADER_GLOBAL)];
  const rechten: PdfRechthebbende[] = [];

  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const header = match[1].replace(/\s+/g, ' ').trim();
    const def = HEADER_DEFS.find((candidate) => candidate.re.test(header));
    if (!def) continue;

    const start = (match.index ?? 0) + match[0].length;
    let end = index + 1 < matches.length ? (matches[index + 1].index ?? text.length) : text.length;
    const terminal = text.slice(start, end).search(/\b(Bijzonderheden|Koopsom|Gemeentelijke lasten|Buurtstatistieken|Omgeving)\b/i);
    if (terminal >= 0) end = start + terminal;

    const fields = parseFields(text.slice(start, end));
    const naam = fields.get('Naam')?.replace(/\s+/g, ' ').trim() ?? '';
    if (!naam) continue;

    const kvk = fields.get('KvK-nummer')?.match(/\b\d{8}\b/)?.[0] ?? null;
    const adres = parseKadasterPdfAdres(fields.get('Adres') ?? null)
      ?? parseKadasterPdfAdres(fields.get('Postbus') ? `Postbus ${fields.get('Postbus')}` : null);

    rechten.push({
      rolLabel: def.label,
      rechtssituatie: def.situatie,
      aandeel: fields.get('Aandeel')?.match(/\b\d+\s*\/\s*\d+\b/)?.[0]?.replace(/\s+/g, '') ?? null,
      naam,
      kvk,
      straatHuisnummer: adres?.straatHuisnummer ?? null,
      postcode: adres?.postcode ?? null,
      plaats: adres?.plaats ?? null,
      verzendadres: adres?.verzendadres ?? null,
    });
  }

  return rechten;
}
