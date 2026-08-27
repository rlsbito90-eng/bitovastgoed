import type {
  BagPandZoekAanvraagV2,
  BagPandZoekAanvraagV3,
  BagPandZoekAanvraagV4,
} from './queryService';
import { echteWijkCodes } from './amsterdamRingFilter';

interface BagV2ResultaatRij {
  bouwjaar?: string | number | null;
  status?: string | null;
  heeft_vbo?: boolean;
  vbo_aantal?: string | number | null;
  vbo_oppervlakte_som?: string | number | null;
  vbo_oppervlakte_max?: string | number | null;
  gebruiksdoelen?: string[] | null;
  is_gemengd?: boolean;
  wijk_code?: string | null;
  buurt_code?: string | null;
}

function getal(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function voldoetGemeenschappelijk(
  rij: BagV2ResultaatRij,
  aanvraag: BagPandZoekAanvraagV2 | BagPandZoekAanvraagV3 | BagPandZoekAanvraagV4,
): boolean {
  const bouwjaar = getal(rij.bouwjaar);
  const som = getal(rij.vbo_oppervlakte_som);
  const max = getal(rij.vbo_oppervlakte_max);
  const aantal = getal(rij.vbo_aantal) ?? 0;

  if (aanvraag.bouwjaarVan !== null && (bouwjaar === null || bouwjaar < aanvraag.bouwjaarVan)) return false;
  if (aanvraag.bouwjaarTot !== null && (bouwjaar === null || bouwjaar > aanvraag.bouwjaarTot)) return false;
  if (aanvraag.vboOppervlakteSomVan !== null && (som === null || som < aanvraag.vboOppervlakteSomVan)) return false;
  if (aanvraag.vboOppervlakteSomTot !== null && (som === null || som > aanvraag.vboOppervlakteSomTot)) return false;
  if (aanvraag.vboOppervlakteMaxVan !== null && (max === null || max < aanvraag.vboOppervlakteMaxVan)) return false;
  if (aanvraag.vboOppervlakteMaxTot !== null && (max === null || max > aanvraag.vboOppervlakteMaxTot)) return false;
  if (aanvraag.vboAantalVan !== null && aantal < aanvraag.vboAantalVan) return false;
  if (aanvraag.vboAantalTot !== null && aantal > aanvraag.vboAantalTot) return false;
  if (aanvraag.isGemengd !== null && Boolean(rij.is_gemengd) !== aanvraag.isGemengd) return false;
  if (aanvraag.vboModus === 'met_vbo' && !rij.heeft_vbo) return false;
  if (aanvraag.vboModus === 'zonder_vbo' && rij.heeft_vbo) return false;
  return true;
}

function voldoetV2(rij: BagV2ResultaatRij, aanvraag: BagPandZoekAanvraagV2): boolean {
  if (!voldoetGemeenschappelijk(rij, aanvraag)) return false;
  if (aanvraag.status !== null && rij.status !== aanvraag.status) return false;
  if (aanvraag.gebruiksdoel !== null && !(rij.gebruiksdoelen ?? []).includes(aanvraag.gebruiksdoel)) return false;
  return true;
}

function voldoetV3(rij: BagV2ResultaatRij, aanvraag: BagPandZoekAanvraagV3): boolean {
  if (!voldoetGemeenschappelijk(rij, aanvraag)) return false;
  if (aanvraag.statussen.length && !aanvraag.statussen.includes(rij.status ?? '')) return false;
  if (aanvraag.gebruiksdoelen.length && !aanvraag.gebruiksdoelen.some(doel => (rij.gebruiksdoelen ?? []).includes(doel))) return false;
  return true;
}

function voldoetV4(rij: BagV2ResultaatRij, aanvraag: BagPandZoekAanvraagV4): boolean {
  if (!voldoetV3(rij, aanvraag)) return false;
  const wijkCodes = echteWijkCodes(aanvraag.wijkCodes);
  if (wijkCodes.length && !wijkCodes.includes(rij.wijk_code ?? '')) return false;
  if (aanvraag.buurtCodes.length && !aanvraag.buurtCodes.includes(rij.buurt_code ?? '')) return false;
  return true;
}

function assertResultaten(rows: unknown[], voldoet: (rij: BagV2ResultaatRij) => boolean): void {
  const afwijkend = rows.find(row => !voldoet((row ?? {}) as BagV2ResultaatRij));
  if (afwijkend) {
    throw new Error('De BAG-queryservice gaf een resultaat terug dat niet aan de toegepaste filters voldoet. Ververs en probeer opnieuw.');
  }
}

export function assertBagV2ResultatenVoldoenAanFilters(rows: unknown[], aanvraag: BagPandZoekAanvraagV2): void {
  assertResultaten(rows, rij => voldoetV2(rij, aanvraag));
}

export function assertBagV3ResultatenVoldoenAanFilters(rows: unknown[], aanvraag: BagPandZoekAanvraagV3): void {
  assertResultaten(rows, rij => voldoetV3(rij, aanvraag));
}

export function assertBagV4ResultatenVoldoenAanFilters(rows: unknown[], aanvraag: BagPandZoekAanvraagV4): void {
  assertResultaten(rows, rij => voldoetV4(rij, aanvraag));
}
