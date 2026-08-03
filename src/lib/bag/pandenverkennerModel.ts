export interface BagServicePandRij {
  datasetversie_id: string | number;
  identificatie: string;
  voorkomen_sleutel: string;
  status: string | null;
  velden: Record<string, unknown>;
  volgende_cursor: string;
}

export interface BagVerkennerPand {
  datasetversieId: string;
  bagPandId: string;
  voorkomenSleutel: string;
  status: string | null;
  adres: string;
  adresCompleet: boolean;
  postcode: string | null;
  plaats: string | null;
  bouwjaar: number | null;
  gebruiksdoelen: string[];
  oppervlakte: number | null;
  gemengdGebruik: boolean;
  cursor: string;
}

export interface BagVerkennerFilters {
  zoekterm: string;
  gebruiksdoelen: string[];
  alleenGemengd: boolean;
  sortering: 'adres' | 'bouwjaar' | 'oppervlakte' | 'identificatie';
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
    'openbare_ruimte_naam', 'openbareruimte_naam', 'straatnaam', 'straat',
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
    postcode: eersteTekst(velden, ['postcode']),
    plaats: eersteTekst(velden, ['woonplaats_naam', 'woonplaatsnaam', 'woonplaats', 'plaats']),
    bouwjaar: getal(velden.oorspronkelijk_bouwjaar ?? velden.bouwjaar),
    gebruiksdoelen: doelen,
    oppervlakte: getal(velden.oppervlakte ?? velden.gebruiksoppervlakte),
    gemengdGebruik: doelen.length > 1,
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
    return [pand.adres, pand.postcode, pand.plaats, pand.bagPandId, ...pand.gebruiksdoelen]
      .some(value => norm(value).includes(zoekterm));
  });

  return resultaat.sort((a, b) => {
    if (filters.sortering === 'bouwjaar') {
      return (a.bouwjaar ?? Number.MAX_SAFE_INTEGER) - (b.bouwjaar ?? Number.MAX_SAFE_INTEGER)
        || a.bagPandId.localeCompare(b.bagPandId, 'nl');
    }
    if (filters.sortering === 'oppervlakte') {
      return (b.oppervlakte ?? -1) - (a.oppervlakte ?? -1)
        || a.bagPandId.localeCompare(b.bagPandId, 'nl');
    }
    if (filters.sortering === 'adres') {
      return a.adres.localeCompare(b.adres, 'nl') || a.bagPandId.localeCompare(b.bagPandId, 'nl');
    }
    return a.bagPandId.localeCompare(b.bagPandId, 'nl');
  });
}
