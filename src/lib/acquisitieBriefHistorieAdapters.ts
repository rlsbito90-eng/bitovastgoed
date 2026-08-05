import type { AcquisitieDossierContext } from './acquisitieDossierContext';
import {
  bouwAcquisitieBriefDossierReadModel,
  type AcquisitieBriefDossierReadModel,
  type AcquisitieBriefGebeurtenisBron,
} from './acquisitieBriefHistorie';

export interface VastgoedkansBriefHistorieBron {
  briefStatus?: string | null;
  brief_status?: string | null;
  briefKenmerk?: string | null;
  brief_kenmerk?: string | null;
  briefGeadresseerde?: string | null;
  brief_geadresseerde?: string | null;
  briefVerzendwijze?: string | null;
  brief_verzendwijze?: string | null;
  briefVerzondenOp?: string | null;
  brief_verzonden_op?: string | null;
  briefGebeurtenissen?: AcquisitieBriefGebeurtenisBron[] | null;
  brief_gebeurtenissen?: AcquisitieBriefGebeurtenisBron[] | null;
}

export function vastgoedkansNaarBriefDossier(
  dossier: AcquisitieDossierContext,
  bron: VastgoedkansBriefHistorieBron,
): AcquisitieBriefDossierReadModel {
  return bouwAcquisitieBriefDossierReadModel(dossier, {
    briefStatus: bron.briefStatus ?? bron.brief_status,
    briefKenmerk: bron.briefKenmerk ?? bron.brief_kenmerk,
    briefGeadresseerde: bron.briefGeadresseerde ?? bron.brief_geadresseerde,
    briefVerzendwijze: bron.briefVerzendwijze ?? bron.brief_verzendwijze,
    briefVerzondenOp: bron.briefVerzondenOp ?? bron.brief_verzonden_op,
    gebeurtenissen: bron.briefGebeurtenissen ?? bron.brief_gebeurtenissen,
  });
}

export const offMarketNaarBriefDossier = vastgoedkansNaarBriefDossier;
