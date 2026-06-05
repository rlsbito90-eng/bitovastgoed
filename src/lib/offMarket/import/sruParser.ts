// SRU/Atom parser voor KOOP officielebekendmakingen.nl
// Pure functies — bruikbaar in browser/Node (Vitest) en Deno (edge function).

export interface SruRecord {
  /** Stabiele identifier, bv. "gmb-2026-12345" — gebruikt als extern_id. */
  identifier: string;
  titel: string;
  /** ISO date string. */
  datum: string | null;
  /** Eerste 1000 tekens van abstract/description. */
  samenvatting: string;
  subjects: string[];
  /** Bv. "gemeente Amsterdam". */
  creator: string | null;
  /** Permalink naar bekendmaking. */
  link: string;
}

/** Bouw de SRU-query URL voor KOOP repository.
 *  Subjects worden niet meegestuurd: dt.subject is in praktijk niet doorzoekbaar.
 *  Filtering op subjecten/keywords gebeurt client-side in normalize. */
export function bouwSruUrl(opts: {
  endpoint: string;
  creator: string;
  subjects?: string[]; // genegeerd, behouden voor backwards-compat van bestaande call-sites
  sinceIso: string; // YYYY-MM-DD
  startRecord: number;
  maximumRecords: number;
}): string {
  const cql =
    `(dt.identifier any "gmb") AND (dt.creator="${opts.creator}") AND (dt.modified >= "${opts.sinceIso}")`;
  const params = new URLSearchParams({
    operation: 'searchRetrieve',
    version: '2.0',
    query: cql,
    startRecord: String(opts.startRecord),
    maximumRecords: String(opts.maximumRecords),
  });
  return `${opts.endpoint}?${params.toString()}`;
}

/** Decodeer XML-entities (basis). */
function decodeXml(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, '&');
}

/** Strip XML-tags, normaliseer whitespace. */
function stripTags(s: string): string {
  return decodeXml(s.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

/** Haal alle waarden voor een tagnaam binnen een blok. Namespace-tolerant. */
function pluckAll(block: string, localName: string): string[] {
  const re = new RegExp(
    `<(?:[a-zA-Z0-9]+:)?${localName}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[a-zA-Z0-9]+:)?${localName}>`,
    'g',
  );
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(block)) !== null) {
    const v = stripTags(m[1]);
    if (v) out.push(v);
  }
  return out;
}
function pluckFirst(block: string, localName: string): string | null {
  const all = pluckAll(block, localName);
  return all[0] ?? null;
}

/** Bouw permalink: https://zoek.officielebekendmakingen.nl/<identifier>.html */
export function bouwPermalink(identifier: string): string {
  return `https://zoek.officielebekendmakingen.nl/${identifier}.html`;
}

/** Parse SRU XML-response → records + totaal. Tolerant voor namespaces. */
export function parseSruResponse(xml: string): { records: SruRecord[]; totaal: number } {
  const totaalMatch = xml.match(/<(?:[a-zA-Z0-9]+:)?numberOfRecords[^>]*>(\d+)<\/(?:[a-zA-Z0-9]+:)?numberOfRecords>/);
  const totaal = totaalMatch ? Number(totaalMatch[1]) : 0;

  const recordRe = /<(?:[a-zA-Z0-9]+:)?record(?:\s[^>]*)?>([\s\S]*?)<\/(?:[a-zA-Z0-9]+:)?record>/g;
  const records: SruRecord[] = [];
  let m: RegExpExecArray | null;
  while ((m = recordRe.exec(xml)) !== null) {
    const block = m[1];
    const identifier = pluckFirst(block, 'identifier');
    if (!identifier) continue;
    const titel = pluckFirst(block, 'title') ?? identifier;
    const datum =
      pluckFirst(block, 'modified') ??
      pluckFirst(block, 'available') ??
      pluckFirst(block, 'issued') ??
      null;
    const samenvatting = (
      pluckFirst(block, 'abstract') ??
      pluckFirst(block, 'description') ??
      ''
    ).slice(0, 1000);
    records.push({
      identifier,
      titel: titel.slice(0, 500),
      datum,
      samenvatting,
      subjects: pluckAll(block, 'subject'),
      creator: pluckFirst(block, 'creator'),
      link: bouwPermalink(identifier),
    });
  }
  return { records, totaal };
}
