import type { ActieSubfilter } from './werkbak';
import type { PrintPostFilter } from './printPostFilter';
import type { WerkrondeBron } from './werkronde';

export type AcquisitieContextTab = 'kadaster' | 'brieven';

export interface AcquisitieWerkcontext {
  tab: AcquisitieContextTab;
  bron: WerkrondeBron;
  naam: string;
}

/**
 * Centrale contextmapping voor Acquisitieselectie.
 *
 * Belangrijk: de algemene Off-Market Reviewmodus staat hier volledig buiten.
 * Deze helper bepaalt uitsluitend waar een dossier vanuit een acquisitiewerkbak
 * inhoudelijk hoort te openen en onder welke bron een hervatbare werkronde valt.
 */
export function bepaalAcquisitieWerkcontext(input: {
  subfilter: ActieSubfilter;
  printPost?: PrintPostFilter;
}): AcquisitieWerkcontext {
  if (input.subfilter === 'onderzoeken') {
    return {
      tab: 'kadaster',
      bron: 'onderzoeken',
      naam: 'Onderzoeken',
    };
  }

  if (input.subfilter === 'brief_voorbereiden') {
    return {
      tab: 'brieven',
      bron: 'brief_voorbereiden',
      naam: 'Brief voorbereiden',
    };
  }

  if (input.subfilter === 'printen_posten') {
    if (input.printPost === 'te_printen') {
      return { tab: 'brieven', bron: 'te_printen', naam: 'Te printen' };
    }
    if (input.printPost === 'te_posten') {
      return { tab: 'brieven', bron: 'te_posten', naam: 'Te posten' };
    }
    return { tab: 'brieven', bron: 'werkbak', naam: 'Printen & posten' };
  }

  if (input.subfilter === 'opvolgen') {
    return {
      tab: 'brieven',
      bron: 'opvolgen',
      naam: 'Opvolgen',
    };
  }

  return {
    tab: 'brieven',
    bron: 'werkbak',
    naam: 'Actie',
  };
}

/**
 * Geeft voor een bestaande werkronde de inhoudelijke dossier-tab terug.
 * Ook oude rondes met `werkbak` of `handmatig` blijven geldig.
 */
export function tabVoorWerkrondeBron(bron: WerkrondeBron): AcquisitieContextTab {
  return bron === 'onderzoeken' ? 'kadaster' : 'brieven';
}
