import type { AcquisitieDossierContext } from './acquisitieDossierContext';

export type AcquisitieKadasterFase =
  | 'adres_controleren'
  | 'bag_context_controleren'
  | 'kadaster_aanvragen'
  | 'eigenaar_beoordelen'
  | 'gereed_voor_opvolging';

export interface AcquisitieKadasterBrongegevens {
  adresControleGeslaagd?: boolean | null;
  bagPandId?: string | null;
  bagVerblijfsobjectId?: string | null;
  kadasterStatus?: string | null;
  kadastraleAanduiding?: string | null;
  eigenaarNaam?: string | null;
  eigenaarRelatieId?: string | null;
  laatstGecontroleerdOp?: string | null;
}

export interface AcquisitieKadasterReadModel {
  dossier: AcquisitieDossierContext;
  fase: AcquisitieKadasterFase;
  faseLabel: string;
  primaireActie: string;
  toelichting: string;
  adresControleGeslaagd: boolean;
  bagContextAanwezig: boolean;
  kadasterOnderzoekAanwezig: boolean;
  eigenaarBekend: boolean;
  eigenaarRelatieGekoppeld: boolean;
  magKadasterVoorbereiden: boolean;
  magEigenaarBeoordelen: boolean;
  magOpvolgingStarten: boolean;
  veiligheidsmelding: string;
}

const gevuld = (waarde?: string | null): boolean => Boolean(waarde?.trim());

const kadasterOnderzoekAanwezig = (bron: AcquisitieKadasterBrongegevens): boolean => {
  const status = bron.kadasterStatus?.trim().toLowerCase();
  return gevuld(bron.kadastraleAanduiding)
    || Boolean(status && !['niet_gestart', 'onbekend', 'niet_bekend'].includes(status));
};

export function bouwAcquisitieKadasterReadModel(
  dossier: AcquisitieDossierContext,
  bron: AcquisitieKadasterBrongegevens,
): AcquisitieKadasterReadModel {
  const adresControleGeslaagd = bron.adresControleGeslaagd === true;
  const bagContextAanwezig = gevuld(bron.bagPandId) || gevuld(bron.bagVerblijfsobjectId);
  const heeftKadasterOnderzoek = kadasterOnderzoekAanwezig(bron);
  const eigenaarBekend = gevuld(bron.eigenaarNaam) || gevuld(bron.eigenaarRelatieId) || gevuld(dossier.eigenaarRelatieId);
  const eigenaarRelatieGekoppeld = gevuld(bron.eigenaarRelatieId) || gevuld(dossier.eigenaarRelatieId);

  let fase: AcquisitieKadasterFase;
  let faseLabel: string;
  let primaireActie: string;
  let toelichting: string;

  if (!adresControleGeslaagd) {
    fase = 'adres_controleren';
    faseLabel = 'Adres controleren';
    primaireActie = 'Controleer het doeladres';
    toelichting = 'Bevestig eerst dat het dossier naar het juiste pand en adres verwijst.';
  } else if (!bagContextAanwezig) {
    fase = 'bag_context_controleren';
    faseLabel = 'BAG-context controleren';
    primaireActie = 'Controleer BAG-pand en verblijfsobject';
    toelichting = 'Leg de objectcontext vast voordat een Kadasterhandeling wordt voorbereid.';
  } else if (!heeftKadasterOnderzoek) {
    fase = 'kadaster_aanvragen';
    faseLabel = 'Kadaster voorbereiden';
    primaireActie = 'Bereid een handmatige Kadastercontrole voor';
    toelichting = 'De aanvraag blijft een bewuste handmatige handeling en wordt nooit automatisch besteld.';
  } else if (!eigenaarBekend) {
    fase = 'eigenaar_beoordelen';
    faseLabel = 'Eigenaar beoordelen';
    primaireActie = 'Beoordeel de rechthebbende';
    toelichting = 'Controleer de gevonden rechthebbende en neem deze niet automatisch over in het CRM.';
  } else {
    fase = 'gereed_voor_opvolging';
    faseLabel = 'Gereed voor opvolging';
    primaireActie = eigenaarRelatieGekoppeld ? 'Start brief of contactopvolging' : 'Koppel of maak de CRM-relatie';
    toelichting = eigenaarRelatieGekoppeld
      ? 'De eigenaar is gekoppeld en het dossier kan door naar brief- of contactopvolging.'
      : 'De eigenaar is bekend, maar moet nog bewust aan een CRM-relatie worden gekoppeld.';
  }

  return {
    dossier,
    fase,
    faseLabel,
    primaireActie,
    toelichting,
    adresControleGeslaagd,
    bagContextAanwezig,
    kadasterOnderzoekAanwezig: heeftKadasterOnderzoek,
    eigenaarBekend,
    eigenaarRelatieGekoppeld,
    magKadasterVoorbereiden: adresControleGeslaagd && bagContextAanwezig,
    magEigenaarBeoordelen: heeftKadasterOnderzoek,
    magOpvolgingStarten: eigenaarBekend && eigenaarRelatieGekoppeld,
    veiligheidsmelding: 'Kadaster blijft handmatig: geen automatische bestelling, eigenaarsovername of CRM-koppeling.',
  };
}
