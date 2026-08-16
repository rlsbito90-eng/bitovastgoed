import type { ReadinessFase } from './readiness';

export type FocusContext =
  | 'onderzoeken'
  | 'brief_voorbereiden'
  | 'te_printen'
  | 'te_posten'
  | 'opvolgen'
  | 'afgehandeld';

export type FocusTab = 'onderzoek' | 'kadaster' | 'brieven';

export interface FocusContextInfo {
  context: FocusContext;
  titel: string;
  instructie: string;
  /** Primaire dossier-tab voor deze acquisitiecontext. */
  tab: FocusTab;
}

export function tabVoorFocusContext(context: FocusContext): FocusTab {
  switch (context) {
    case 'onderzoeken':
      return 'kadaster';
    case 'brief_voorbereiden':
    case 'te_printen':
    case 'te_posten':
    case 'opvolgen':
    case 'afgehandeld':
      return 'brieven';
  }
}

export function bepaalFocusContext(fase: ReadinessFase): FocusContextInfo {
  switch (fase) {
    case 'onderzoek_nodig':
    case 'eigenaar_ontbreekt':
    case 'eigenaar_controleren':
    case 'adres_ontbreekt':
      return {
        context: 'onderzoeken',
        titel: fase === 'eigenaar_controleren'
          ? 'Eigenaar controleren'
          : fase === 'adres_ontbreekt'
            ? 'Adres achterhalen'
            : 'Onderzoeken',
        instructie: fase === 'eigenaar_controleren'
          ? 'Controleer de Kadasterrechten en rechthebbende voordat je verdergaat.'
          : fase === 'adres_ontbreekt'
            ? 'De eigenaar is bekend. Achterhaal en vul het ontbrekende verzendadres aan.'
            : 'Controleer en vul de ontbrekende eigenaar- of adresgegevens aan.',
        tab: 'kadaster',
      };
    case 'brief_voorbereiden':
      return {
        context: 'brief_voorbereiden',
        titel: 'Brief voorbereiden',
        instructie: 'Controleer de geadresseerden en bereid de brief voor.',
        tab: 'brieven',
      };
    case 'concept_gereed':
    case 'gereed_voor_print':
      return {
        context: 'te_printen',
        titel: 'Te printen',
        instructie: 'Controleer het concept en maak de brief printklaar.',
        tab: 'brieven',
      };
    case 'geprint':
      return {
        context: 'te_posten',
        titel: 'Te posten',
        instructie: 'Controleer de geprinte brief en registreer de postverzending.',
        tab: 'brieven',
      };
    case 'gepost':
    case 'email_verzonden':
    case 'opvolging_open':
      return {
        context: 'opvolgen',
        titel: 'Opvolgen',
        instructie: 'Controleer de opvolgdatum en registreer contact of respons.',
        tab: 'brieven',
      };
    case 'afgerond':
      return {
        context: 'afgehandeld',
        titel: 'Afgehandeld',
        instructie: 'Controleer of het dossier volledig en correct is afgerond.',
        tab: 'brieven',
      };
  }
}
