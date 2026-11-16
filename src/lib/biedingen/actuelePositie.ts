import type { Bieding } from './types';
import type { BiedboekTraject } from './offerBook';

/** Aard van het voorstel: staat los van verzending, voorbehouden en het type biedronde. */
export type BodKarakter = 'indicatief' | 'formeel';

export function bodKarakterLabel(
  bod: Pick<Bieding, 'bodKarakter' | 'offerType'> | null | undefined,
): string {
  if (!bod) return 'Niet vastgelegd';
  if (bod.bodKarakter === 'formeel') return 'Formeel';
  if (bod.bodKarakter === 'indicatief') return 'Indicatief';
  // Alleen een historische registratie met letterlijk type 'indicatief' is herkenbaar.
  // Een schriftelijk of voorwaardelijk bod is NIET automatisch formeel.
  return bod.offerType === 'indicatief' ? 'Indicatief' : 'Niet vastgelegd';
}

export interface ActueleBiedpositie {
  titel: string;
  vervolgstap: string;
  toelichting: string;
}

export function actueleBiedpositie(
  traject: Pick<BiedboekTraject, 'fase' | 'laatste'>,
): ActueleBiedpositie {
  const { fase, laatste } = traject;
  switch (fase) {
    case 'geaccepteerd':
      return {
        titel: 'Kopersbod geaccepteerd',
        vervolgstap: 'Transactie-Deal en afspraken opvolgen',
        toelichting: 'De acceptatie is geregistreerd. Controleer de verdere transactieafspraken.',
      };
    case 'afgewezen':
      return {
        titel: 'Laatste voorstel afgewezen',
        vervolgstap: 'Geen openstaand voorstel; nieuw bod afzonderlijk registreren',
        toelichting: 'De afwijzing blijft zichtbaar in de onderhandelingshistorie.',
      };
    case 'ingetrokken':
      return {
        titel: 'Voorstel ingetrokken',
        vervolgstap: 'Eventueel een nieuw voorstel registreren',
        toelichting: 'Deze onderhandelingsronde is afgesloten.',
      };
    case 'verlopen':
      return {
        titel: 'Geldigheid verstreken',
        vervolgstap: 'Nieuwe geldigheid of nieuw voorstel bij partijen navragen',
        toelichting: 'Het verlopen voorstel is niet meer als actief bod weergegeven.',
      };
    case 'concept':
      return {
        titel: 'Concept geregistreerd',
        vervolgstap: 'Controleer en registreer wanneer het voorstel daadwerkelijk is uitgebracht',
        toelichting: 'Een concept is nog geen uitgebracht of ontvangen bod.',
      };
    case 'wacht_op_koper':
      if (laatste.status === 'in_behandeling') {
        return {
          titel: 'Bij koper in behandeling',
          vervolgstap: 'Reactie koper opvolgen en vastleggen',
          toelichting: 'Het verkopersvoorstel is in beoordeling; er is nog geen kopersbesluit geregistreerd.',
        };
      }
      if (laatste.status === 'aangepast_bod_gevraagd') {
        return {
          titel: 'Aangepast kopersbod gevraagd',
          vervolgstap: 'Koper opvolgen; ontvangen aangepast bod als nieuwe biedronde vastleggen',
          toelichting: 'Er is nog geen nieuw bod geregistreerd.',
        };
      }
      return {
        titel: 'Verkopersvoorstel geregistreerd',
        vervolgstap: 'Controleer of het voorstel is gedeeld en vraag reactie van koper',
        toelichting: 'Registratie betekent niet automatisch dat een bericht is verzonden.',
      };
    case 'wacht_op_verkoper':
      if (laatste.status === 'in_behandeling') {
        return {
          titel: 'Bij verkoper in behandeling',
          vervolgstap: 'Besluit verkoper opvolgen: accepteren, afwijzen of tegenvoorstel',
          toelichting: 'Bod wordt beoordeeld; er is nog geen verkopersbesluit vastgelegd.',
        };
      }
      if (laatste.status === 'ontvangen') {
        return {
          titel: 'Kopersbod ontvangen',
          vervolgstap: 'Met verkoper bespreken en beoordeling vastleggen',
          toelichting: 'Ontvangen betekent niet automatisch dat de verkoper al beoordeelt.',
        };
      }
      return {
        titel: 'Reactie verkoper nodig',
        vervolgstap: 'Verkopersbesluit of tegenvoorstel vastleggen',
        toelichting: 'Controleer de laatste biedronde en bijbehorende voorwaarden.',
      };
  }
}
