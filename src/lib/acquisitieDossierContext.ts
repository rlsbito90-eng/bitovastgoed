export type AcquisitieDossierBronType = 'off_market_signaal' | 'vastgoedkans';

export interface AcquisitieDossierContext {
  bronType: AcquisitieDossierBronType;
  bronId: string;
  objectId: string | null;
  adres: string;
  plaats: string | null;
  eigenaarRelatieId: string | null;
}

export interface AcquisitieDossierBronInput {
  id: string;
  objectId?: string | null;
  adres?: string | null;
  postcode?: string | null;
  plaats?: string | null;
  eigenaarRelatieId?: string | null;
}

const schoon = (waarde: string | null | undefined): string | null => {
  const resultaat = waarde?.trim();
  return resultaat ? resultaat : null;
};

export function bouwAcquisitieDossierContext(
  bronType: AcquisitieDossierBronType,
  bron: AcquisitieDossierBronInput,
): AcquisitieDossierContext {
  const bronId = schoon(bron.id);
  if (!bronId) throw new Error('Acquisitiedossier vereist een bron-ID.');

  const adresdelen = [schoon(bron.adres), schoon(bron.postcode), schoon(bron.plaats)]
    .filter((waarde): waarde is string => Boolean(waarde));

  return {
    bronType,
    bronId,
    objectId: schoon(bron.objectId),
    adres: adresdelen.join(', '),
    plaats: schoon(bron.plaats),
    eigenaarRelatieId: schoon(bron.eigenaarRelatieId),
  };
}

export interface EigenaarWorkflowCapabilities {
  kanBewerken: boolean;
  kanRelatieKoppelen: boolean;
  kanTaakAanmaken: boolean;
  kanContactmomentRegistreren: boolean;
  kanKadasterCheckRegistreren: boolean;
}

export interface BrievenWorkflowCapabilities {
  kanBriefVoorbereiden: boolean;
  kanPdfGenereren: boolean;
  kanVerzendingRegistreren: boolean;
  kanResponsRegistreren: boolean;
  kanOpvolgtaakAanmaken: boolean;
}

export interface AcquisitieDossierCapabilities {
  eigenaar: EigenaarWorkflowCapabilities;
  brieven: BrievenWorkflowCapabilities;
}

export const VOLLEDIGE_INTERNE_ACQUISITIE_CAPABILITIES: AcquisitieDossierCapabilities = {
  eigenaar: {
    kanBewerken: true,
    kanRelatieKoppelen: true,
    kanTaakAanmaken: true,
    kanContactmomentRegistreren: true,
    kanKadasterCheckRegistreren: true,
  },
  brieven: {
    kanBriefVoorbereiden: true,
    kanPdfGenereren: true,
    kanVerzendingRegistreren: true,
    kanResponsRegistreren: true,
    kanOpvolgtaakAanmaken: true,
  },
};
