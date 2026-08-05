import type { AcquisitieWerkstroomCommandoType } from './acquisitieWerkstroomCommando';

export type VastgoedkansWerkTabDoel = 'onderzoek' | 'kadaster' | 'brieven' | 'dossier';

export interface VastgoedkansSchermActie {
  tab: VastgoedkansWerkTabDoel;
  anker?: string;
  intentie:
    | 'relatie_selecteren'
    | 'geadresseerde_controleren'
    | 'briefconcept_openen'
    | 'verzending_registreren'
    | 'opvolging_plannen'
    | 'respons_beoordelen'
    | 'dossierstatus_bepalen';
  veiligheidsmelding: string;
}

export interface OffMarketSchermActie {
  dialoog:
    | 'relatie_koppelen'
    | 'brief_voorbereiden'
    | 'markeer_verstuurd'
    | 'registreer_respons'
    | 'plan_opvolging'
    | 'dossierstatus_bepalen';
  vereistGeselecteerdeBrief: boolean;
  veiligheidsmelding: string;
}

export function routeerVastgoedkansCommando(
  type: AcquisitieWerkstroomCommandoType,
): VastgoedkansSchermActie {
  switch (type) {
    case 'relatie_koppelen':
      return {
        tab: 'kadaster',
        anker: 'vastgoedkans-eigenaaronderzoek',
        intentie: 'relatie_selecteren',
        veiligheidsmelding: 'Open uitsluitend de bestaande handmatige CRM-relatieselectie.',
      };
    case 'geadresseerde_controleren':
      return {
        tab: 'brieven',
        anker: 'vastgoedkans-briefgegevens',
        intentie: 'geadresseerde_controleren',
        veiligheidsmelding: 'Neem geen geadresseerde automatisch over uit bron- of Kadastergegevens.',
      };
    case 'brief_voorbereiden':
      return {
        tab: 'brieven',
        anker: 'vastgoedkans-briefgegevens',
        intentie: 'briefconcept_openen',
        veiligheidsmelding: 'Open alleen het bestaande briefconcept; genereer of verzend niets automatisch.',
      };
    case 'verzending_registreren':
      return {
        tab: 'brieven',
        anker: 'vastgoedkans-verzending',
        intentie: 'verzending_registreren',
        veiligheidsmelding: 'Registreer uitsluitend een reeds bewust uitgevoerde verzending.',
      };
    case 'respons_registreren':
    case 'respons_beoordelen':
      return {
        tab: 'brieven',
        anker: 'vastgoedkans-reactie',
        intentie: 'respons_beoordelen',
        veiligheidsmelding: 'Bevestig respons en uitkomst handmatig; wijzig geen dossierstatus automatisch.',
      };
    case 'vervolgactie_plannen':
      return {
        tab: 'brieven',
        anker: 'vastgoedkans-opvolging',
        intentie: 'opvolging_plannen',
        veiligheidsmelding: 'Plan de vervolgactie uitsluitend na expliciete gebruikersbevestiging.',
      };
    case 'dossierstatus_bepalen':
      return {
        tab: 'dossier',
        intentie: 'dossierstatus_bepalen',
        veiligheidsmelding: 'De definitieve acquisitiestatus blijft een handmatige dossierbeslissing.',
      };
  }
}

export function routeerOffMarketCommando(
  type: AcquisitieWerkstroomCommandoType,
): OffMarketSchermActie {
  switch (type) {
    case 'relatie_koppelen':
      return {
        dialoog: 'relatie_koppelen',
        vereistGeselecteerdeBrief: false,
        veiligheidsmelding: 'Gebruik de bestaande handmatige CRM-relatiekoppeling.',
      };
    case 'geadresseerde_controleren':
    case 'brief_voorbereiden':
      return {
        dialoog: 'brief_voorbereiden',
        vereistGeselecteerdeBrief: false,
        veiligheidsmelding: 'Open de bestaande BriefVoorbereidenDialog; verstuur niets automatisch.',
      };
    case 'verzending_registreren':
      return {
        dialoog: 'markeer_verstuurd',
        vereistGeselecteerdeBrief: true,
        veiligheidsmelding: 'Gebruik uitsluitend MarkeerVerstuurdDialog voor een geselecteerde brief.',
      };
    case 'respons_registreren':
    case 'respons_beoordelen':
      return {
        dialoog: 'registreer_respons',
        vereistGeselecteerdeBrief: true,
        veiligheidsmelding: 'Gebruik uitsluitend RegistreerResponsDialog voor een geselecteerde brief.',
      };
    case 'vervolgactie_plannen':
      return {
        dialoog: 'plan_opvolging',
        vereistGeselecteerdeBrief: false,
        veiligheidsmelding: 'Gebruik de bestaande handmatige opvolgflow; maak geen taak automatisch.',
      };
    case 'dossierstatus_bepalen':
      return {
        dialoog: 'dossierstatus_bepalen',
        vereistGeselecteerdeBrief: false,
        veiligheidsmelding: 'De definitieve dossierstatus blijft handmatig.',
      };
  }
}
