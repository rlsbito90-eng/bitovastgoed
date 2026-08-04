import {
  bouwAcquisitieDossierContext,
  type AcquisitieDossierContext,
} from './acquisitieDossierContext';

/**
 * Bewust smalle, structurele broncontracten. Deze adapters kennen geen
 * Supabase-tabellen en voeren geen reads/writes uit. Ze vertalen uitsluitend
 * reeds geladen records naar één gedeelde dossiercontext.
 */
export interface VastgoedkansDossierBron {
  id: string;
  objectId?: string | null;
  object_id?: string | null;
  adres?: string | null;
  postcode?: string | null;
  plaats?: string | null;
  eigenaarRelatieId?: string | null;
  eigenaar_relatie_id?: string | null;
}

export interface OffMarketDossierBron {
  id: string;
  objectId?: string | null;
  object_id?: string | null;
  adres?: string | null;
  postcode?: string | null;
  plaats?: string | null;
  eigenaarRelatieId?: string | null;
  eigenaar_relatie_id?: string | null;
}

const eersteWaarde = (
  ...waarden: Array<string | null | undefined>
): string | null => {
  for (const waarde of waarden) {
    const schoon = waarde?.trim();
    if (schoon) return schoon;
  }
  return null;
};

export function vastgoedkansNaarDossierContext(
  kans: VastgoedkansDossierBron,
): AcquisitieDossierContext {
  return bouwAcquisitieDossierContext('vastgoedkans', {
    id: kans.id,
    objectId: eersteWaarde(kans.objectId, kans.object_id),
    adres: kans.adres,
    postcode: kans.postcode,
    plaats: kans.plaats,
    eigenaarRelatieId: eersteWaarde(
      kans.eigenaarRelatieId,
      kans.eigenaar_relatie_id,
    ),
  });
}

export function offMarketSignaalNaarDossierContext(
  signaal: OffMarketDossierBron,
): AcquisitieDossierContext {
  return bouwAcquisitieDossierContext('off_market_signaal', {
    id: signaal.id,
    objectId: eersteWaarde(signaal.objectId, signaal.object_id),
    adres: signaal.adres,
    postcode: signaal.postcode,
    plaats: signaal.plaats,
    eigenaarRelatieId: eersteWaarde(
      signaal.eigenaarRelatieId,
      signaal.eigenaar_relatie_id,
    ),
  });
}
