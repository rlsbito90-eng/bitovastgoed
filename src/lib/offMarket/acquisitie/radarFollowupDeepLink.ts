import { isSorteerOptie } from './sortering';
import type { ActieSubfilter, WerkbakView } from './werkbak';

export const RADAR_FOLLOWUP_DEEP_LINK = '/off-market?tab=acquisitieselectie&werkbak=actie&subfilter=opvolgen&bron=radar&sortering=opvolgdatum_oudste';

const GELDIGE_TABS = new Set(['dashboard', 'signalen', 'kaart', 'acquisitieselectie']);
const GELDIGE_WERKBAKKEN = new Set<WerkbakView>(['actie', 'wachten', 'afgehandeld', 'alles']);
const GELDIGE_SUBFILTERS = new Set<ActieSubfilter>([
  'alle', 'onderzoeken', 'eigenaar_controleren', 'adres_achterhalen', 'brief_voorbereiden',
  'printen_posten', 'opvolgen',
]);
const GELDIGE_BRONNEN = new Set(['alles', 'radar', 'pandenverkenner']);

export interface StorageWriter {
  setItem(key: string, value: string): void;
}

/**
 * Zet alleen expliciete, geldige deep-link parameters om naar de bestaande
 * sessionStorage-viewstate. Daardoor opent een pushmelding rechtstreeks in de
 * juiste Radar-werkvoorraad zonder de normale bewaarde werksituatie te breken.
 */
export function pasOffMarketDeepLinkToe(search: string, storage?: StorageWriter): boolean {
  if (!search) return false;
  const params = new URLSearchParams(search);
  const target = storage ?? (typeof sessionStorage !== 'undefined' ? sessionStorage : null);
  if (!target) return false;

  let toegepast = false;
  const tab = params.get('tab');
  if (tab && GELDIGE_TABS.has(tab)) {
    target.setItem('off-market-filter:tab', tab);
    toegepast = true;
  }

  const werkbak = params.get('werkbak');
  if (werkbak && GELDIGE_WERKBAKKEN.has(werkbak as WerkbakView)) {
    target.setItem('off-market-acq:werkbak', werkbak);
    toegepast = true;
  }

  const subfilter = params.get('subfilter');
  if (subfilter && GELDIGE_SUBFILTERS.has(subfilter as ActieSubfilter)) {
    target.setItem('off-market-acq:subfilter', subfilter);
    toegepast = true;
  }

  const bron = params.get('bron');
  if (bron && GELDIGE_BRONNEN.has(bron)) {
    target.setItem('off-market-acq:bron', bron);
    toegepast = true;
  }

  const sortering = params.get('sortering');
  if (sortering && isSorteerOptie(sortering)) {
    target.setItem('off-market-acq:sortering', sortering);
    toegepast = true;
  }

  return toegepast;
}
