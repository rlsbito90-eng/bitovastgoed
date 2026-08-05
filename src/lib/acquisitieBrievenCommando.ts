import type { AcquisitieBrievenReadModel } from './acquisitieBrievenReadModel';
import type { AcquisitieWerkstroomCommando } from './acquisitieWerkstroomCommando';

export function bepaalAcquisitieBrievenCommando(
  model: AcquisitieBrievenReadModel,
): AcquisitieWerkstroomCommando {
  switch (model.fase) {
    case 'eigenaar_nodig':
      return {
        type: 'relatie_koppelen',
        label: model.primaireActie,
        toegestaan: true,
        vereistBevestiging: true,
        toelichting: 'Selecteer en bevestig de juiste CRM-relatie bewust.',
      };
    case 'geadresseerde_controleren':
      return {
        type: 'geadresseerde_controleren',
        label: model.primaireActie,
        toegestaan: true,
        vereistBevestiging: true,
        toelichting: 'Controleer naam en correspondentieadres voordat de brief wordt vrijgegeven.',
      };
    case 'brief_voorbereiden':
      return {
        type: 'brief_voorbereiden',
        label: model.primaireActie,
        toegestaan: model.magBriefVoorbereiden,
        vereistBevestiging: true,
        toelichting: 'Open uitsluitend het bestaande briefconcept- of voorbereidingsproces.',
      };
    case 'verzending_registreren':
      return {
        type: 'verzending_registreren',
        label: model.primaireActie,
        toegestaan: model.magVerzendingRegistreren,
        vereistBevestiging: true,
        toelichting: 'Registreer alleen een verzending die daadwerkelijk en bewust is uitgevoerd.',
      };
    case 'opvolgen':
      return {
        type: 'vervolgactie_plannen',
        label: model.primaireActie,
        toegestaan: model.magOpvolgingRegistreren,
        vereistBevestiging: true,
        toelichting: 'Plan of registreer opvolging zonder automatische taak- of statusmutatie.',
      };
    case 'afgerond':
      return {
        type: 'respons_beoordelen',
        label: model.primaireActie,
        toegestaan: true,
        vereistBevestiging: true,
        toelichting: 'Beoordeel de reactie en bevestig de uitkomst handmatig.',
      };
  }
}
