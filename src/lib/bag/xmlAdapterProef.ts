import type { BagBronRecord } from './parserProef';

export interface BagXmlAdapterResultaat {
  records: BagBronRecord[];
  fouten: Array<{
    code: 'onbekend_element' | 'onvolledig_element' | 'ongeldige_waarde';
    element: string;
    reden: string;
  }>;
  checkpoint: {
    ontvangenTekens: number;
    resterendeBufferTekens: number;
  };
}

const RECORD_TAGS = ['Pand', 'Verblijfsobject', 'Nummeraanduiding'] as const;
type RecordTag = (typeof RECORD_TAGS)[number];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function tekstUit(xml: string, lokaalTag: string): string | null {
  const tag = escapeRegExp(lokaalTag);
  const match = xml.match(new RegExp(`<(?:(?:[A-Za-z_][\\w.-]*):)?${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:(?:[A-Za-z_][\\w.-]*):)?${tag}>`, 'i'));
  if (!match) return null;
  const value = match[1]
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .trim();
  return value || null;
}

function tekstenUit(xml: string, lokaalTag: string): string[] {
  const tag = escapeRegExp(lokaalTag);
  const regex = new RegExp(`<(?:(?:[A-Za-z_][\\w.-]*):)?${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:(?:[A-Za-z_][\\w.-]*):)?${tag}>`, 'gi');
  const values: string[] = [];
  for (const match of xml.matchAll(regex)) {
    const value = match[1].replace(/<[^>]+>/g, '').trim();
    if (value) values.push(value);
  }
  return values;
}

function nummer(value: string | null): number | null {
  if (value == null) return null;
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

function parseRecord(tag: RecordTag, xml: string): BagBronRecord {
  const identificatie = tekstUit(xml, 'identificatie') ?? '';
  const status = tekstUit(xml, 'status');

  if (tag === 'Pand') {
    return {
      type: 'pand',
      identificatie,
      bouwjaar: nummer(tekstUit(xml, 'oorspronkelijkBouwjaar')),
      status,
      geometrieWkt: tekstUit(xml, 'geometrieWkt'),
    };
  }

  if (tag === 'Verblijfsobject') {
    return {
      type: 'verblijfsobject',
      identificatie,
      pandIds: tekstenUit(xml, 'pandRef'),
      nummeraanduidingIds: tekstenUit(xml, 'nummeraanduidingRef'),
      gebruiksdoelen: tekstenUit(xml, 'gebruiksdoel'),
      oppervlakte: nummer(tekstUit(xml, 'oppervlakte')),
      status,
    };
  }

  return {
    type: 'nummeraanduiding',
    identificatie,
    openbareRuimteNaam: tekstUit(xml, 'openbareRuimteNaam'),
    huisnummer: nummer(tekstUit(xml, 'huisnummer')),
    huisletter: tekstUit(xml, 'huisletter'),
    huisnummertoevoeging: tekstUit(xml, 'huisnummertoevoeging'),
    postcode: tekstUit(xml, 'postcode'),
    woonplaatsNaam: tekstUit(xml, 'woonplaatsNaam'),
    status,
  };
}

function zoekEersteCompleetRecord(buffer: string): { tag: RecordTag; start: number; einde: number; xml: string } | null {
  let beste: { tag: RecordTag; start: number; einde: number; xml: string } | null = null;
  for (const tag of RECORD_TAGS) {
    const openRegex = new RegExp(`<(?:(?:[A-Za-z_][\\w.-]*):)?${tag}(?:\\s[^>]*)?>`, 'i');
    const open = openRegex.exec(buffer);
    if (!open) continue;
    const closeRegex = new RegExp(`<\\/(?:(?:[A-Za-z_][\\w.-]*):)?${tag}>`, 'i');
    closeRegex.lastIndex = open.index + open[0].length;
    const rest = buffer.slice(open.index + open[0].length);
    const close = closeRegex.exec(rest);
    if (!close) continue;
    const einde = open.index + open[0].length + close.index + close[0].length;
    const kandidaat = { tag, start: open.index, einde, xml: buffer.slice(open.index, einde) };
    if (!beste || kandidaat.start < beste.start) beste = kandidaat;
  }
  return beste;
}

export function parseBagXmlChunks(chunks: string[]): BagXmlAdapterResultaat {
  let buffer = '';
  let ontvangenTekens = 0;
  const records: BagBronRecord[] = [];
  const fouten: BagXmlAdapterResultaat['fouten'] = [];

  for (const chunk of chunks) {
    buffer += chunk;
    ontvangenTekens += chunk.length;

    let record = zoekEersteCompleetRecord(buffer);
    while (record) {
      records.push(parseRecord(record.tag, record.xml));
      buffer = buffer.slice(record.einde);
      record = zoekEersteCompleetRecord(buffer);
    }
  }

  const resterend = buffer.trim();
  if (resterend && RECORD_TAGS.some(tag => new RegExp(`<(?:(?:[A-Za-z_][\\w.-]*):)?${tag}(?:\\s[^>]*)?>`, 'i').test(resterend))) {
    fouten.push({
      code: 'onvolledig_element',
      element: 'BAG-record',
      reden: 'De XML-invoer eindigt midden in een BAG-record.',
    });
  }

  return {
    records,
    fouten,
    checkpoint: {
      ontvangenTekens,
      resterendeBufferTekens: buffer.length,
    },
  };
}
