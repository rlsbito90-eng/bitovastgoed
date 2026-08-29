import { describe, expect, it } from 'vitest';

import {
  pasOffMarketDeepLinkToe,
  RADAR_FOLLOWUP_DEEP_LINK,
} from '@/lib/offMarket/acquisitie/radarFollowupDeepLink';

class MemoryStorage {
  private waarden = new Map<string, string>();
  setItem(key: string, value: string) { this.waarden.set(key, value); }
  getItem(key: string) { return this.waarden.get(key) ?? null; }
}

describe('Radar-opvolg deep-link', () => {
  it('zet de melding om naar Acquisitieselectie > Actie > Opvolgen met oudste opvolgdatum eerst', () => {
    const storage = new MemoryStorage();
    const search = RADAR_FOLLOWUP_DEEP_LINK.slice(RADAR_FOLLOWUP_DEEP_LINK.indexOf('?'));

    expect(pasOffMarketDeepLinkToe(search, storage)).toBe(true);
    expect(storage.getItem('off-market-filter:tab')).toBe('acquisitieselectie');
    expect(storage.getItem('off-market-acq:werkbak')).toBe('actie');
    expect(storage.getItem('off-market-acq:subfilter')).toBe('opvolgen');
    expect(storage.getItem('off-market-acq:bron')).toBe('radar');
    expect(storage.getItem('off-market-acq:sortering')).toBe('opvolgdatum_oudste');
  });

  it('negeert ongeldige deep-linkwaarden', () => {
    const storage = new MemoryStorage();
    expect(pasOffMarketDeepLinkToe('?tab=onbekend&werkbak=fout&sortering=kapot', storage)).toBe(false);
    expect(storage.getItem('off-market-filter:tab')).toBeNull();
  });
});
