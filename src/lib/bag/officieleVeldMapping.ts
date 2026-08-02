export type BagOfficieelObjecttype =
  | 'Pand'
  | 'Verblijfsobject'
  | 'Nummeraanduiding'
  | 'OpenbareRuimte'
  | 'Woonplaats'
  | 'Standplaats'
  | 'Ligplaats';

export type BagGeometrievorm = 'polygoon' | 'punt' | 'geen';

export interface BagVoorkomenMapping {
  voorkomenidentificatie: 'voorkomen/Voorkomen/voorkomenidentificatie';
  beginGeldigheid: 'voorkomen/Voorkomen/beginGeldigheid';
  eindGeldigheid: 'voorkomen/Voorkomen/eindGeldigheid';
  tijdstipRegistratie: 'voorkomen/Voorkomen/tijdstipRegistratie';
  eindRegistratie: 'voorkomen/Voorkomen/eindRegistratie';
  tijdstipRegistratieLV: 'voorkomen/Voorkomen/tijdstipRegistratieLV';
  tijdstipEindRegistratieLV: 'voorkomen/Voorkomen/tijdstipEindRegistratieLV';
  tijdstipInactief: 'voorkomen/Voorkomen/tijdstipInactief';
  tijdstipInactiefLV: 'voorkomen/Voorkomen/tijdstipInactiefLV';
}

export const BAG_VOORKOMEN_MAPPING: BagVoorkomenMapping = {
  voorkomenidentificatie: 'voorkomen/Voorkomen/voorkomenidentificatie',
  beginGeldigheid: 'voorkomen/Voorkomen/beginGeldigheid',
  eindGeldigheid: 'voorkomen/Voorkomen/eindGeldigheid',
  tijdstipRegistratie: 'voorkomen/Voorkomen/tijdstipRegistratie',
  eindRegistratie: 'voorkomen/Voorkomen/eindRegistratie',
  tijdstipRegistratieLV: 'voorkomen/Voorkomen/tijdstipRegistratieLV',
  tijdstipEindRegistratieLV: 'voorkomen/Voorkomen/tijdstipEindRegistratieLV',
  tijdstipInactief: 'voorkomen/Voorkomen/tijdstipInactief',
  tijdstipInactiefLV: 'voorkomen/Voorkomen/tijdstipInactiefLV',
};

export interface BagObjectVeldMapping {
  objecttype: BagOfficieelObjecttype;
  objectPad: string;
  identificatiePad: string;
  statusPad: string;
  geometrie: {
    vorm: BagGeometrievorm;
    pad: string | null;
    gmlElement: 'posList' | 'pos' | null;
    bronCrs: 'EPSG:28992' | null;
    dimensies: readonly [2, 3] | readonly [3] | readonly [2] | null;
  };
  relaties: Readonly<Record<string, string>>;
  velden: Readonly<Record<string, string>>;
}

export const BAG_OFFICIELE_VELDMAPPINGS: readonly BagObjectVeldMapping[] = [
  {
    objecttype: 'Pand',
    objectPad: 'object/Pand',
    identificatiePad: 'object/Pand/identificatie',
    statusPad: 'object/Pand/status',
    geometrie: {
      vorm: 'polygoon',
      pad: 'object/Pand/geometrie/Polygon/exterior/LinearRing/posList',
      gmlElement: 'posList',
      bronCrs: 'EPSG:28992',
      dimensies: [3],
    },
    relaties: {},
    velden: {
      oorspronkelijkBouwjaar: 'object/Pand/oorspronkelijkBouwjaar',
      geconstateerd: 'object/Pand/geconstateerd',
      documentdatum: 'object/Pand/documentdatum',
      documentnummer: 'object/Pand/documentnummer',
    },
  },
  {
    objecttype: 'Verblijfsobject',
    objectPad: 'object/Verblijfsobject',
    identificatiePad: 'object/Verblijfsobject/identificatie',
    statusPad: 'object/Verblijfsobject/status',
    geometrie: {
      vorm: 'punt',
      pad: 'object/Verblijfsobject/geometrie/Point/pos',
      gmlElement: 'pos',
      bronCrs: 'EPSG:28992',
      dimensies: [3],
    },
    relaties: {
      hoofdadres: 'heeftAlsHoofdadres/NummeraanduidingRef',
      nevenadres: 'heeftAlsNevenadres/NummeraanduidingRef',
      maaktDeelUitVan: 'object/Verblijfsobject/maaktDeelUitVan/PandRef',
    },
    velden: {
      gebruiksdoel: 'object/Verblijfsobject/gebruiksdoel',
      oppervlakte: 'object/Verblijfsobject/oppervlakte',
      geconstateerd: 'object/Verblijfsobject/geconstateerd',
      documentdatum: 'object/Verblijfsobject/documentdatum',
      documentnummer: 'object/Verblijfsobject/documentnummer',
    },
  },
  {
    objecttype: 'Nummeraanduiding',
    objectPad: 'object/Nummeraanduiding',
    identificatiePad: 'object/Nummeraanduiding/identificatie',
    statusPad: 'object/Nummeraanduiding/status',
    geometrie: { vorm: 'geen', pad: null, gmlElement: null, bronCrs: null, dimensies: null },
    relaties: {
      ligtAan: 'object/Nummeraanduiding/ligtAan/OpenbareRuimteRef',
    },
    velden: {
      huisnummer: 'object/Nummeraanduiding/huisnummer',
      huisletter: 'object/Nummeraanduiding/huisletter',
      huisnummertoevoeging: 'object/Nummeraanduiding/huisnummertoevoeging',
      postcode: 'object/Nummeraanduiding/postcode',
      typeAdresseerbaarObject: 'object/Nummeraanduiding/typeAdresseerbaarObject',
      geconstateerd: 'object/Nummeraanduiding/geconstateerd',
      documentdatum: 'object/Nummeraanduiding/documentdatum',
      documentnummer: 'object/Nummeraanduiding/documentnummer',
    },
  },
  {
    objecttype: 'OpenbareRuimte',
    objectPad: 'object/OpenbareRuimte',
    identificatiePad: 'object/OpenbareRuimte/identificatie',
    statusPad: 'object/OpenbareRuimte/status',
    geometrie: { vorm: 'geen', pad: null, gmlElement: null, bronCrs: null, dimensies: null },
    relaties: {
      ligtIn: 'object/OpenbareRuimte/ligtIn/WoonplaatsRef',
    },
    velden: {
      naam: 'object/OpenbareRuimte/naam',
      type: 'object/OpenbareRuimte/type',
      geconstateerd: 'object/OpenbareRuimte/geconstateerd',
      documentdatum: 'object/OpenbareRuimte/documentdatum',
      documentnummer: 'object/OpenbareRuimte/documentnummer',
    },
  },
  {
    objecttype: 'Woonplaats',
    objectPad: 'object/Woonplaats',
    identificatiePad: 'object/Woonplaats/identificatie',
    statusPad: 'object/Woonplaats/status',
    geometrie: {
      vorm: 'polygoon',
      pad: 'object/Woonplaats/geometrie/MultiSurface/surfaceMember/Polygon/exterior/LinearRing/posList',
      gmlElement: 'posList',
      bronCrs: 'EPSG:28992',
      dimensies: [2, 3],
    },
    relaties: {},
    velden: {
      naam: 'object/Woonplaats/naam',
      geconstateerd: 'object/Woonplaats/geconstateerd',
      documentdatum: 'object/Woonplaats/documentdatum',
      documentnummer: 'object/Woonplaats/documentnummer',
    },
  },
  {
    objecttype: 'Standplaats',
    objectPad: 'object/Standplaats',
    identificatiePad: 'object/Standplaats/identificatie',
    statusPad: 'object/Standplaats/status',
    geometrie: {
      vorm: 'polygoon',
      pad: 'object/Standplaats/geometrie/Polygon/exterior/LinearRing/posList',
      gmlElement: 'posList',
      bronCrs: 'EPSG:28992',
      dimensies: [2],
    },
    relaties: {
      hoofdadres: 'heeftAlsHoofdadres/NummeraanduidingRef',
      nevenadres: 'heeftAlsNevenadres/NummeraanduidingRef',
    },
    velden: {
      geconstateerd: 'object/Standplaats/geconstateerd',
      documentdatum: 'object/Standplaats/documentdatum',
      documentnummer: 'object/Standplaats/documentnummer',
    },
  },
  {
    objecttype: 'Ligplaats',
    objectPad: 'object/Ligplaats',
    identificatiePad: 'object/Ligplaats/identificatie',
    statusPad: 'object/Ligplaats/status',
    geometrie: {
      vorm: 'polygoon',
      pad: 'object/Ligplaats/geometrie/Polygon/exterior/LinearRing/posList',
      gmlElement: 'posList',
      bronCrs: 'EPSG:28992',
      dimensies: [2],
    },
    relaties: {
      hoofdadres: 'heeftAlsHoofdadres/NummeraanduidingRef',
      nevenadres: 'heeftAlsNevenadres/NummeraanduidingRef',
    },
    velden: {
      geconstateerd: 'object/Ligplaats/geconstateerd',
      documentdatum: 'object/Ligplaats/documentdatum',
      documentnummer: 'object/Ligplaats/documentnummer',
    },
  },
] as const;

export const BAG_EXTRACT_NAMESPACES = {
  extract: 'http://www.kadaster.nl/schemas/lvbag/extract-deelbestand-lvc/v20200601',
  objecten: 'www.kadaster.nl/schemas/lvbag/imbag/objecten/v20200601',
  typen: 'www.kadaster.nl/schemas/lvbag/imbag/typen/v20200601',
  gml: 'http://www.opengis.net/gml/3.2',
} as const;

export function veldMappingVoor(objecttype: BagOfficieelObjecttype): BagObjectVeldMapping {
  const mapping = BAG_OFFICIELE_VELDMAPPINGS.find(item => item.objecttype === objecttype);
  if (!mapping) throw new Error(`Geen officiële BAG-veldmapping voor ${objecttype}.`);
  return mapping;
}

export function isInactiefVoorkomen(voorkomen: {
  tijdstipInactief?: string | null;
  tijdstipInactiefLV?: string | null;
}): boolean {
  return Boolean(voorkomen.tijdstipInactief || voorkomen.tijdstipInactiefLV);
}

export function valideerRdCoordinaatwaarden(
  waarden: readonly number[],
  dimensie: 2 | 3,
): { geldig: boolean; punten: number } {
  if (waarden.length === 0 || waarden.some(value => !Number.isFinite(value))) {
    return { geldig: false, punten: 0 };
  }
  if (waarden.length % dimensie !== 0) {
    return { geldig: false, punten: 0 };
  }
  return { geldig: true, punten: waarden.length / dimensie };
}
