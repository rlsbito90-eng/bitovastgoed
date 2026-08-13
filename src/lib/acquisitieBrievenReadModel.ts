import type { AcquisitieDossierContext } from './acquisitieDossierContext';

export type AcquisitieBriefFase =
  | 'eigenaar_nodig'
  | 'geadresseerde_controleren'
  | 'brief_voorbereiden'
  | 'verzending_registreren'
  | 'opvolgen'
  | 'afgerond';

export interface AcquisitieBrievenBrongegevens {
  eigenaarNaam?: string | null;
  eigenaarRelatieId?: string | null;
  geadresseerde?: string | null;
  briefStatus?: string | null;
  briefVerzondenOp?: string | null;
  briefKenmerk?: string | null;
  opvolgdatum?: string | null;
  reactieStatus?: string | null;
  reactieOntvangenOp?: string | null;
}

export interface AcquisitieBrievenReadModel {
  dossier: AcquisitieDossierContext;
  fase: AcquisitieBriefFase;
  faseLabel: string;
  primaireActie: string;
  toelichting: string;
  eigenaarNaam: string | null;
  eigenaarBekend: boolean;
  relatieGekoppeld: boolean;
  geadresseerdeAanwezig: boolean;
  briefVoorbereid: boolean;
  briefVerzonden: boolean;
  reactieOntvangen: boolean;
  magBriefVoorbereiden: boolean;
  magVerzendingRegistreren: boolean;
  magOpvolgingRegistreren: boolean;
  veiligheidsmelding: string;
}

const gevuld = (waarde?: string | null): boolean => Boolean(waarde?.trim());
const norm = (waarde?: string | null): string => waarde?.trim().toLowerCase() ?? '';

export function bouwAcquisitieBrievenReadModel(
  dossier: AcquisitieDossierContext,
  bron: AcquisitieBrievenBrongegevens,
): AcquisitieBrievenReadModel {
  const eigenaarNaam = bron.eigenaarNaam?.trim() || null;
  const eigenaarBekend = gevuld(bron.eigenaarNaam) || gevuld(bron.eigenaarRelatieId) || gevuld(dossier.eigenaarRelatieId);
  const relatieGekoppeld = gevuld(bron.eigenaarRelatieId) || gevuld(dossier.eigenaarRelatieId);
  const geadresseerdeAanwezig = gevuld(bron.geadresseerde);
  const status = norm(bron.briefStatus);
  const briefVoorbereid = ['voorbereiden', 'klaar', 'verzonden', 'reactie_ontvangen'].includes(status)
    || gevuld(bron.briefKenmerk);
  const briefVerzonden = status === 'verzonden'
    || status === 'reactie_ontvangen'
    || gevuld(bron.briefVerzondenOp);
  const reactieStatus = norm(bron.reactieStatus);
  const reactieOntvangen = Boolean(
    reactieStatus && !['geen_reactie', 'niet_gestart', 'onbekend'].includes(reactieStatus),
  ) || gevuld(bron.reactieOntvangenOp);

  let fase: AcquisitieBriefFase;
  let faseLabel: string;
  let primaireActie: string;
  let toelichting: string;

  if (!eigenaarBekend || !relatieGekoppeld) {
    fase = 'eigenaar_nodig';
    faseLabel = 'Eigenaar koppelen';
    primaireActie = eigenaarBekend ? 'Koppel de eigenaar aan een CRM-relatie' : 'Rond eigenaarsonderzoek af';
    toelichting = 'Een brief wordt pas voorbereid nadat de eigenaar bewust is beoordeeld en gekoppeld.';
  } else if (!geadresseerdeAanwezig) {
    fase = 'geadresseerde_controleren';
    faseLabel = 'Geadresseerde controleren';
    primaireActie = 'Controleer naam en correspondentieadres';
    toelichting = 'Neem een geadresseerde niet automatisch over uit Kadaster- of brongegevens.';
  } else if (!briefVoorbereid) {
    fase = 'brief_voorbereiden';
    faseLabel = 'Brief voorbereiden';
    primaireActie = 'Maak of selecteer een briefconcept';
    toelichting = 'Controleer inhoud, geadresseerde en objectcontext vóór PDF-generatie of verzending.';
  } else if (!briefVerzonden) {
    fase = 'verzending_registreren';
    faseLabel = 'Verzending registreren';
    primaireActie = 'Registreer de bewuste verzending';
    toelichting = 'De read-modelstatus verzendt niets automatisch en registreert alleen een expliciete handeling.';
  } else if (!reactieOntvangen) {
    fase = 'opvolgen';
    faseLabel = 'Opvolgen';
    primaireActie = gevuld(bron.opvolgdatum) ? 'Voer de geplande opvolging uit' : 'Plan een opvolgmoment';
    toelichting = 'Leg opvolging en eventuele respons vast in het acquisitiedossier.';
  } else {
    fase = 'afgerond';
    faseLabel = 'Reactie geregistreerd';
    primaireActie = 'Beoordeel de reactie en bepaal de vervolgstatus';
    toelichting = 'De briefcyclus heeft een geregistreerde reactie en kan naar de volgende acquisitiefase.';
  }

  return {
    dossier,
    fase,
    faseLabel,
    primaireActie,
    toelichting,
    eigenaarNaam,
    eigenaarBekend,
    relatieGekoppeld,
    geadresseerdeAanwezig,
    briefVoorbereid,
    briefVerzonden,
    reactieOntvangen,
    magBriefVoorbereiden: eigenaarBekend && relatieGekoppeld && geadresseerdeAanwezig,
    magVerzendingRegistreren: briefVoorbereid && geadresseerdeAanwezig,
    magOpvolgingRegistreren: briefVerzonden,
    veiligheidsmelding: 'Geen automatische eigenaarsovername, PDF-generatie, verzending of taakmutatie.',
  };
}
