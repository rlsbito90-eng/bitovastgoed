import type { BagPandZoekAanvraagV2 } from './queryService';

interface BagV2ResultaatRij {
  bouwjaar?: string | number | null;
  status?: string | null;
  heeft_vbo?: boolean;
  vbo_aantal?: string | number | null;
  vbo_oppervlakte_som?: string | number | null;
  vbo_oppervlakte_max?: string | number | null;
  gebruiksdoelen?: string[] | null;
  is_gemengd?: boolean;
}

function getal(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function voldoet(rij: BagV2ResultaatRij, aanvraag: BagPandZoekAanvraagV2): boolean {
  const bouwjaar = getal(rij.bouwjaar);
  const som = getal(rij.vbo_oppervlakte_som);
  const max = getal(rij.vbo_oppervlakte_max);
  const aantal = getal(rij.vbo_aantal) ?? 0;

  if (aanvraag.bouwjaarVan !== null && (bouwjaar === null || bouwjaar < aanvraag.bouwjaarVan)) return false;
  if (aanvraag.bouwjaarTot !== null && (bouwjaar === null || bouwjaar > aanvraag.bouwjaarTot)) return false;
  if (aanvraag.status !== null && rij.status !== aanvraag.status) return false;
  if (aanvraag.vboOppervlakteSomVan !== null && (som === null || som < aanvraag.vboOppervlakteSomVan)) return false;
  if (aanvraag.vboOppervlakteSomTot !== null && (som === null || som > aanvraag.vboOppervlakteSomTot)) return false;
  if (aanvraag.vboOppervlakteMaxVan !== null && (max === null || max < aanvraag.vboOppervlakteMaxVan)) return false;
  if (aanvraag.vboOppervlakteMaxTot !== null && (max === null || max > aanvraag.vboOppervlakteMaxTot)) return false;
  if (aanvraag.vboAantalVan !== null && aantal < aanvraag.vboAantalVan) return false;
  if (aanvraag.vboAantalTot !== null && aantal > aanvraag.vboAantalTot) return false;
  if (aanvraag.gebruiksdoel !== null && !(rij.gebruiksdoelen ?? []).includes(aanvraag.gebruiksdoel)) return false;
  if (aanvraag.isGemengd !== null && Boolean(rij.is_gemengd) !== aanvraag.isGemengd) return false;
  if (aanvraag.vboModus === 'met_vbo' && !rij.heeft_vbo) return false;
  if (aanvraag.vboModus === 'zonder_vbo' && rij.heeft_vbo) return false;
  return true;
}

export function assertBagV2ResultatenVoldoenAanFilters(
  rows: unknown[],
  aanvraag: BagPandZoekAanvraagV2,
): void {
  const afwijkend = rows.find(row => !voldoet((row ?? {}) as BagV2ResultaatRij, aanvraag));
  if (afwijkend) {
    throw new Error('De BAG-queryservice gaf een resultaat terug dat niet aan de toegepaste filters voldoet. Ververs en probeer opnieuw.');
  }
}
