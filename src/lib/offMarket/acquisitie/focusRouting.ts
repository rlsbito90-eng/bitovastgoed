import type { WerkrondeBron } from './werkronde';

export type AcquisitieDoelTab = 'kadaster' | 'brieven';

/**
 * Acquisitiecontext bepaalt de inhoudelijke starttab. De algemene Reviewmodus
 * mag deze workflowkeuze niet overschrijven.
 */
export function bepaalAcquisitieDoelTab(bron: WerkrondeBron): AcquisitieDoelTab {
  switch (bron) {
    case 'onderzoeken':
      return 'kadaster';
    case 'brief_voorbereiden':
    case 'te_printen':
    case 'te_posten':
    case 'opvolgen':
      return 'brieven';
    case 'werkbak':
    case 'handmatig':
      return 'brieven';
  }
}

/** URL voor openen/navigeren binnen een acquisitiewerkronde. */
export function acquisitieSignaalPad(signaalId: string, bron: WerkrondeBron): string {
  return `/off-market/${signaalId}?mode=normaal&tab=${bepaalAcquisitieDoelTab(bron)}`;
}
