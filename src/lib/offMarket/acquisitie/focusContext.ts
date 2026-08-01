import type { ReadinessFase } from './readiness';

export type FocusContext =
  | 'onderzoeken'
  | 'brief_voorbereiden'
  | 'te_printen'
  | 'te_posten'
  | 'opvolgen'
  | 'afgehandeld';

export interface FocusContextInfo {
  context: FocusContext;
  titel: string;
  instructie: string;
}

export function bepaalFocusContext(fase: ReadinessFase): FocusContextInfo {
  switch (fase) {
    case 'onderzoek_nodig':
    case 'eigenaar_ontbreekt':
    case 'adres_ontbreekt':
      return {
        context: 'onderzoeken',
        titel: 'Onderzoeken',
        instructie: 'Controleer en vul de ontbrekende eigenaar- of adresgegevens aan.',
      };
    case 'brief_voorbereiden':
      return {
        context: 'brief_voorbereiden',
        titel: 'Brief voorbereiden',
        instructie: 'Controleer de geadresseerden en bereid de brief voor.',
      };
    case 'concept_gereed':
    case 'gereed_voor_print':
      return {
        context: 'te_printen',
        titel: 'Te printen',
        instructie: 'Controleer het concept en maak de brief printklaar.',
      };
    case 'geprint':
      return {
        context: 'te_posten',
        titel: 'Te posten',
        instructie: 'Controleer de geprinte brief en registreer de postverzending.',
      };
    case 'gepost':
    case 'email_verzonden':
    case 'opvolging_open':
      return {
        context: 'opvolgen',
        titel: 'Opvolgen',
        instructie: 'Controleer de opvolgdatum en registreer contact of respons.',
      };
    case 'afgerond':
      return {
        context: 'afgehandeld',
        titel: 'Afgehandeld',
        instructie: 'Controleer of het dossier volledig en correct is afgerond.',
      };
  }
}
