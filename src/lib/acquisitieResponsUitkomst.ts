export type AcquisitieResponsStatus =
  | 'geen_reactie'
  | 'reactie_ontvangen'
  | 'interesse'
  | 'geen_interesse'
  | 'later_contact'
  | 'onbereikbaar'
  | 'onjuiste_geadresseerde';

export type AcquisitieVervolgactie =
  | 'geen'
  | 'kwalificeren'
  | 'belafspraak_plannen'
  | 'later_opvolgen'
  | 'geadresseerde_herstellen'
  | 'dossier_afsluiten';

export interface AcquisitieResponsBron {
  status?: string | null;
  ontvangenOp?: string | null;
  kanaal?: string | null;
  samenvatting?: string | null;
  uitkomst?: string | null;
  volgendeActieOp?: string | null;
}

export interface AcquisitieResponsReadModel {
  status: AcquisitieResponsStatus;
  statusLabel: string;
  ontvangenOp: string | null;
  kanaal: string | null;
  samenvatting: string | null;
  uitkomst: string | null;
  vervolgactie: AcquisitieVervolgactie;
  vervolgactieLabel: string;
  volgendeActieOp: string | null;
  stoptBriefreeks: boolean;
  vereistHandmatigeBeoordeling: boolean;
  veiligheidsmelding: string;
}

const STATUS_LABELS: Record<AcquisitieResponsStatus, string> = {
  geen_reactie: 'Geen reactie',
  reactie_ontvangen: 'Reactie ontvangen',
  interesse: 'Interesse',
  geen_interesse: 'Geen interesse',
  later_contact: 'Later contact',
  onbereikbaar: 'Onbereikbaar',
  onjuiste_geadresseerde: 'Onjuiste geadresseerde',
};

const ACTIE_LABELS: Record<AcquisitieVervolgactie, string> = {
  geen: 'Geen vervolgactie',
  kwalificeren: 'Lead kwalificeren',
  belafspraak_plannen: 'Belafspraak plannen',
  later_opvolgen: 'Later opvolgen',
  geadresseerde_herstellen: 'Geadresseerde herstellen',
  dossier_afsluiten: 'Dossier afsluiten',
};

const schoon = (waarde?: string | null): string | null => {
  const resultaat = waarde?.trim();
  return resultaat ? resultaat : null;
};

function statusVan(waarde?: string | null): AcquisitieResponsStatus {
  const status = schoon(waarde)?.toLowerCase();
  if (status === 'interesse') return 'interesse';
  if (status === 'geen_interesse') return 'geen_interesse';
  if (status === 'later_contact') return 'later_contact';
  if (status === 'onbereikbaar') return 'onbereikbaar';
  if (status === 'onjuiste_geadresseerde') return 'onjuiste_geadresseerde';
  if (status === 'reactie_ontvangen') return 'reactie_ontvangen';
  return 'geen_reactie';
}

function vervolgactieVoor(status: AcquisitieResponsStatus): AcquisitieVervolgactie {
  switch (status) {
    case 'interesse': return 'kwalificeren';
    case 'reactie_ontvangen': return 'belafspraak_plannen';
    case 'later_contact': return 'later_opvolgen';
    case 'onjuiste_geadresseerde': return 'geadresseerde_herstellen';
    case 'geen_interesse': return 'dossier_afsluiten';
    default: return 'geen';
  }
}

export function bouwAcquisitieResponsReadModel(bron: AcquisitieResponsBron): AcquisitieResponsReadModel {
  const status = statusVan(bron.status);
  const vervolgactie = vervolgactieVoor(status);
  const ontvangenOp = schoon(bron.ontvangenOp);
  const uitkomst = schoon(bron.uitkomst);
  const samenvatting = schoon(bron.samenvatting);
  const heeftInhoudelijkeReactie = !['geen_reactie', 'onbereikbaar'].includes(status);

  return {
    status,
    statusLabel: STATUS_LABELS[status],
    ontvangenOp,
    kanaal: schoon(bron.kanaal),
    samenvatting,
    uitkomst,
    vervolgactie,
    vervolgactieLabel: ACTIE_LABELS[vervolgactie],
    volgendeActieOp: schoon(bron.volgendeActieOp),
    stoptBriefreeks: heeftInhoudelijkeReactie,
    vereistHandmatigeBeoordeling: status === 'reactie_ontvangen' || (heeftInhoudelijkeReactie && !uitkomst),
    veiligheidsmelding: 'Een respons wijzigt geen dossierstatus automatisch; uitkomst en vervolgactie vereisen een bewuste bevestiging.',
  };
}
