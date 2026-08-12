import type { KansInput } from '@/hooks/useVastgoedkansen';
import type { BagVerkennerPand } from './pandenverkennerModel';

export interface BagPromotieResultaat {
  toegevoegd: string[];
  mislukt: string[];
}

export function maakHandmatigeBagKans(
  pand: BagVerkennerPand,
  scopeCode: string,
): KansInput {
  const hoofdtype = pand.gemengdGebruik
    ? 'Gemengd pand'
    : pand.gebruiksdoelen[0] ?? 'BAG-pand';
  return {
    adres: pand.adres,
    postcode: pand.postcode ?? undefined,
    plaats: pand.plaats ?? undefined,
    typeVastgoed: pand.gebruiksdoelen.join(', ') || undefined,
    korteOmschrijving: `${hoofdtype} — ${pand.adres}`,
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
