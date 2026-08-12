export interface BagServicePandRij {
  datasetversie_id: string | number;
  identificatie: string;
  voorkomen_sleutel: string;
  status: string | null;
  velden: Record<string, unknown>;
  volgende_cursor: string;
}

export interface BagServicePandV2Rij {
  datasetversie_id: string | number;
  index_build_id: string | number;
  identificatie: string;
  voorkomen_sleutel: string;
  status: string | null;
  bouwjaar: string | number | null;
  heeft_vbo: boolean;
  vbo_aantal: string | number;
  vbo_oppervlakte_som: string | number | null;
  vbo_oppervlakte_max: string | number | null;
  gebruiksdoelen: string[] | null;
  is_gemengd: boolean;
  primair_adres: string | null;
  primair_straat: string | null;
  primair_postcode: string | null;
  primair_plaats: string | null;
  adres_count: string | number;
  wijk_code?: string | null;
  wijk_naam?: string | null;
  buurt_code?: string | null;
  buurt_naam?: string | null;
  volgende_cursor: string;
}

export interface BagVerkennerPand {
  datasetversieId: string;
  bagPandId: string;
  voorkomenSleutel: string;
  status: string | null;
  adres: string;
  adresCompleet: boolean;
  straat: string | null;
  postcode: string | null;
  plaats: string | null;
  wijkCode: string | null;
  wijkNaam: string | null;
  buurtCode: string | null;
  buurtNaam: string | null;
  bouwjaar: number | null;
  gebruiksdoelen: string[];
  oppervlakte: number | null;
  aantalVerblijfsobjecten: number;
  gemengdGebruik: boolean;
  cursor: string;
}

export type BagVerkennerSortering =
  | 'identificatie'
  | 'adres_az'
  | 'adres_za'
  | 'bouwjaar_oud_nieuw'
  | 'bouwjaar_nieuw_oud'
  | 'gbo_groot_klein'
  | 'gbo_klein_groot'
  | 'vbo_aantal_hoog_laag'
  | 'vbo_aantal_laag_hoog';

export interface BagVerkennerFilters {
  zoekterm: string;
  gebruiksdoelen: string[];
  alleenGemengd: boolean;
  sortering: BagVerkennerSortering;
}

function tekst(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function eersteTekst(velden: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = tekst(velden[key]);
    if (value) return value;
  }
  return null;
}

function getal(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function gebruiksdoelen(value: unknown): string[] {
  const values = Array.isArray(value) ? value : value == null ? [] : [value];
  return [...new Set(values.flatMap(item => String(item).split(','))
    .map(item => item.trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'nl'));
}

export function normaliseerBagServicePand(rij: BagServicePandRij): BagVerkennerPand {
  const velden = rij.velden ?? {};
  const straat = eersteTekst(velden, [
    'straat', 'openbare_ruimte_naam', 'openbareruimte_naam', 'straatnaam',
  ]);
  const huisnummer = getal(velden.huisnummer);
  const huisletter = tekst(velden.huisletter) ?? '';
  const toevoeging = tekst(velden.huisnummertoevoeging) ?? '';
  const samengesteldAdres = straat && huisnummer !== null
    ? `${straat} ${huisnummer}${huisletter}${toevoeging ? `-${toevoeging}` : ''}`
    : null;
  const doelen = gebruiksdoelen(velden.gebruiksdoel ?? velden.gebruiksdoelen);
  const bronAdres = eersteTekst(velden, ['adres', 'volledig_adres']) ?? samengesteldAdres;

  return {
    datasetversieId: String(rij.datasetversie_id),
    bagPandId: rij.identificatie,
    voorkomenSleutel: rij.voorkomen_sleutel,
    status: rij.status,
    adres: bronAdres ?? rij.identificatie,
    adresCompleet: bronAdres !== null,
    straat,
    postcode: eersteTekst(velden, ['postcode']),
    plaats: eersteTekst(velden, ['woonplaats_naam', 'woonplaatsnaam', 'woonplaats', 'plaats']),
    wijkCode: null,
    wijkNaam: null,
    buurtCode: null,
    buurtNaam: null,
    bouwjaar: getal(
      velden.oorspronkelijkBouwjaar ?? velden.oorspronkelijk_bouwjaar ?? velden.bouwjaar,
    ),
    gebruiksdoelen: doelen,
    oppervlakte: getal(velden.oppervlakte ?? velden.gebruiksoppervlakte),
    aantalVerblijfsobjecten: getal(
      velden.aantalVerblijfsobjecten ?? velden.aantal_verblijfsobjecten,
    ) ?? 0,
    gemengdGebruik: doelen.length > 1,
    cursor: rij.volgende_cursor,
  };
}

export function normaliseerBagServicePandV2(rij: BagServicePandV2Rij): BagVerkennerPand {
  const adres = tekst(rij.primair_adres);
  const doelen = gebruiksdoelen(rij.gebruiksdoelen);
  return {
    datasetversieId: String(rij.datasetversie_id),
    bagPandId: rij.identificatie,
    voorkomenSleutel: rij.voorkomen_sleutel,
    status: rij.status,
    adres: adres ?? rij.identificatie,
    adresCompleet: adres !== null,
    straat: tekst(rij.primair_straat),
    postcode: tekst(rij.primair_postcode),
    plaats: tekst(rij.primair_plaats),
    wijkCode: tekst(rij.wijk_code),
    wijkNaam: tekst(rij.wijk_naam),
    buurtCode: tekst(rij.buurt_code),
    buurtNaam: tekst(rij.buurt_naam),
    bouwjaar: getal(rij.bouwjaar),
    gebruiksdoelen: doelen,
    oppervlakte: getal(rij.vbo_oppervlakte_som),
    aantalVerblijfsobjecten: getal(rij.vbo_aantal) ?? 0,
    gemengdGebruik: Boolean(rij.is_gemengd),
    cursor: rij.volgende_cursor,
  };
}

function norm(value: unknown): string {
  return String(value ?? '').trim().toLocaleLowerCase('nl');
}

export function filterEnSorteerBagPanden(
  panden: BagVerkennerPand[],
  filters: BagVerkennerFilters,
): BagVerkennerPand[] {
  const zoekterm = norm(filters.zoekterm);
  const doelen = filters.gebruiksdoelen.map(norm);
  const resultaat = panden.filter((pand) => {
    if (filters.alleenGemengd && !pand.gemengdGebruik) return false;
    if (doelen.length && !doelen.some(doel => pand.gebruiksdoelen.some(
      pandDoel => norm(pandDoel).includes(doel),
    ))) return false;
    if (!zoekterm) return true;
    return [
      pand.adres, pand.straat, pand.postcode, pand.plaats, pand.wijkNaam, pand.buurtNaam,
      pand.bagPandId, ...pand.gebruiksdoelen,
    ].some(value => norm(value).includes(zoekterm));
  });

  return resultaat.sort((a, b) => {
    if (filters.sortering === 'bouwjaar_oud_nieuw') {
      return (a.bouwjaar ?? Number.MAX_SAFE_INTEGER) - (b.bouwjaar ?? Number.MAX_SAFE_INTEGER)
        || a.bagPandId.localeCompare(b.bagPandId, 'nl');
    }
    if (filters.sortering === 'bouwjaar_nieuw_oud') {
      return (b.bouwjaar ?? -1) - (a.bouwjaar ?? -1)
        || a.bagPandId.localeCompare(b.bagPandId, 'nl');
    }
    if (filters.sortering === 'gbo_groot_klein') {
      return (b.oppervlakte ?? -1) - (a.oppervlakte ?? -1)
        || a.bagPandId.localeCompare(b.bagPandId, 'nl');
    }
    if (filters.sortering === 'gbo_klein_groot') {
      return (a.oppervlakte ?? Number.MAX_SAFE_INTEGER) - (b.oppervlakte ?? Number.MAX_SAFE_INTEGER)
        || a.bagPandId.localeCompare(b.bagPandId, 'nl');
    }
    if (filters.sortering === 'vbo_aantal_hoog_laag') {
      return b.aantalVerblijfsobjecten - a.aantalVerblijfsobjecten
        || a.bagPandId.localeCompare(b.bagPandId, 'nl');
    }
    if (filters.sortering === 'vbo_aantal_laag_hoog') {
      return a.aantalVerblijfsobjecten - b.aantalVerblijfsobjecten
        || a.bagPandId.localeCompare(b.bagPandId, 'nl');
    }
    if (filters.sortering === 'adres_az') {
      return a.adres.localeCompare(b.adres, 'nl') || a.bagPandId.localeCompare(b.bagPandId, 'nl');
    }
    if (filters.sortering === 'adres_za') {
      return b.adres.localeCompare(a.adres, 'nl') || a.bagPandId.localeCompare(b.bagPandId, 'nl');
    }
    return a.bagPandId.localeCompare(b.bagPandId, 'nl');
  });
}
