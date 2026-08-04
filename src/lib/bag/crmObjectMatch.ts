import type { BagVerkennerPand } from './pandenverkennerModel';
import { bagAdresSleutel } from './selectiePreflight';

export type CrmObjectBron = 'vastgoedkans' | 'object' | 'signaal';
export type CrmObjectMatchType = 'bag_id' | 'adres';

export interface CrmObjectReferentie {
  bron: CrmObjectBron;
  recordId: string;
  route: string;
  bagPandId?: string | null;
  adres: string;
  postcode?: string | null;
}

export interface CrmObjectMatch extends CrmObjectReferentie {
  matchtype: CrmObjectMatchType;
}

export interface CrmObjectMatchIndex {
  opBagId: Map<string, CrmObjectReferentie>;
  opAdres: Map<string, CrmObjectReferentie>;
}

const BRON_PRIORITEIT: Record<CrmObjectBron, number> = {
  vastgoedkans: 1,
  object: 2,
  signaal: 3,
};

function zetEersteOfSterkereMatch(
  map: Map<string, CrmObjectReferentie>,
  sleutel: string,
  referentie: CrmObjectReferentie,
) {
  if (!sleutel) return;
  const bestaand = map.get(sleutel);
  if (!bestaand || BRON_PRIORITEIT[referentie.bron] < BRON_PRIORITEIT[bestaand.bron]) {
    map.set(sleutel, referentie);
  }
}

export function bouwCrmObjectMatchIndex(
  referenties: CrmObjectReferentie[],
): CrmObjectMatchIndex {
  const index: CrmObjectMatchIndex = { opBagId: new Map(), opAdres: new Map() };
  referenties.forEach((referentie) => {
    const bagPandId = referentie.bagPandId?.trim();
    if (bagPandId) zetEersteOfSterkereMatch(index.opBagId, bagPandId, referentie);
    zetEersteOfSterkereMatch(
      index.opAdres,
      bagAdresSleutel(referentie.adres, referentie.postcode ?? null),
      referentie,
    );
  });
  return index;
}

export function vindCrmObjectMatch(
  pand: Pick<BagVerkennerPand, 'bagPandId' | 'adres' | 'postcode'>,
  index: CrmObjectMatchIndex,
): CrmObjectMatch | null {
  const bagMatch = index.opBagId.get(pand.bagPandId);
  if (bagMatch) return { ...bagMatch, matchtype: 'bag_id' };
  const adresMatch = index.opAdres.get(bagAdresSleutel(pand.adres, pand.postcode));
  return adresMatch ? { ...adresMatch, matchtype: 'adres' } : null;
}

export const CRM_OBJECT_BRON_LABEL: Record<CrmObjectBron, string> = {
  vastgoedkans: 'Vastgoedkans',
  object: 'Object',
  signaal: 'Signaal',
};
