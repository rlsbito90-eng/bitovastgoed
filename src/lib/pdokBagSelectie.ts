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

export interface BagSelectieStatistiek {
  onderzocht: number;
  technischAfgevallen: number;
  buitenGemeente: number;
  criteriaAfgevallen: number;
  kandidaten: number;
  paginas: number;
}

export interface BagSelectieResultaat {
  kandidaten: BagKandidaat[];
  statistiek: BagSelectieStatistiek;
}

type Punt = [number, number];
type Ring = Punt[];
type Bbox = [number, number, number, number];
interface GemeenteGebied { bbox: Bbox; ringen: Ring[]; naam: string; }

const LOCATIESERVER_URL = 'https://api.pdok.nl/bzk/locatieserver/search/v3_1/free';
const BAG_PANDEN_URL = 'https://api.pdok.nl/kadaster/bag/ogc/v2/collections/pand/items';
const MAX_PAGINAS = 12;
const PAGINA_LIMIET = 100;
const adresGemeenteCache = new Map<string, string | null>();

export function normaliseerGemeentenaam(value: unknown): string {
  return String(value ?? '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
}

export function zelfdeGemeente(a: unknown, b: unknown): boolean {
  const left = normaliseerGemeentenaam(a);
  const right = normaliseerGemeentenaam(b);
  return Boolean(left && right && left === right);
}

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

function verzamelCoordinaten(value: unknown, out: Punt[]) {
  if (!Array.isArray(value)) return;
  if (value.length >= 2 && typeof value[0] === 'number' && typeof value[1] === 'number') {
    out.push([value[0], value[1]]);
    return;
  }
  value.forEach((child) => verzamelCoordinaten(child, out));
}

function bboxUitPunten(coordinates: Punt[]): Bbox | null {
  if (!coordinates.length) return null;
  const xs = coordinates.map(([x]) => x);
  const ys = coordinates.map(([, y]) => y);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

function coordinatenUitTekst(raw: string): Punt[] {
  const pairs: Punt[] = [];
  const patroon = /(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s+(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g;
  let match: RegExpExecArray | null;
  while ((match = patroon.exec(raw)) !== null) {
    const x = Number(match[1]);
    const y = Number(match[2]);
    if (Number.isFinite(x) && Number.isFinite(y)) pairs.push([x, y]);
  }
  return pairs;
}

function ringenUitWkt(raw: string): Ring[] {
  const value = raw.replace(/^\s*SRID=\d+;\s*/i, '').trim();
  const ringen: Ring[] = [];
  const ringPatroon = /\(([^()]+)\)/g;
  let match: RegExpExecArray | null;
  while ((match = ringPatroon.exec(value)) !== null) {
    const ring = coordinatenUitTekst(match[1]);
    if (ring.length >= 3) ringen.push(ring);
  }
  if (!ringen.length) {
    const ring = coordinatenUitTekst(value);
    if (ring.length >= 3) ringen.push(ring);
  }
  return ringen;
}

function ringenUitGeoJson(raw: any): Ring[] {
  const geometry = raw?.geometry ?? raw;
  const coordinates = geometry?.coordinates;
  if (!Array.isArray(coordinates)) return [];
  const ringen: Ring[] = [];
  const bezoek = (node: unknown) => {
    if (!Array.isArray(node)) return;
    if (node.length >= 3 && Array.isArray(node[0]) && typeof node[0][0] === 'number' && typeof node[0][1] === 'number') {
      const ring = node
        .filter((p): p is number[] => Array.isArray(p) && typeof p[0] === 'number' && typeof p[1] === 'number')
        .map((p) => [p[0], p[1]] as Punt);
      if (ring.length >= 3) ringen.push(ring);
      return;
    }
    node.forEach(bezoek);
  };
  bezoek(coordinates);
  return ringen;
}

function ringenUitGeometrie(raw: unknown): Ring[] {
  if (!raw) return [];
  if (typeof raw === 'string') {
    const value = raw.trim();
    if (!value) return [];
    try { return ringenUitGeoJson(JSON.parse(value)); } catch { return ringenUitWkt(value); }
  }
  return ringenUitGeoJson(raw);
}

export function bboxUitGeometrie(raw: unknown): Bbox | null {
  if (!raw) return null;
  if (typeof raw === 'object' && Array.isArray((raw as any)?.bbox) && (raw as any).bbox.length >= 4) {
    const bbox = (raw as any).bbox.slice(0, 4).map(Number);
    if (bbox.every(Number.isFinite)) return bbox as Bbox;
  }
  const punten = ringenUitGeometrie(raw).flat();
  if (punten.length) return bboxUitPunten(punten);
  if (typeof raw === 'string') return bboxUitPunten(coordinatenUitTekst(raw));
  const coordinates: Punt[] = [];
  verzamelCoordinaten((raw as any)?.coordinates ?? (raw as any)?.geometry?.coordinates, coordinates);
  return bboxUitPunten(coordinates);
}

function vergrootPuntTotZoekgebied(bbox: Bbox): Bbox {
  const [minX, minY, maxX, maxY] = bbox;
  if (minX !== maxX || minY !== maxY) return bbox;
  const marge = 0.08;
  return [minX - marge, minY - marge, maxX + marge, maxY + marge];
}

function puntInRing([x, y]: Punt, ring: Ring): boolean {
  let binnen = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const kruist = (yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / ((yj - yi) || Number.EPSILON) + xi;
    if (kruist) binnen = !binnen;
  }
  return binnen;
}

export function puntInGemeente(punt: Punt, ringen: Ring[]): boolean {
  if (!ringen.length) return true;
  // Even-odd-regel over alle buitenringen en eventuele gaten.
  return ringen.reduce((binnen, ring) => puntInRing(punt, ring) ? !binnen : binnen, false);
}

async function fetchJson(url: string): Promise<any> {
  const response = await fetch(url, { headers: { Accept: 'application/geo+json, application/json' } });
  if (!response.ok) throw new Error(`PDOK gaf fout ${response.status}. Probeer het later opnieuw.`);
  return response.json();
}

async function zoekGemeenteGebied(gemeente: string): Promise<GemeenteGebied> {
  const opgeschoond = gemeente.trim();
  const params = new URLSearchParams({ q: opgeschoond, fq: 'type:gemeente', rows: '10' });
  const data = await fetchJson(`${LOCATIESERVER_URL}?${params}`);
  const docs = data?.response?.docs ?? [];
  const exact = docs.find((doc: any) => {
    const namen = [doc.gemeentenaam, doc.weergavenaam, doc.naam].filter(Boolean).map((value) => String(value).toLowerCase());
    return namen.some((naam) => naam === opgeschoond.toLowerCase() || naam.startsWith(`${opgeschoond.toLowerCase()} `));
  }) ?? docs[0];
  if (!exact) throw new Error(`Gemeente “${gemeente}” is niet gevonden.`);

  // Alleen geometrie_ll is geschikt voor de WGS84-coördinaten van de BAG OGC API.
  const contourBron = exact.geometrie_ll ?? exact.geometry;
  const ringen = ringenUitGeometrie(contourBron);
  const bbox = bboxUitGeometrie(contourBron)
    ?? bboxUitGeometrie(exact.centroide_ll)
    ?? bboxUitGeometrie(exact.geometrie_rd)
    ?? bboxUitGeometrie(exact.centroide_rd);
  if (!bbox) throw new Error(`Voor gemeente “${gemeente}” kon geen zoekgebied worden bepaald.`);
  return {
    bbox: vergrootPuntTotZoekgebied(bbox),
    ringen,
    naam: String(exact.gemeentenaam ?? exact.weergavenaam ?? opgeschoond),
  };
}

export async function zoekGemeenteBbox(gemeente: string): Promise<Bbox> {
  return (await zoekGemeenteGebied(gemeente)).bbox;
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
  const coordinates: Punt[] = [];
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

function voldoetVoorVerrijking(feature: any, criteria: BagSelectieCriteria): boolean {
  const p = feature?.properties ?? {};
  const bouwjaar = getal(p.bouwjaar);
  const status = String(p.status ?? '').toLowerCase();
  const gebruiksdoel = normaliseerGebruiksdoel(p.gebruiksdoel);
  if (status.includes('gesloopt') || status.includes('niet gerealiseerd')) return false;
  if (criteria.bouwjaarVan != null && bouwjaar != null && bouwjaar < criteria.bouwjaarVan) return false;
  if (criteria.bouwjaarTot != null && bouwjaar != null && bouwjaar > criteria.bouwjaarTot) return false;
  // Bij panden ontbreekt gebruiksdoel soms; dan pas na VBO-verrijking beoordelen.
  return gebruiksdoel ? pastGebruiksdoel(gebruiksdoel, criteria.gebruiksdoelen) : true;
}

async function zoekGemeenteVoorAdres(item: BagKandidaat): Promise<string | null> {
  const sleutel = `${item.postcode ?? ''}|${item.adres}`.toLowerCase();
  if (adresGemeenteCache.has(sleutel)) return adresGemeenteCache.get(sleutel) ?? null;

  const params = new URLSearchParams({
    q: [item.adres, item.postcode, item.plaats].filter(Boolean).join(' '),
    fq: 'type:adres',
    rows: '5',
  });
  try {
    const data = await fetchJson(`${LOCATIESERVER_URL}?${params}`);
    const docs = data?.response?.docs ?? [];
    const postcode = normaliseerGemeentenaam(item.postcode);
    const exact = docs.find((doc: any) => normaliseerGemeentenaam(doc.postcode) === postcode) ?? docs[0];
    const gemeente = tekst(exact?.gemeentenaam ?? exact?.gemeente_naam);
    adresGemeenteCache.set(sleutel, gemeente);
    return gemeente;
  } catch {
    adresGemeenteCache.set(sleutel, null);
    return null;
  }
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

function volgendePagina(data: any): string | null {
  const link = (data?.links ?? []).find((item: any) => String(item.rel ?? '').toLowerCase() === 'next');
  return typeof link?.href === 'string' ? link.href : null;
}

export async function zoekBagKandidatenMetStatistiek(criteria: BagSelectieCriteria): Promise<BagSelectieResultaat> {
  const gebied = await zoekGemeenteGebied(criteria.gemeente);
  const eersteParams = new URLSearchParams({ bbox: gebied.bbox.join(','), limit: String(PAGINA_LIMIET), f: 'json' });
  let url: string | null = `${BAG_PANDEN_URL}?${eersteParams}`;
  const unique = new Map<string, BagKandidaat>();
  const statistiek: BagSelectieStatistiek = { onderzocht: 0, technischAfgevallen: 0, buitenGemeente: 0, criteriaAfgevallen: 0, kandidaten: 0, paginas: 0 };

  while (url && statistiek.paginas < MAX_PAGINAS && unique.size < criteria.limiet) {
    const data = await fetchJson(url);
    statistiek.paginas += 1;
    const features = data?.features ?? [];
    statistiek.onderzocht += features.length;

    const voorVerrijking = features.filter((feature: any) => {
      const voldoet = voldoetVoorVerrijking(feature, criteria);
      if (!voldoet) statistiek.criteriaAfgevallen += 1;
      return voldoet;
    });
    const enriched = await mapBegrensd(voorVerrijking, 6, verrijkMetAdres);

    for (const item of enriched) {
      if (!item) { statistiek.technischAfgevallen += 1; continue; }
      if (!pastGebruiksdoel(item.gebruiksdoel, criteria.gebruiksdoelen)) { statistiek.criteriaAfgevallen += 1; continue; }

      // De Locatieserver levert bij gemeenterecords vaak alleen een centroide.
      // Valideer daarom ieder verrijkt adres expliciet op de officiële gemeentenaam.
      const adresGemeente = await zoekGemeenteVoorAdres(item);
      if (adresGemeente && !zelfdeGemeente(adresGemeente, gebied.naam)) { statistiek.buitenGemeente += 1; continue; }

      if (item.longitude == null || item.latitude == null) { statistiek.technischAfgevallen += 1; continue; }
      if (gebied.ringen.length && !puntInGemeente([item.longitude, item.latitude], gebied.ringen)) { statistiek.buitenGemeente += 1; continue; }
      const key = item.bagPandId || `${item.adres}|${item.postcode}`;
      if (!unique.has(key)) unique.set(key, item);
    }

    url = volgendePagina(data);
  }

  const kandidaten = [...unique.values()].slice(0, criteria.limiet);
  statistiek.kandidaten = kandidaten.length;
  return { kandidaten, statistiek };
}

export async function zoekBagKandidaten(criteria: BagSelectieCriteria): Promise<BagKandidaat[]> {
  return (await zoekBagKandidatenMetStatistiek(criteria)).kandidaten;
}
