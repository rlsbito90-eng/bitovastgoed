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

export interface BagUitvalredenen {
  uitgeslotenStatus: number;
  buitenBouwjaar: number;
  nietPassendGebruiksdoel: number;
  geenVboRelatie: number;
  vboOpvraagMislukt: number;
  geenVolledigAdres: number;
  geenGeldigeGeometrie: number;
  buitenGemeente: number;
  duplicaat: number;
}

export interface BagDekking {
  totaalRastervakken: number;
  geraakteRastervakken: number;
  volledigVerwerkteRastervakken: number;
  paginasGelezen: number;
  maximumPaginasPerVak: number;
  onderzoeksgrensBereikt: boolean;
  paginalimietBereiktInVakken: number;
}

export interface BagSelectieStatistiek {
  onderzocht: number;
  technischAfgevallen: number;
  buitenGemeente: number;
  criteriaAfgevallen: number;
  kandidaten: number;
  paginas: number;
  uitvalredenen: BagUitvalredenen;
  dekking: BagDekking;
}

export interface BagSelectieResultaat {
  kandidaten: BagKandidaat[];
  statistiek: BagSelectieStatistiek;
}

type Punt = [number, number];
type Ring = Punt[];
type Bbox = [number, number, number, number];
type CriteriaUitval = 'uitgeslotenStatus' | 'buitenBouwjaar' | 'nietPassendGebruiksdoel' | null;
type TechnischeUitval = 'geenVboRelatie' | 'vboOpvraagMislukt' | 'geenVolledigAdres' | 'geenGeldigeGeometrie';

interface GemeenteGebied {
  bbox: Bbox;
  ringen: Ring[];
  naam: string;
}

interface VerrijkUitkomst {
  kandidaat: BagKandidaat | null;
  uitvalreden: TechnischeUitval | null;
}

const BAG_PANDEN_URL = 'https://api.pdok.nl/kadaster/bag/ogc/v2/collections/pand/items';
const GEMEENTEGRENZEN_URL = 'https://api.pdok.nl/kadaster/brk-bestuurlijke-gebieden/ogc/v1/collections/gemeentegebied/items';
const CRS84 = 'http://www.opengis.net/def/crs/OGC/1.3/CRS84';
const RASTER_GROOTTE = 6;
const MAX_PAGINAS_PER_VAK = 5;
const PAGINA_LIMIET = 100;

export function normaliseerGemeentenaam(value: unknown): string {
  const woorden = String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .filter((woord) => woord !== 'gemeente' && woord !== 'gem');

  return woorden
    .filter((woord, index) => index === 0 || woord !== woorden[index - 1])
    .join('');
}

export function zelfdeGemeente(a: unknown, b: unknown): boolean {
  const left = normaliseerGemeentenaam(a);
  const right = normaliseerGemeentenaam(b);
  return Boolean(left && right && left === right);
}

function getal(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function tekst(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function verzamelCoordinaten(value: unknown, output: Punt[]): void {
  if (!Array.isArray(value)) return;
  if (value.length >= 2 && typeof value[0] === 'number' && typeof value[1] === 'number') {
    output.push([value[0], value[1]]);
    return;
  }
  value.forEach(child => verzamelCoordinaten(child, output));
}

function coordinatenUitTekst(raw: string): Punt[] {
  const result: Punt[] = [];
  const patroon = /(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s+(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g;
  let match: RegExpExecArray | null;
  while ((match = patroon.exec(raw)) !== null) {
    const x = Number(match[1]);
    const y = Number(match[2]);
    if (Number.isFinite(x) && Number.isFinite(y)) result.push([x, y]);
  }
  return result;
}

function ringenUitWkt(raw: string): Ring[] {
  const value = raw.replace(/^\s*SRID=\d+;\s*/i, '').trim();
  const result: Ring[] = [];
  const ringPatroon = /\(([^()]+)\)/g;
  let match: RegExpExecArray | null;
  while ((match = ringPatroon.exec(value)) !== null) {
    const ring = coordinatenUitTekst(match[1]);
    if (ring.length >= 3) result.push(ring);
  }
  if (!result.length) {
    const ring = coordinatenUitTekst(value);
    if (ring.length >= 3) result.push(ring);
  }
  return result;
}

function ringenUitGeoJson(raw: any): Ring[] {
  const geometry = raw?.geometry ?? raw;
  const coordinates = geometry?.coordinates;
  if (!Array.isArray(coordinates)) return [];
  const result: Ring[] = [];
  const bezoek = (node: unknown): void => {
    if (!Array.isArray(node)) return;
    if (node.length >= 3 && Array.isArray(node[0]) && typeof node[0][0] === 'number' && typeof node[0][1] === 'number') {
      const ring = node
        .filter((punt): punt is number[] => Array.isArray(punt) && typeof punt[0] === 'number' && typeof punt[1] === 'number')
        .map(punt => [punt[0], punt[1]] as Punt);
      if (ring.length >= 3) result.push(ring);
      return;
    }
    node.forEach(bezoek);
  };
  bezoek(coordinates);
  return result;
}

function ringenUitGeometrie(raw: unknown): Ring[] {
  if (!raw) return [];
  if (typeof raw === 'string') {
    const value = raw.trim();
    if (!value) return [];
    try {
      return ringenUitGeoJson(JSON.parse(value));
    } catch {
      return ringenUitWkt(value);
    }
  }
  return ringenUitGeoJson(raw);
}

function bboxUitPunten(punten: Punt[]): Bbox | null {
  if (!punten.length) return null;
  const xs = punten.map(([x]) => x);
  const ys = punten.map(([, y]) => y);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

export function bboxUitGeometrie(raw: unknown): Bbox | null {
  if (!raw) return null;
  if (typeof raw === 'object' && Array.isArray((raw as any)?.bbox) && (raw as any).bbox.length >= 4) {
    const bbox = (raw as any).bbox.slice(0, 4).map(Number);
    if (bbox.every(Number.isFinite)) return bbox as Bbox;
  }
  const ringen = ringenUitGeometrie(raw);
  if (ringen.length) return bboxUitPunten(ringen.flat());
  if (typeof raw === 'string') return bboxUitPunten(coordinatenUitTekst(raw));
  const punten: Punt[] = [];
  verzamelCoordinaten((raw as any)?.coordinates ?? (raw as any)?.geometry?.coordinates, punten);
  return bboxUitPunten(punten);
}

export function isGeldigeNederlandseCrs84Punt(value: unknown): value is Punt {
  if (!Array.isArray(value) || value.length < 2) return false;
  const longitude = Number(value[0]);
  const latitude = Number(value[1]);
  return Number.isFinite(longitude) && Number.isFinite(latitude) && longitude >= 2.5 && longitude <= 7.8 && latitude >= 50.5 && latitude <= 54.0;
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
  if (!ringen.length) return false;
  return ringen.reduce((binnen, ring) => (puntInRing(punt, ring) ? !binnen : binnen), false);
}

async function fetchJson(url: string): Promise<any> {
  const response = await fetch(url, { headers: { Accept: 'application/geo+json, application/json' } });
  if (!response.ok) throw new Error(`PDOK gaf fout ${response.status}. Probeer het later opnieuw.`);
  return response.json();
}

function gemeentenaamUitFeature(feature: any): string | null {
  const properties = feature?.properties ?? {};
  return tekst(properties.naam ?? properties.gemeentenaam ?? properties.gemeente_naam ?? properties.name);
}

async function zoekGemeenteGebied(gemeente: string): Promise<GemeenteGebied> {
  const opgeschoond = gemeente.trim();
  if (!opgeschoond) throw new Error('Vul een gemeente in.');
  const params = new URLSearchParams({ limit: '500', f: 'json', crs: CRS84 });
  const data = await fetchJson(`${GEMEENTEGRENZEN_URL}?${params}`);
  const features = data?.features ?? [];
  const exact = features.find((feature: any) => zelfdeGemeente(gemeentenaamUitFeature(feature), opgeschoond));
  if (!exact) throw new Error(`Gemeente “${gemeente}” is niet gevonden in de officiële gemeentegrenzen.`);
  const ringen = ringenUitGeometrie(exact.geometry);
  const bbox = bboxUitGeometrie(exact.geometry) ?? bboxUitGeometrie(exact.bbox);
  const punten = ringen.flat();
  if (!bbox || !ringen.length || !punten.every(isGeldigeNederlandseCrs84Punt)) {
    throw new Error(`Voor gemeente “${gemeente}” kon geen geldige CRS84-gemeentegrens worden bepaald.`);
  }
  return { bbox, ringen, naam: gemeentenaamUitFeature(exact) ?? opgeschoond };
}

export async function zoekGemeenteBbox(gemeente: string): Promise<Bbox> {
  return (await zoekGemeenteGebied(gemeente)).bbox;
}

export function verdeelBboxInVakken(bbox: Bbox, rasterGrootte = RASTER_GROOTTE): Bbox[] {
  const [minX, minY, maxX, maxY] = bbox;
  const breedte = (maxX - minX) / rasterGrootte;
  const hoogte = (maxY - minY) / rasterGrootte;
  const vakken: Bbox[] = [];
  for (let rij = 0; rij < rasterGrootte; rij += 1) {
    for (let kolom = 0; kolom < rasterGrootte; kolom += 1) {
      vakken.push([
        minX + kolom * breedte,
        minY + rij * hoogte,
        kolom === rasterGrootte - 1 ? maxX : minX + (kolom + 1) * breedte,
        rij === rasterGrootte - 1 ? maxY : minY + (rij + 1) * hoogte,
      ]);
    }
  }
  const midden = (rasterGrootte - 1) / 2;
  return vakken.sort((a, b) => {
    const ax = ((a[0] + a[2]) / 2 - minX) / breedte - midden;
    const ay = ((a[1] + a[3]) / 2 - minY) / hoogte - midden;
    const bx = ((b[0] + b[2]) / 2 - minX) / breedte - midden;
    const by = ((b[1] + b[3]) / 2 - minY) / hoogte - midden;
    return ax * ax + ay * ay - (bx * bx + by * by);
  });
}

function eersteVboHref(feature: any): string | null {
  const properties = feature?.properties ?? {};
  const kandidaten = [properties['verblijfsobject.href'], properties.verblijfsobject_href, properties.verblijfsobject];
  for (const kandidaat of kandidaten) {
    if (typeof kandidaat === 'string' && kandidaat.startsWith('http')) return kandidaat;
    if (Array.isArray(kandidaat)) {
      const waarde = kandidaat.find(item => typeof item === 'string' || item?.href);
      if (typeof waarde === 'string') return waarde;
      if (waarde?.href) return waarde.href;
    }
    if (kandidaat?.href) return kandidaat.href;
  }
  const link = (feature?.links ?? []).find((item: any) => String(item.rel ?? '').toLowerCase().includes('verblijfsobject'));
  return typeof link?.href === 'string' ? link.href : null;
}

function puntUitGeometry(geometry: any): [number | null, number | null] {
  const punten: Punt[] = [];
  verzamelCoordinaten(geometry?.coordinates, punten);
  if (!punten.length) return [null, null];
  const bbox = bboxUitPunten(punten);
  if (!bbox) return [null, null];
  const punt: Punt = [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2];
  return isGeldigeNederlandseCrs84Punt(punt) ? punt : [null, null];
}

function normaliseerGebruiksdoel(value: unknown): string | null {
  if (Array.isArray(value)) return value.map(String).join(', ');
  return tekst(value);
}

function pastGebruiksdoel(doel: string | null, filters: string[]): boolean {
  if (!filters.length) return true;
  if (!doel) return false;
  const lower = doel.toLowerCase();
  return filters.some(filter => lower.includes(filter.toLowerCase()));
}

function bepaalCriteriaUitval(feature: any, criteria: BagSelectieCriteria): CriteriaUitval {
  const properties = feature?.properties ?? {};
  const bouwjaar = getal(properties.bouwjaar);
  const status = String(properties.status ?? '').toLowerCase();
  const gebruiksdoel = normaliseerGebruiksdoel(properties.gebruiksdoel);
  if (status.includes('gesloopt') || status.includes('niet gerealiseerd')) return 'uitgeslotenStatus';
  if (criteria.bouwjaarVan != null && bouwjaar != null && bouwjaar < criteria.bouwjaarVan) return 'buitenBouwjaar';
  if (criteria.bouwjaarTot != null && bouwjaar != null && bouwjaar > criteria.bouwjaarTot) return 'buitenBouwjaar';
  if (gebruiksdoel && !pastGebruiksdoel(gebruiksdoel, criteria.gebruiksdoelen)) return 'nietPassendGebruiksdoel';
  return null;
}

async function verrijkMetAdres(feature: any): Promise<VerrijkUitkomst> {
  const properties = feature?.properties ?? {};
  const href = eersteVboHref(feature);
  if (!href) return { kandidaat: null, uitvalreden: 'geenVboRelatie' };
  let vbo: any;
  try {
    const separator = href.includes('?') ? '&' : '?';
    vbo = await fetchJson(`${href}${separator}f=json&crs=${encodeURIComponent(CRS84)}`);
  } catch {
    return { kandidaat: null, uitvalreden: 'vboOpvraagMislukt' };
  }
  const vboProperties = vbo?.properties ?? vbo?.feature?.properties ?? {};
  const straat = tekst(vboProperties.openbare_ruimte_naam ?? vboProperties.openbareruimte_naam ?? vboProperties.straatnaam ?? vboProperties.openbareRuimteNaam);
  const huisnummer = getal(vboProperties.huisnummer);
  if (!straat || huisnummer == null) return { kandidaat: null, uitvalreden: 'geenVolledigAdres' };
  const [longitude, latitude] = puntUitGeometry(feature?.geometry ?? vbo?.geometry);
  if (longitude == null || latitude == null) return { kandidaat: null, uitvalreden: 'geenGeldigeGeometrie' };
  const huisletter = tekst(vboProperties.huisletter) ?? '';
  const toevoeging = tekst(vboProperties.huisnummertoevoeging) ?? '';
  return {
    kandidaat: {
      bagPandId: String(properties.identificatie ?? feature?.id ?? ''),
      bagVerblijfsobjectId: tekst(vboProperties.identificatie ?? vbo?.id),
      adres: `${straat} ${huisnummer}${huisletter}${toevoeging ? `-${toevoeging}` : ''}`,
      postcode: tekst(vboProperties.postcode),
      plaats: tekst(vboProperties.woonplaats_naam ?? vboProperties.woonplaatsnaam ?? vboProperties.woonplaats),
      bouwjaar: getal(properties.bouwjaar),
      gebruiksdoel: normaliseerGebruiksdoel(properties.gebruiksdoel ?? vboProperties.gebruiksdoel),
      oppervlakte: getal(vboProperties.oppervlakte),
      status: tekst(properties.status),
      longitude,
      latitude,
    },
    uitvalreden: null,
  };
}

async function mapBegrensd<T, R>(items: T[], concurrency: number, mapper: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;
  async function worker(): Promise<void> {
    while (index < items.length) {
      const current = index++;
      results[current] = await mapper(items[current]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}

function volgendePagina(data: any): string | null {
  const link = (data?.links ?? []).find((item: any) => String(item.rel ?? '').toLowerCase() === 'next');
  return typeof link?.href === 'string' ? link.href : null;
}

export async function zoekBagKandidatenMetStatistiek(criteria: BagSelectieCriteria): Promise<BagSelectieResultaat> {
  const gebied = await zoekGemeenteGebied(criteria.gemeente);
  const vakken = verdeelBboxInVakken(gebied.bbox);
  const unique = new Map<string, BagKandidaat>();
  const gezieneFeatures = new Set<string>();
  const statistiek: BagSelectieStatistiek = {
    onderzocht: 0,
    technischAfgevallen: 0,
    buitenGemeente: 0,
    criteriaAfgevallen: 0,
    kandidaten: 0,
    paginas: 0,
    uitvalredenen: {
      uitgeslotenStatus: 0,
      buitenBouwjaar: 0,
      nietPassendGebruiksdoel: 0,
      geenVboRelatie: 0,
      vboOpvraagMislukt: 0,
      geenVolledigAdres: 0,
      geenGeldigeGeometrie: 0,
      buitenGemeente: 0,
      duplicaat: 0,
    },
    dekking: {
      totaalRastervakken: vakken.length,
      geraakteRastervakken: 0,
      volledigVerwerkteRastervakken: 0,
      paginasGelezen: 0,
      maximumPaginasPerVak: MAX_PAGINAS_PER_VAK,
      onderzoeksgrensBereikt: false,
      paginalimietBereiktInVakken: 0,
    },
  };

  for (const vak of vakken) {
    if (unique.size >= criteria.limiet) {
      statistiek.dekking.onderzoeksgrensBereikt = true;
      break;
    }
    statistiek.dekking.geraakteRastervakken += 1;
    const params = new URLSearchParams({ bbox: vak.join(','), 'bbox-crs': CRS84, crs: CRS84, limit: String(PAGINA_LIMIET), f: 'json' });
    let url: string | null = `${BAG_PANDEN_URL}?${params}`;
    let paginasInVak = 0;
    let vakVolledig = false;

    while (url && paginasInVak < MAX_PAGINAS_PER_VAK && unique.size < criteria.limiet) {
      const data = await fetchJson(url);
      paginasInVak += 1;
      statistiek.paginas += 1;
      statistiek.dekking.paginasGelezen += 1;
      const features = (data?.features ?? []).filter((feature: any) => {
        const id = String(feature?.properties?.identificatie ?? feature?.id ?? '');
        if (id && gezieneFeatures.has(id)) {
          statistiek.uitvalredenen.duplicaat += 1;
          return false;
        }
        if (id) gezieneFeatures.add(id);
        return true;
      });
      statistiek.onderzocht += features.length;

      const voorVerrijking = features.filter((feature: any) => {
        const reden = bepaalCriteriaUitval(feature, criteria);
        if (!reden) return true;
        statistiek.uitvalredenen[reden] += 1;
        statistiek.criteriaAfgevallen += 1;
        return false;
      });

      const verrijkt = await mapBegrensd(voorVerrijking, 6, verrijkMetAdres);
      for (const uitkomst of verrijkt) {
        if (!uitkomst.kandidaat) {
          if (uitkomst.uitvalreden) statistiek.uitvalredenen[uitkomst.uitvalreden] += 1;
          statistiek.technischAfgevallen += 1;
          continue;
        }
        const item = uitkomst.kandidaat;
        if (!pastGebruiksdoel(item.gebruiksdoel, criteria.gebruiksdoelen)) {
          statistiek.uitvalredenen.nietPassendGebruiksdoel += 1;
          statistiek.criteriaAfgevallen += 1;
          continue;
        }
        if (!puntInGemeente([item.longitude!, item.latitude!], gebied.ringen)) {
          statistiek.uitvalredenen.buitenGemeente += 1;
          statistiek.buitenGemeente += 1;
          continue;
        }
        const key = item.bagPandId || `${item.adres}|${item.postcode}`;
        if (unique.has(key)) {
          statistiek.uitvalredenen.duplicaat += 1;
          continue;
        }
        unique.set(key, item);
        if (unique.size >= criteria.limiet) {
          statistiek.dekking.onderzoeksgrensBereikt = true;
          break;
        }
      }

      const next = volgendePagina(data);
      url = next;
      if (!next) vakVolledig = true;
    }

    if (vakVolledig) statistiek.dekking.volledigVerwerkteRastervakken += 1;
    else if (url && paginasInVak >= MAX_PAGINAS_PER_VAK) statistiek.dekking.paginalimietBereiktInVakken += 1;
  }

  const kandidaten = [...unique.values()].slice(0, criteria.limiet);
  statistiek.kandidaten = kandidaten.length;
  return { kandidaten, statistiek };
}

export async function zoekBagKandidaten(criteria: BagSelectieCriteria): Promise<BagKandidaat[]> {
  return (await zoekBagKandidatenMetStatistiek(criteria)).kandidaten;
}
