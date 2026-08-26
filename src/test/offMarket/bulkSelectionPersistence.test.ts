import { beforeEach, describe, expect, it } from 'vitest';
import {
  RADAR_BULK_SELECTIE_KEY,
  beperkRadarBulkSelectie,
  leesRadarBulkSelectie,
  schrijfRadarBulkSelectie,
  setsZijnGelijk,
} from '@/lib/offMarket/acquisitie/bulkSelectionPersistence';

describe('Radar bulkselectie persistentie', () => {
  beforeEach(() => window.sessionStorage.clear());

  it('bewaart en herstelt dezelfde selectie binnen de browsersessie', () => {
    schrijfRadarBulkSelectie(['a', 'b', 'a']);
    expect([...leesRadarBulkSelectie()].sort()).toEqual(['a', 'b']);
  });

  it('verwijdert storage wanneer de selectie leeg wordt', () => {
    window.sessionStorage.setItem(RADAR_BULK_SELECTIE_KEY, JSON.stringify(['a']));
    schrijfRadarBulkSelectie([]);
    expect(window.sessionStorage.getItem(RADAR_BULK_SELECTIE_KEY)).toBeNull();
  });

  it('gooit verdwenen dossiers uit een herstelde selectie', () => {
    expect([...beperkRadarBulkSelectie(['a', 'b', 'c'], ['a', 'c'])].sort()).toEqual(['a', 'c']);
  });

  it('vergelijkt sets onafhankelijk van volgorde', () => {
    expect(setsZijnGelijk(new Set(['a', 'b']), new Set(['b', 'a']))).toBe(true);
    expect(setsZijnGelijk(new Set(['a']), new Set(['b']))).toBe(false);
  });
});
