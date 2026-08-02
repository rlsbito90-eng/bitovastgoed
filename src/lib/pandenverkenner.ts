import type { BagKandidaat } from '@/lib/pdokBagSelectie';

const BAG_PANDEN_URL = 'https://api.pdok.nl/kadaster/bag/ogc/v2/collections/pand/items';
const CRS84 = 'http://www.opengis.net/def/crs/OGC/1.3/CRS84';
const MAX_VBOS_PER_PAND = 60;

export interface VerrijktBagPand extends BagKandidaat {
  straat: string | null;
  wijk: string | null;
  buurt: string | null;
  gebruiksdoelen: string[];
  oppervlaktePerGebruiksdoel: Record<string, number>;
  aantalVerblijfsobjecten: number;
  gemengdGebruik: boolean;
}

function tekst(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function getal(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normaliseerDoelen(value: unknown): string[] {
  const raw = Array.isArray(value) ? value : value == null ? [] : [value];
  return [...new Set(raw.flatMap(item => String(item).split(',')).map(item => item.trim()).filter(Boolean))];
}

function verzamelHrefs(value: unknown, output: Set<string>): void {
  if (!value) return;
  if (typeof value === 'string') {
    if (value.startsWith('http')) output.add(value);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach(item => verzamelHrefs(item, output));
    return;
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    verzamelHrefs(record.href, output);
    verzamelHrefs(record.url, output);
  }
}

function vboHrefs(feature: any): string[] {
  const output = new Set<string>();
  const properties = feature?.properties ?? {};
  [
    properties['verblijfsobject.href'],
    properties.verblijfsobject_href,
    properties.verblijfsobject,
  ].forEach(value => verzamelHrefs(value, output));

  for (const link of feature?.links ?? []) {
    if (String(link?.rel ?? '').toLowerCase().includes('verblijfsobject')) {
      verzamelHrefs(link, output);
    }
  }

  return [...output].slice(0, MAX_VBOS_PER_PAND);
}

async function fetchJson(url: string): Promise<any> {
  const response = await fetch(url, { headers: { Accept: 'application/geo+json, application/json' } });
  if (!response.ok) throw new Error(`PDOK gaf fout ${response.status}.`);
  return response.json();
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

function adresStraat(adres: string): string {
  return adres.replace(/\s+\d+[a-zA-Z]?(?:[-\s].*)?$/, '').trim();
}

function eersteTekst(properties: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = tekst(properties[key]);
    if (value) return value;
  }
  return null;
}

async function verrijkPand(kandidaat: BagKandidaat): Promise<VerrijktBagPand> {
  const fallbackDoelen = normaliseerDoelen(kandidaat.gebruiksdoel);
  const fallback: VerrijktBagPand = {
    ...kandidaat,
    straat: adresStraat(kandidaat.adres) || null,
    wijk: null,
    buurt: null,
    gebruiksdoelen: fallbackDoelen,
    oppervlaktePerGebruiksdoel: kandidaat.oppervlakte && fallbackDoelen[0]
      ? { [fallbackDoelen[0]]: kandidaat.oppervlakte }
      : {},
    aantalVerblijfsobjecten: kandidaat.bagVerblijfsobjectId ? 1 : 0,
    gemengdGebruik: fallbackDoelen.length > 1,
  };

  if (!kandidaat.bagPandId) return fallback;

  let pand: any;
  try {
    pand = await fetchJson(`${BAG_PANDEN_URL}/${encodeURIComponent(kandidaat.bagPandId)}?f=json&crs=${encodeURIComponent(CRS84)}`);
  } catch {
    return fallback;
  }

  const hrefs = vboHrefs(pand);
  if (!hrefs.length) return fallback;

  const vbos = (await mapBegrensd(hrefs, 6, async href => {
    try {
      const separator = href.includes('?') ? '&' : '?';
      return await fetchJson(`${href}${separator}f=json&crs=${encodeURIComponent(CRS84)}`);
    } catch {
      return null;
    }
  })).filter(Boolean);

  if (!vbos.length) return fallback;

  const uniekeVbos = new Map<string, any>();
  vbos.forEach((vbo, index) => {
    const properties = vbo?.properties ?? vbo?.feature?.properties ?? {};
    const id = tekst(properties.identificatie ?? vbo?.id) ?? `vbo-${index}`;
    if (!uniekeVbos.has(id)) uniekeVbos.set(id, vbo);
  });

  const doelen = new Set<string>(normaliseerDoelen(pand?.properties?.gebruiksdoel));
  const oppervlaktePerGebruiksdoel: Record<string, number> = {};
  let totaleOppervlakte = 0;
  let straat = fallback.straat;
  let wijk: string | null = null;
  let buurt: string | null = null;
  let adres = kandidaat.adres;
  let postcode = kandidaat.postcode;
  let plaats = kandidaat.plaats;
  let eersteVboId = kandidaat.bagVerblijfsobjectId;

  for (const [id, vbo] of uniekeVbos) {
    const properties = vbo?.properties ?? vbo?.feature?.properties ?? {};
    const vboDoelen = normaliseerDoelen(properties.gebruiksdoel);
    vboDoelen.forEach(doel => doelen.add(doel));
    const oppervlakte = getal(properties.oppervlakte) ?? 0;
    totaleOppervlakte += oppervlakte;
    const verdeelOver = vboDoelen.length || 1;
    for (const doel of vboDoelen.length ? vboDoelen : ['Onbekend']) {
      oppervlaktePerGebruiksdoel[doel] = (oppervlaktePerGebruiksdoel[doel] ?? 0) + oppervlakte / verdeelOver;
    }

    straat ??= eersteTekst(properties, ['openbare_ruimte_naam', 'openbareruimte_naam', 'straatnaam', 'openbareRuimteNaam']);
    wijk ??= eersteTekst(properties, ['wijk_naam', 'wijknaam', 'wijk']);
    buurt ??= eersteTekst(properties, ['buurt_naam', 'buurtnaam', 'buurt']);
    postcode ??= tekst(properties.postcode);
    plaats ??= eersteTekst(properties, ['woonplaats_naam', 'woonplaatsnaam', 'woonplaats']);
    eersteVboId ??= id;

    const huisnummer = getal(properties.huisnummer);
    if (straat && huisnummer != null && adres === kandidaat.adres) {
      const huisletter = tekst(properties.huisletter) ?? '';
      const toevoeging = tekst(properties.huisnummertoevoeging) ?? '';
      adres = `${straat} ${huisnummer}${huisletter}${toevoeging ? `-${toevoeging}` : ''}`;
    }
  }

  const gebruiksdoelen = [...doelen].sort((a, b) => a.localeCompare(b, 'nl'));
  return {
    ...kandidaat,
    bagVerblijfsobjectId: eersteVboId,
    adres,
    postcode,
    plaats,
    straat: straat ?? adresStraat(adres) ?? null,
    wijk,
    buurt,
    gebruiksdoel: gebruiksdoelen.join(', ') || kandidaat.gebruiksdoel,
    gebruiksdoelen,
    oppervlakte: totaleOppervlakte || kandidaat.oppervlakte,
    oppervlaktePerGebruiksdoel,
    aantalVerblijfsobjecten: uniekeVbos.size,
    gemengdGebruik: gebruiksdoelen.length > 1,
  };
}

export async function verrijkBagPanden(kandidaten: BagKandidaat[]): Promise<VerrijktBagPand[]> {
  return mapBegrensd(kandidaten, 4, verrijkPand);
}

export function pastFunctiefilter(pand: VerrijktBagPand, filters: string[]): boolean {
  if (!filters.length) return true;
  const doelen = pand.gebruiksdoelen.map(doel => doel.toLowerCase());
  return filters.some(filter => doelen.some(doel => doel.includes(filter.toLowerCase())));
}
