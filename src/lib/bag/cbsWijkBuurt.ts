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

export interface CbsBuurtIdentiteit {
  bronjaar: number;
  gemeenteCode: string;
  gemeenteNaam: string;
  wijkCode: string;
  buurtCode: string;
  buurtNaam: string;
}

const GEMEENTECODE = /^GM\d{4}$/;
const BUURTCODE = /^BU\d{8}$/;

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
  if (properties.jaar !== CBS_WIJK_BUURT_JAAR) {
    throw new TypeError(`Onverwacht CBS-bronjaar: ${properties.jaar}.`);
  }
  if (!GEMEENTECODE.test(properties.gemeentecode)) {
    throw new TypeError('Ongeldige CBS-gemeentecode.');
  }
  if (properties.gemeentecode !== verwachteGemeentecode) {
    throw new TypeError('CBS-buurt valt buiten de toegestane gemeente.');
  }
  if (!BUURTCODE.test(properties.buurtcode)) {
    throw new TypeError('Ongeldige CBS-buurtcode.');
  }
  if (properties.buurtcode.slice(2, 6) !== properties.gemeentecode.slice(2)) {
    throw new TypeError('CBS-buurtcode en gemeentecode zijn inconsistent.');
  }
  const gemeenteNaam = properties.gemeentenaam?.trim();
  const buurtNaam = properties.buurtnaam?.trim();
  if (!gemeenteNaam || !buurtNaam) {
    throw new TypeError('CBS-buurt mist gemeente- of buurtnaam.');
  }

  return {
    bronjaar: properties.jaar,
    gemeenteCode: properties.gemeentecode,
    gemeenteNaam,
    wijkCode: wijkcodeUitBuurtcode(properties.buurtcode),
    buurtCode: properties.buurtcode,
    buurtNaam,
  };
}

export function bouwCbsBuurtenItemsUrl(params: {
  bbox: [number, number, number, number];
  limit?: number;
}): string {
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
  return `${CBS_WIJK_BUURT_PDOK_BASIS_URL}/collections/buurten/items?${query.toString()}`;
}
