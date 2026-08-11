export const CBS_WIJK_BUURT_JAAR = 2025;
export const CBS_WIJK_BUURT_GEMEENTECODE_AMSTERDAM = 'GM0363';
export const CBS_WIJK_BUURT_PDOK_BASIS_URL =
  'https://api.pdok.nl/cbs/wijken-en-buurten-2025/ogc/v1';

export interface CbsBuurtFeatureProperties {
  jaar: number;
  gemeentecode: string;
  gemeentenaam: string;
  buurtcode: string;
  buurtnaam: string;
}

export interface CbsWijkFeatureProperties {
  jaar: number;
  gemeentecode: string;
  gemeentenaam: string;
  wijkcode: string;
  wijknaam: string;
}

export interface CbsBuurtIdentiteit {
  bronjaar: number;
  gemeenteCode: string;
  gemeenteNaam: string;
  wijkCode: string;
  buurtCode: string;
  buurtNaam: string;
}

export interface CbsWijkIdentiteit {
  bronjaar: number;
  gemeenteCode: string;
  gemeenteNaam: string;
  wijkCode: string;
  wijkNaam: string;
}

const GEMEENTECODE = /^GM\d{4}$/;
const WIJKCODE = /^WK\d{6}$/;
const BUURTCODE = /^BU\d{8}$/;

function valideerGemeente(
  jaar: number,
  gemeentecode: string,
  gemeentenaam: string,
  verwachteGemeentecode: string,
): string {
  if (jaar !== CBS_WIJK_BUURT_JAAR) {
    throw new TypeError(`Onverwacht CBS-bronjaar: ${jaar}.`);
  }
  if (!GEMEENTECODE.test(gemeentecode)) {
    throw new TypeError('Ongeldige CBS-gemeentecode.');
  }
  if (gemeentecode !== verwachteGemeentecode) {
    throw new TypeError('CBS-gebied valt buiten de toegestane gemeente.');
  }
  const gemeenteNaam = gemeentenaam?.trim();
  if (!gemeenteNaam) throw new TypeError('CBS-gebied mist gemeentenaam.');
  return gemeenteNaam;
}

export function wijkcodeUitBuurtcode(buurtcode: string): string {
  if (!BUURTCODE.test(buurtcode)) {
    throw new TypeError('Ongeldige CBS-buurtcode.');
  }
  return `WK${buurtcode.slice(2, 8)}`;
}

export function valideerCbsBuurtFeature(
  properties: CbsBuurtFeatureProperties,
  verwachteGemeentecode = CBS_WIJK_BUURT_GEMEENTECODE_AMSTERDAM,
): CbsBuurtIdentiteit {
  const gemeenteNaam = valideerGemeente(
    properties.jaar,
    properties.gemeentecode,
    properties.gemeentenaam,
    verwachteGemeentecode,
  );
  if (!BUURTCODE.test(properties.buurtcode)) {
    throw new TypeError('Ongeldige CBS-buurtcode.');
  }
  if (properties.buurtcode.slice(2, 6) !== properties.gemeentecode.slice(2)) {
    throw new TypeError('CBS-buurtcode en gemeentecode zijn inconsistent.');
  }
  const buurtNaam = properties.buurtnaam?.trim();
  if (!buurtNaam) throw new TypeError('CBS-buurt mist buurtnaam.');

  return {
    bronjaar: properties.jaar,
    gemeenteCode: properties.gemeentecode,
    gemeenteNaam,
    wijkCode: wijkcodeUitBuurtcode(properties.buurtcode),
    buurtCode: properties.buurtcode,
    buurtNaam,
  };
}

export function valideerCbsWijkFeature(
  properties: CbsWijkFeatureProperties,
  verwachteGemeentecode = CBS_WIJK_BUURT_GEMEENTECODE_AMSTERDAM,
): CbsWijkIdentiteit {
  const gemeenteNaam = valideerGemeente(
    properties.jaar,
    properties.gemeentecode,
    properties.gemeentenaam,
    verwachteGemeentecode,
  );
  if (!WIJKCODE.test(properties.wijkcode)) {
    throw new TypeError('Ongeldige CBS-wijkcode.');
  }
  if (properties.wijkcode.slice(2, 6) !== properties.gemeentecode.slice(2)) {
    throw new TypeError('CBS-wijkcode en gemeentecode zijn inconsistent.');
  }
  const wijkNaam = properties.wijknaam?.trim();
  if (!wijkNaam) throw new TypeError('CBS-wijk mist wijknaam.');
  return {
    bronjaar: properties.jaar,
    gemeenteCode: properties.gemeentecode,
    gemeenteNaam,
    wijkCode: properties.wijkcode,
    wijkNaam,
  };
}

function bouwItemsUrl(
  collectie: 'buurten' | 'wijken',
  params: { bbox: [number, number, number, number]; limit?: number },
): string {
  const [minX, minY, maxX, maxY] = params.bbox;
  if (![minX, minY, maxX, maxY].every(Number.isFinite) || minX >= maxX || minY >= maxY) {
    throw new TypeError('Ongeldige CBS-bbox.');
  }
  const limit = params.limit ?? 1000;
  if (!Number.isInteger(limit) || limit < 1 || limit > 10_000) {
    throw new TypeError('Ongeldige CBS-paginagrootte.');
  }
  const query = new URLSearchParams({
    f: 'json',
    bbox: [minX, minY, maxX, maxY].join(','),
    limit: String(limit),
  });
  return `${CBS_WIJK_BUURT_PDOK_BASIS_URL}/collections/${collectie}/items?${query.toString()}`;
}

export function bouwCbsBuurtenItemsUrl(params: {
  bbox: [number, number, number, number];
  limit?: number;
}): string {
  return bouwItemsUrl('buurten', params);
}

export function bouwCbsWijkenItemsUrl(params: {
  bbox: [number, number, number, number];
  limit?: number;
}): string {
  return bouwItemsUrl('wijken', params);
}
