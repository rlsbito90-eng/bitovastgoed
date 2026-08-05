import {
  vastgoedkansNaarDossierContext,
  offMarketSignaalNaarDossierContext,
  type VastgoedkansDossierBron,
  type OffMarketDossierBron,
} from './acquisitieDossierAdapters';
import {
  bouwAcquisitieBrievenReadModel,
  type AcquisitieBrievenReadModel,
} from './acquisitieBrievenReadModel';

export interface VastgoedkansBrievenBron extends VastgoedkansDossierBron {
  eigenaarNaam?: string | null;
  eigenaar_naam?: string | null;
  briefGeadresseerde?: string | null;
  brief_geadresseerde?: string | null;
  briefStatus?: string | null;
  brief_status?: string | null;
  briefVerzondenOp?: string | null;
  brief_verzonden_op?: string | null;
  briefKenmerk?: string | null;
  brief_kenmerk?: string | null;
  opvolgdatum?: string | null;
  reactieStatus?: string | null;
  reactie_status?: string | null;
  reactieOntvangenOp?: string | null;
  reactie_ontvangen_op?: string | null;
}

export interface OffMarketBrievenBron extends OffMarketDossierBron {
  eigenaarNaam?: string | null;
  eigenaar_naam?: string | null;
  briefGeadresseerde?: string | null;
  brief_geadresseerde?: string | null;
  briefStatus?: string | null;
  brief_status?: string | null;
  briefVerzondenOp?: string | null;
  brief_verzonden_op?: string | null;
  briefKenmerk?: string | null;
  brief_kenmerk?: string | null;
  opvolgdatum?: string | null;
  reactieStatus?: string | null;
  reactie_status?: string | null;
  reactieOntvangenOp?: string | null;
  reactie_ontvangen_op?: string | null;
}

const eerste = (...waarden: Array<string | null | undefined>): string | null => {
  for (const waarde of waarden) {
    const schoon = waarde?.trim();
    if (schoon) return schoon;
  }
  return null;
};

const naarBrongegevens = (bron: VastgoedkansBrievenBron | OffMarketBrievenBron) => ({
  eigenaarNaam: eerste(bron.eigenaarNaam, bron.eigenaar_naam),
  eigenaarRelatieId: eerste(bron.eigenaarRelatieId, bron.eigenaar_relatie_id),
  geadresseerde: eerste(bron.briefGeadresseerde, bron.brief_geadresseerde),
  briefStatus: eerste(bron.briefStatus, bron.brief_status),
  briefVerzondenOp: eerste(bron.briefVerzondenOp, bron.brief_verzonden_op),
  briefKenmerk: eerste(bron.briefKenmerk, bron.brief_kenmerk),
  opvolgdatum: eerste(bron.opvolgdatum),
  reactieStatus: eerste(bron.reactieStatus, bron.reactie_status),
  reactieOntvangenOp: eerste(bron.reactieOntvangenOp, bron.reactie_ontvangen_op),
});

export function vastgoedkansNaarBrievenReadModel(
  kans: VastgoedkansBrievenBron,
): AcquisitieBrievenReadModel {
  return bouwAcquisitieBrievenReadModel(
    vastgoedkansNaarDossierContext(kans),
    naarBrongegevens(kans),
  );
}

export function offMarketSignaalNaarBrievenReadModel(
  signaal: OffMarketBrievenBron,
): AcquisitieBrievenReadModel {
  return bouwAcquisitieBrievenReadModel(
    offMarketSignaalNaarDossierContext(signaal),
    naarBrongegevens(signaal),
  );
}
