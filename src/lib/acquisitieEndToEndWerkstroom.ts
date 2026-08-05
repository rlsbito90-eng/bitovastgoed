import type { AcquisitieBriefOpvolgreeksReadModel } from './acquisitieBriefOpvolgreeks';
import type { AcquisitieResponsReadModel } from './acquisitieResponsUitkomst';

export type AcquisitieWerkstroomFase =
  | 'eigenaar_controleren'
  | 'briefreeks_uitvoeren'
  | 'respons_beoordelen'
  | 'vervolgactie_uitvoeren'
  | 'afgerond';

export interface AcquisitieEndToEndBron {
  relatieGekoppeld: boolean;
  geadresseerdeGecontroleerd: boolean;
  briefreeks: AcquisitieBriefOpvolgreeksReadModel;
  respons: AcquisitieResponsReadModel;
  vervolgactieAfgerond?: boolean;
}

export interface AcquisitieEndToEndReadModel {
  fase: AcquisitieWerkstroomFase;
  faseLabel: string;
  primaireActie: string;
  toelichting: string;
  voortgang: number;
  geblokkeerd: boolean;
  veiligheidsmelding: string;
}

const LABELS: Record<AcquisitieWerkstroomFase, string> = {
  eigenaar_controleren: 'Eigenaar en geadresseerde controleren',
  briefreeks_uitvoeren: 'Briefreeks uitvoeren',
  respons_beoordelen: 'Respons beoordelen',
  vervolgactie_uitvoeren: 'Vervolgactie uitvoeren',
  afgerond: 'Werkstroom afgerond',
};

export function bouwAcquisitieEndToEndWerkstroom(
  bron: AcquisitieEndToEndBron,
): AcquisitieEndToEndReadModel {
  let fase: AcquisitieWerkstroomFase;
  let primaireActie: string;
  let toelichting: string;

  if (!bron.relatieGekoppeld || !bron.geadresseerdeGecontroleerd) {
    fase = 'eigenaar_controleren';
    primaireActie = !bron.relatieGekoppeld
      ? 'Koppel de eigenaar bewust aan een CRM-relatie'
      : 'Controleer de geadresseerde en het correspondentieadres';
    toelichting = 'De briefreeks blijft geblokkeerd totdat eigenaar en geadresseerde bewust zijn gecontroleerd.';
  } else if (!bron.briefreeks.afgerond && !bron.respons.stoptBriefreeks) {
    fase = 'briefreeks_uitvoeren';
    primaireActie = bron.briefreeks.actieveBrief
      ? `Werk Brief ${bron.briefreeks.actieveBrief} af`
      : 'Controleer de briefreeks';
    toelichting = 'Elke brief vereist een expliciete voorbereiding en verzendregistratie.';
  } else if (bron.respons.vereistHandmatigeBeoordeling) {
    fase = 'respons_beoordelen';
    primaireActie = 'Beoordeel de ontvangen reactie en bevestig de uitkomst';
    toelichting = 'Een ontvangen reactie wijzigt de dossierstatus nooit automatisch.';
  } else if (bron.respons.vervolgactie !== 'geen' && !bron.vervolgactieAfgerond) {
    fase = 'vervolgactie_uitvoeren';
    primaireActie = bron.respons.vervolgactieLabel;
    toelichting = bron.respons.volgendeActieOp
      ? `Gepland voor ${bron.respons.volgendeActieOp}.`
      : 'Plan of registreer de bewuste vervolgactie.';
  } else {
    fase = 'afgerond';
    primaireActie = 'Controleer het dossier en bepaal de definitieve acquisitiestatus';
    toelichting = 'De brief- en responswerkstroom is afgerond; een definitieve dossierbeslissing blijft handmatig.';
  }

  const voortgang = {
    eigenaar_controleren: 20,
    briefreeks_uitvoeren: 50,
    respons_beoordelen: 70,
    vervolgactie_uitvoeren: 85,
    afgerond: 100,
  }[fase];

  return {
    fase,
    faseLabel: LABELS[fase],
    primaireActie,
    toelichting,
    voortgang,
    geblokkeerd: fase === 'eigenaar_controleren',
    veiligheidsmelding: 'Deze werkstroom toont en ordent acties, maar koppelt geen eigenaar, genereert of verzendt geen brief en wijzigt geen dossierstatus automatisch.',
  };
}
