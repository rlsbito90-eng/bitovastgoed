import type { KansInput } from '@/hooks/useVastgoedkansen';
import type { BagVerkennerPand } from './pandenverkennerModel';

export interface BagPromotieResultaat {
  toegevoegd: string[];
  mislukt: string[];
}

/**
 * Pandenverkenner werkt op BAG-pandniveau, maar `primair_adres` kan afkomstig zijn
 * van één representatief VBO. Bij een pand met meerdere VBO's mag zo'n VBO-suffix
 * niet stil het commerciële pandadres van de Vastgoedkans worden.
 */
export function pandAdresVoorPromotie(pand: BagVerkennerPand): string {
  const adres = pand.adres.trim();
  if (pand.aantalVerblijfsobjecten <= 1) return adres;
  return adres.replace(/-(?:H|\d+)$/i, '').trim();
}

export function maakHandmatigeBagKans(
  pand: BagVerkennerPand,
  scopeCode: string,
): KansInput {
  const hoofdtype = pand.gemengdGebruik
    ? 'Gemengd pand'
    : pand.gebruiksdoelen[0] ?? 'BAG-pand';
  const pandAdres = pandAdresVoorPromotie(pand);
  return {
    adres: pandAdres,
    postcode: pand.postcode ?? undefined,
    plaats: pand.plaats ?? undefined,
    typeVastgoed: pand.gebruiksdoelen.join(', ') || undefined,
    korteOmschrijving: `${hoofdtype} — ${pandAdres}`,
    herkomst: 'bag_selectie',
    herkomstReferentie: pand.voorkomenSleutel
      ? `Private BAG scope ${scopeCode}; dataset ${pand.datasetversieId}; voorkomen ${pand.voorkomenSleutel}`
      : `Private BAG scope ${scopeCode}; dataset ${pand.datasetversieId}; geselecteerd via kaart`,
    bagPandId: pand.bagPandId,
    redenInteressant: `Handmatig geselecteerd in Pandenverkenner uit BAG-dataset ${pand.datasetversieId}.`,
    status: 'te_beoordelen',
    prioriteit: 3,
    eigenaarStatus: 'niet_gestart',
    kadasterStatus: 'niet_gestart',
    briefStatus: 'niet_gestart',
    reactieStatus: 'geen_reactie',
  };
}
