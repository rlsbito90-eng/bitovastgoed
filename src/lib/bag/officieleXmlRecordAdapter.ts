import type { BagBronRecord } from './parserProef';

export interface BagVoorkomenMetadata {
  voorkomenidentificatie: number | null;
  beginGeldigheid: string | null;
  eindGeldigheid: string | null;
  tijdstipRegistratie: string | null;
  eindRegistratie: string | null;
  tijdstipRegistratieLV: string | null;
  tijdstipEindRegistratieLV: string | null;
  tijdstipInactief: string | null;
  tijdstipInactiefLV: string | null;
}

export interface BagRdGeometrie {
  vorm: 'punt' | 'polygoon' | 'geen';
  crs: 'EPSG:28992' | null;
  dimensie: 2 | 3 | null;
  coordinaten: number[];
}

export interface BagOfficieelAdapterRecord {
  objecttype:
    | 'Pand'
    | 'Verblijfsobject'
    | 'Nummeraanduiding'
    | 'OpenbareRuimte'
    | 'Woonplaats'
    | 'Standplaats'
    | 'Ligplaats';
  identificatie: string;
  status: string | null;
  voorkomen: BagVoorkomenMetadata;
  geometrie: BagRdGeometrie;
  relaties: Record<string, string[]>;
  velden: Record<string, string | number | boolean | string[] | null>;
}

export interface BagOfficieelAdapterResultaat {
  record: BagOfficieelAdapterRecord | null;
  parserRecord: BagBronRecord | null;
  fouten: Array<{
    code: 'onbekend_objecttype' | 'ontbrekende_identificatie' | 'ongeldige_geometrie';
    reden: string;
  }>;
}

const OBJECTTYPEN = [
  'Pand',
  'Verblijfsobject',
  'Nummeraanduiding',
  'OpenbareRuimte',
  'Woonplaats',
  'Standplaats',
  'Ligplaats',
] as const;

type Objecttype = (typeof OBJECTTYPEN)[number];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function decodeXml(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function tekstUit(xml: string, tag: string): string | null {
  const escaped = escapeRegExp(tag);
  const match = xml.match(
    new RegExp(`<(?:(?:[A-Za-z_][\\w.-]*):)?${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:(?:[A-Za-z_][\\w.-]*):)?${escaped}>`, 'i'),
  );
  if (!match) return null;
  const value = decodeXml(match[1].replace(/<[^>]+>/g, '').trim());
  return value || null;
}

function tekstenUit(xml: string, tag: string): string[] {
  const escaped = escapeRegExp(tag);
  const regex = new RegExp(
    `<(?:(?:[A-Za-z_][\\w.-]*):)?${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:(?:[A-Za-z_][\\w.-]*):)?${escaped}>`,
    'gi',
  );
  return [...xml.matchAll(regex)]
    .map(match => decodeXml(match[1].replace(/<[^>]+>/g, '').trim()))
    .filter(Boolean);
}

function getal(value: string | null): number | null {
  if (value == null) return null;
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

function geheelGetal(value: string | null): number | null {
  const parsed = getal(value);
  return parsed != null && Number.isInteger(parsed) ? parsed : null;
}

function booleanWaarde(value: string | null): boolean | null {
  if (value == null) return null;
  if (/^(true|1)$/i.test(value)) return true;
  if (/^(false|0)$/i.test(value)) return false;
  return null;
}

function objecttypeUit(xml: string): Objecttype | null {
  return OBJECTTYPEN.find(type => new RegExp(`<(?:(?:[A-Za-z_][\\w.-]*):)?${type}(?:\\s|>)`, 'i').test(xml)) ?? null;
}

function attribuutUit(xml: string, element: string, attribuut: string): string | null {
  const match = xml.match(
    new RegExp(`<(?:(?:[A-Za-z_][\\w.-]*):)?${escapeRegExp(element)}\\b[^>]*\\b${escapeRegExp(attribuut)}=["']([^"']+)["']`, 'i'),
  );
  return match?.[1] ?? null;
}

function geometrieUit(xml: string, objecttype: Objecttype): BagRdGeometrie {
  if (objecttype === 'Nummeraanduiding' || objecttype === 'OpenbareRuimte') {
    return { vorm: 'geen', crs: null, dimensie: null, coordinaten: [] };
  }

  const isPunt = objecttype === 'Verblijfsobject';
  const element = isPunt ? 'pos' : 'posList';
  const raw = tekstUit(xml, element);
  if (!raw) return { vorm: isPunt ? 'punt' : 'polygoon', crs: 'EPSG:28992', dimensie: null, coordinaten: [] };

  const coordinaten = raw
    .split(/\s+/)
    .map(value => Number(value.replace(',', '.')))
    .filter(value => Number.isFinite(value));
  const dimensionAttribute = attribuutUit(xml, element, 'srsDimension');
  const dimensie = dimensionAttribute === '2' || dimensionAttribute === '3'
    ? Number(dimensionAttribute) as 2 | 3
    : coordinaten.length % 3 === 0
      ? 3
      : 2;

  return {
    vorm: isPunt ? 'punt' : 'polygoon',
    crs: 'EPSG:28992',
    dimensie,
    coordinaten,
  };
}

function voorkomenUit(xml: string): BagVoorkomenMetadata {
  return {
    voorkomenidentificatie: geheelGetal(tekstUit(xml, 'voorkomenidentificatie')),
    beginGeldigheid: tekstUit(xml, 'beginGeldigheid'),
    eindGeldigheid: tekstUit(xml, 'eindGeldigheid'),
    tijdstipRegistratie: tekstUit(xml, 'tijdstipRegistratie'),
    eindRegistratie: tekstUit(xml, 'eindRegistratie'),
    tijdstipRegistratieLV: tekstUit(xml, 'tijdstipRegistratieLV'),
    tijdstipEindRegistratieLV: tekstUit(xml, 'tijdstipEindRegistratieLV'),
    tijdstipInactief: tekstUit(xml, 'tijdstipInactief'),
    tijdstipInactiefLV: tekstUit(xml, 'tijdstipInactiefLV'),
  };
}

function relatiesUit(xml: string, objecttype: Objecttype): Record<string, string[]> {
  if (objecttype === 'Verblijfsobject') {
    return {
      pandIds: tekstenUit(xml, 'PandRef'),
      hoofdadresIds: tekstenUit(xml, 'NummeraanduidingRef').slice(0, 1),
      nummeraanduidingIds: tekstenUit(xml, 'NummeraanduidingRef'),
    };
  }
  if (objecttype === 'Nummeraanduiding') {
    return { openbareRuimteIds: tekstenUit(xml, 'OpenbareRuimteRef') };
  }
  if (objecttype === 'OpenbareRuimte') {
    return { woonplaatsIds: tekstenUit(xml, 'WoonplaatsRef') };
  }
  if (objecttype === 'Standplaats' || objecttype === 'Ligplaats') {
    return { nummeraanduidingIds: tekstenUit(xml, 'NummeraanduidingRef') };
  }
  return {};
}

function veldenUit(xml: string, objecttype: Objecttype): Record<string, string | number | boolean | string[] | null> {
  const basis = {
    geconstateerd: booleanWaarde(tekstUit(xml, 'geconstateerd')),
    documentdatum: tekstUit(xml, 'documentdatum'),
    documentnummer: tekstUit(xml, 'documentnummer'),
  };
  if (objecttype === 'Pand') {
    return { ...basis, oorspronkelijkBouwjaar: geheelGetal(tekstUit(xml, 'oorspronkelijkBouwjaar')) };
  }
  if (objecttype === 'Verblijfsobject') {
    return {
      ...basis,
      gebruiksdoelen: tekstenUit(xml, 'gebruiksdoel'),
      oppervlakte: getal(tekstUit(xml, 'oppervlakte')),
    };
  }
  if (objecttype === 'Nummeraanduiding') {
    return {
      ...basis,
      huisnummer: geheelGetal(tekstUit(xml, 'huisnummer')),
      huisletter: tekstUit(xml, 'huisletter'),
      huisnummertoevoeging: tekstUit(xml, 'huisnummertoevoeging'),
      postcode: tekstUit(xml, 'postcode'),
      typeAdresseerbaarObject: tekstUit(xml, 'typeAdresseerbaarObject'),
    };
  }
  if (objecttype === 'OpenbareRuimte') {
    return { ...basis, naam: tekstUit(xml, 'naam'), type: tekstUit(xml, 'type') };
  }
  if (objecttype === 'Woonplaats') {
    return { ...basis, naam: tekstUit(xml, 'naam') };
  }
  return basis;
}

function naarParserRecord(record: BagOfficieelAdapterRecord): BagBronRecord | null {
  if (record.objecttype === 'Pand') {
    return {
      type: 'pand',
      identificatie: record.identificatie,
      bouwjaar: record.velden.oorspronkelijkBouwjaar as number | null,
      status: record.status,
      geometrieWkt: null,
    };
  }
  if (record.objecttype === 'Verblijfsobject') {
    return {
      type: 'verblijfsobject',
      identificatie: record.identificatie,
      pandIds: record.relaties.pandIds ?? [],
      nummeraanduidingIds: record.relaties.nummeraanduidingIds ?? [],
      gebruiksdoelen: record.velden.gebruiksdoelen as string[] | undefined,
      oppervlakte: record.velden.oppervlakte as number | null,
      status: record.status,
    };
  }
  if (record.objecttype === 'Nummeraanduiding') {
    return {
      type: 'nummeraanduiding',
      identificatie: record.identificatie,
      huisnummer: record.velden.huisnummer as number | null,
      huisletter: record.velden.huisletter as string | null,
      huisnummertoevoeging: record.velden.huisnummertoevoeging as string | null,
      postcode: record.velden.postcode as string | null,
      status: record.status,
    };
  }
  return null;
}

export function parseOfficieelBagRecord(xml: string): BagOfficieelAdapterResultaat {
  const fouten: BagOfficieelAdapterResultaat['fouten'] = [];
  const objecttype = objecttypeUit(xml);
  if (!objecttype) {
    return { record: null, parserRecord: null, fouten: [{ code: 'onbekend_objecttype', reden: 'Geen ondersteund BAG-objecttype gevonden.' }] };
  }

  const identificatie = tekstUit(xml, 'identificatie');
  if (!identificatie) {
    return { record: null, parserRecord: null, fouten: [{ code: 'ontbrekende_identificatie', reden: `${objecttype} bevat geen identificatie.` }] };
  }

  const geometrie = geometrieUit(xml, objecttype);
  if (geometrie.vorm !== 'geen' && geometrie.coordinaten.length > 0 && geometrie.dimensie && geometrie.coordinaten.length % geometrie.dimensie !== 0) {
    fouten.push({ code: 'ongeldige_geometrie', reden: 'Het aantal coördinaatwaarden past niet bij de aangegeven dimensie.' });
  }

  const record: BagOfficieelAdapterRecord = {
    objecttype,
    identificatie,
    status: tekstUit(xml, 'status'),
    voorkomen: voorkomenUit(xml),
    geometrie,
    relaties: relatiesUit(xml, objecttype),
    velden: veldenUit(xml, objecttype),
  };

  return { record, parserRecord: naarParserRecord(record), fouten };
}
