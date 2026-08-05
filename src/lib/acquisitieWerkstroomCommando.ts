import type { AcquisitieEndToEndReadModel } from './acquisitieEndToEndWerkstroom';

export type AcquisitieWerkstroomCommandoType =
  | 'relatie_koppelen'
  | 'geadresseerde_controleren'
  | 'brief_voorbereiden'
  | 'verzending_registreren'
  | 'respons_registreren'
  | 'respons_beoordelen'
  | 'vervolgactie_plannen'
  | 'dossierstatus_bepalen';

export interface AcquisitieWerkstroomCommando {
  type: AcquisitieWerkstroomCommandoType;
  label: string;
  toegestaan: boolean;
  vereistBevestiging: boolean;
  toelichting: string;
}

export function bepaalAcquisitieWerkstroomCommando(
  model: AcquisitieEndToEndReadModel,
): AcquisitieWerkstroomCommando {
  switch (model.fase) {
    case 'eigenaar_controleren':
      return model.primaireActie.toLowerCase().includes('crm-relatie')
        ? {
            type: 'relatie_koppelen',
            label: 'CRM-relatie koppelen',
            toegestaan: true,
            vereistBevestiging: true,
            toelichting: 'Koppel uitsluitend na bewuste selectie van de juiste relatie.',
          }
        : {
            type: 'geadresseerde_controleren',
            label: 'Geadresseerde bevestigen',
            toegestaan: true,
            vereistBevestiging: true,
            toelichting: 'Controleer naam en correspondentieadres vóór de briefreeks wordt vrijgegeven.',
          };
    case 'briefreeks_uitvoeren':
      return {
        type: model.primaireActie.toLowerCase().includes('verzend')
          ? 'verzending_registreren'
          : 'brief_voorbereiden',
        label: model.primaireActie,
        toegestaan: true,
        vereistBevestiging: true,
        toelichting: 'Deze actie genereert of verstuurt niets automatisch.',
      };
    case 'respons_beoordelen':
      return {
        type: 'respons_beoordelen',
        label: 'Reactie beoordelen',
        toegestaan: true,
        vereistBevestiging: true,
        toelichting: 'Bevestig de inhoudelijke uitkomst handmatig.',
      };
    case 'vervolgactie_uitvoeren':
      return {
        type: 'vervolgactie_plannen',
        label: model.primaireActie,
        toegestaan: true,
        vereistBevestiging: true,
        toelichting: 'Planning of registratie gebeurt pas na expliciete bevestiging.',
      };
    case 'afgerond':
      return {
        type: 'dossierstatus_bepalen',
        label: 'Definitieve dossierstatus bepalen',
        toegestaan: true,
        vereistBevestiging: true,
        toelichting: 'De werkstroom wijzigt de dossierstatus nooit automatisch.',
      };
  }
}
