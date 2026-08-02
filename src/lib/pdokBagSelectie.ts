export interface BagSelectieCriteria {
  gemeente: string;
  bouwjaarVan?: number | null;
  bouwjaarTot?: number | null;
  gebruiksdoelen: string[];
  limiet: number;
}

export interface BagKandidaat {
  bagPandId: string;
  bagVerblijfsobjectId: string | null;
  adres: string;
  postcode: string | null;
  plaats: string | null;
  bouwjaar: number | null;
  gebruiksdoel: string | null;
  oppervlakte: number | null;
  status: string | null;
  longitude: number | null;
  latitude: number | null;
}

type Bbox = [number, number, number, number];

const LOCATIESERVER_URL = 'https://api.pdok.nl/bzk/locatieserver/search/v3_1/free';
const BAG_PANDEN_URL = 'https://api.pdok.nl/kadaster/bag/ogc/v2/collections/pand/items';

function getal(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function tekst(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function verzamelCoordinaten(value: unknown, out: [number, number][]) {
  if (!Array.isArray(value)) return;
  if (value.length >= 2 && typeof value[0] === 'number' && typeof value[1] === 'number') {
    out.push([value[0], value[1]]);
    return;
  }
  value.forEach((child) => verzamelCoordinaten(child, out));
}

function bboxUitPunten(coordinates: [number, number][]): Bbox | null {
  if (!coordinates.length) return null;
  const xs = coordinates.map(([x]) => x);
  const ys = coordinates.map(([, y]) => y);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

function coordinatenUitWkt(raw: string): [number, number][] {
  const body = raw.replace(/^\s*SRID=\d+;\s*/i, '').trim();
  const pairs: [number, number][] = [];
  const coordinatePattern = /(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s+(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g;
  let match: RegExpExecArray | null;
  while ((match = coordinatePattern.exec(body)) !== null) {
    const x = Number(match[1]);
    const y = Number(match[2]);
    if (Number.isFinite(x) && Number.isFinite(y)) pairs.push([x, y]);
  }
  return pairs;
}

export function bboxUitGeometrie(raw: unknown): Bbox | null {
  if (!raw) return null;

  if (typeof raw === 'string') {
    const value = raw.trim();
    if (!value) return null;

    try {
      const parsed = JSON.parse(value);
      const coordinates: [number, number][] = [];
      verzamelCoordinaten(parsed?.coordinates ?? parsed?.geometry?.coordinates, coordinates);
      const geoJsonBbox = bboxUitPunten(coordinates);
      if (geoJsonBbox) return geoJsonBbox;
    } catch {
      // Locatieserver levert geometrieën doorgaans als WKT, niet als JSON.
    }

    return bboxUitPunten(coordinatenUitWkt(value));
  }

  const geometry: any = raw;
  if (Array.isArray(geometry?.bbox) && geometry.bbox.length >= 4) {
    const bbox = geometry.bbox.slice(0, 4).map(Number);
    if (bbox.every(Number.isFinite)) return bbox as Bbox;
  }
  const coordinates: [number, number][] = [];
  verzamelCoordinaten(geometry?.coordinates ?? geometry?.geometry?.coordinates, coordinates);
  return bboxUitPunten(coordinates);
}

function vergrootPuntTotZoekgebied(bbox: Bbox): Bbox {
  const [minX, minY, maxX, maxY] = bbox;
  if (minX !== maxX || minY !== maxY) return bbox;
  const marge = 0.08;
  return [minX - marge, minY - marge, maxX + marge, maxY + marge];
}

async function fetchJson(url: string): Promise<any> {
  const response = await fetch(url, { headers: { Accept: 'application/geo+json, application/json' } });
  if (!response.ok) throw new Error(`PDOK gaf fout ${response.status}. Probeer het later opnieuw.`);
  return response.json();
}

export async function zoekGemeenteBbox(gemeente: string): Promise<Bbox> {
  const opgeschoond = gemeente.trim();
  const params = new URLSearchParams({ q: opgeschoond, fq: 'type:gemeente', rows: '10' });
  const data = await fetchJson(`${LOCATIESERVER_URL}?${params}`);
  const docs = data?.response?.docs ?? [];
  const exact = docs.find((doc: any) => {
    const namen = [doc.gemeentenaam, doc.weergavenaam, doc.naam].filter(Boolean).map((value) => String(value).toLowerCase());
    return namen.some((naam) => naam === opgeschoond.toLowerCase() || naam.startsWith(`${opgeschoond.toLowerCase()} `));
  }) ?? docs[0];
  if (!exact) throw new Error(`Gemeente “${gemeente}” is niet gevonden.`);

  const bronnen = [exact.geometrie_ll, exact.geometry, exact.geometrie_rd, exact.centroide_ll, exact.centroide_rd];
  for (const bron of bronnen) {
    const bbox = bboxUitGeometrie(bron);
    if (bbox) return vergrootPuntTotZoekgebied(bbox);
  }

  throw new Error(`Voor gemeente “${gemeente}” kon geen zoekgebied worden bepaald.`);
}

function eersteVboHref(feature: any): string | null {
  const properties = feature?.properties ?? {};
  const candidates = [properties['verblijfsobject.href'], properties.verblijfsobject_href, properties.verblijfsobject];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.startsWith('http')) return candidate;
    if (Array.isArray(candidate)) {
      const value = candidate.find((item) => typeof item === 'string' || item?.href);
      if (typeof value === 'string') return value;
      if (value?.href) return value.href;
    }
    if (candidate?.href) return candidate.href;
  }
  const link = (feature?.links ?? []).find((item: any) => String(item.rel ?? '').includes('verblijfsobject'));
  return link?.href ?? null;
}

function puntUitGeometry(geometry: any): [number | null, number | null] {
  const coordinates: [number, number][] = [];
  verzamelCoordinaten(geometry?.coordinates, coordinates);
  if (!coordinates.length) return [null, null];
  const x = coordinates.reduce((sum, point) => sum + point[0], 0) / coordinates.length;
  const y = coordinates.reduce((sum, point) => sum + point[1], 0) / coordinates.length;
  return [x, y];
}

function normaliseerGebruiksdoel(value: unknown): string | null {
  if (Array.isArray(value)) return value.map(String).join(', ');
  return tekst(value);
}

function pastGebruiksdoel(doel: string | null, filters: string[]): boolean {
  if (!filters.length) return true;
  if (!doel) return false;
  const lower = doel.toLowerCase();
  return filters.some((filter) => lower.includes(filter.toLowerCase()));
}

async function verrijkMetAdres(feature: any): Promise<BagKandidaat | null> {
  const p = feature?.properties ?? {};
  const href = eersteVboHref(feature);
  if (!href) return null;
  let vbo: any;
  try { vbo = await fetchJson(`${href}${href.includes('?') ? '&' : '?'}f=json`); } catch { return null; }
  const vp = vbo?.properties ?? vbo?.feature?.properties ?? {};
  const straat = tekst(vp.openbare_ruimte_naam ?? vp.openbareruimte_naam ?? vp.straatnaam ?? vp.openbareRuimteNaam);
  const huisnummer = getal(vp.huisnummer);
  const huisletter = tekst(vp.huisletter) ?? '';
  const toevoeging = tekst(vp.huisnummertoevoeging) ?? '';
  const postcode = tekst(vp.postcode);
  const plaats = tekst(vp.woonplaats_naam ?? vp.woonplaatsnaam ?? vp.woonplaats);
  if (!straat || huisnummer == null) return null;
  const [longitude, latitude] = puntUitGeometry(vbo?.geometry ?? feature?.geometry);
  return {
    bagPandId: String(p.identificatie ?? feature?.id ?? ''),
    bagVerblijfsobjectId: tekst(vp.identificatie ?? vbo?.id),
    adres: `${straat} ${huisnummer}${huisletter}${toevoeging ? `-${toevoeging}` : ''}`,
    postcode,
    plaats,
    bouwjaar: getal(p.bouwjaar),
    gebruiksdoel: normaliseerGebruiksdoel(p.gebruiksdoel ?? vp.gebruiksdoel),
    oppervlakte: getal(vp.oppervlakte),
    status: tekst(p.status),
    longitude,
    latitude,
  };
}

async function mapBegrensd<T, R>(items: T[], concurrency: number, mapper: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const current = index++;
      results[current] = await mapper(items[current]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

export async function zoekBagKandidaten(criteria: BagSelectieCriteria): Promise<BagKandidaat[]> {
  const bbox = await zoekGemeenteBbox(criteria.gemeente);
  const params = new URLSearchParams({ bbox: bbox.join(','), limit: String(Math.min(Math.max(criteria.limiet * 5, 50), 500)), f: 'json' });
  const data = await fetchJson(`${BAG_PANDEN_URL}?${params}`);
  const features = (data?.features ?? []).filter((feature: any) => {
    const p = feature?.properties ?? {};
    const bouwjaar = getal(p.bouwjaar);
    const status = String(p.status ?? '').toLowerCase();
    const gebruiksdoel = normaliseerGebruiksdoel(p.gebruiksdoel);
    if (status.includes('gesloopt') || status.includes('niet gerealiseerd')) return false;
    if (criteria.bouwjaarVan != null && bouwjaar != null && bouwjaar < criteria.bouwjaarVan) return false;
    if (criteria.bouwjaarTot != null && bouwjaar != null && bouwjaar > criteria.bouwjaarTot) return false;
    return pastGebruiksdoel(gebruiksdoel, criteria.gebruiksdoelen);
  }).slice(0, Math.min(criteria.limiet * 2, 80));

  const enriched = await mapBegrensd(features, 6, verrijkMetAdres);
  const unique = new Map<string, BagKandidaat>();
  enriched.filter((item): item is BagKandidaat => Boolean(item)).forEach((item) => {
    const key = item.bagPandId || `${item.adres}|${item.postcode}`;
    if (!unique.has(key)) unique.set(key, item);
  });
  return [...unique.values()].slice(0, criteria.limiet);
}
