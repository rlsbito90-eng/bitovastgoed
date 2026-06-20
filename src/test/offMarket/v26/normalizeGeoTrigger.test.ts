// V2.6 — Normalize-ruw GEO-trigger: cap, cron-secret, achtergrond-await, geen merges,
// en geen verwijzingen naar BAG of Kadaster.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../../../..');
function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

describe('V2.6 — normalize-ruw GEO-trigger', () => {
  const src = read('supabase/functions/off-market-normalize-ruw/index.ts');

  it('importeert GEO_TRIGGER_CAP_PER_RUN uit gedeelde helper', () => {
    expect(src).toMatch(/GEO_TRIGGER_CAP_PER_RUN/);
    expect(src).toMatch(/_shared\/offMarketGeocode/);
  });

  it('definieert planGeoTrigger met cap, cron-secret en {data,error}-inspectie', () => {
    expect(src).toMatch(/function planGeoTrigger/);
    expect(src).toMatch(/geoGetriggerd\s*>=\s*GEO_TRIGGER_CAP_PER_RUN/);
    expect(src).toMatch(/x-cron-secret/);
    expect(src).toMatch(/off-market-geo-verrijk/);
    expect(src).toMatch(/GEO auto-trigger invoke-fout/);
  });

  it('roept planGeoTrigger alleen aan op het nieuw-insert-pad, niet bij merge', () => {
    // Merge-blok eindigt met `continue;` vóór de insert-flow.
    const mergeBlok = src.match(/merge_reden: 'dedupe-match'[\s\S]*?continue;/);
    expect(mergeBlok).not.toBeNull();
    expect(mergeBlok![0]).not.toMatch(/planGeoTrigger/);
    // Race-merge ook continue zonder trigger.
    const raceBlok = src.match(/merge_reden: 'race-dedupe'[\s\S]*?continue;/);
    expect(raceBlok).not.toBeNull();
    expect(raceBlok![0]).not.toMatch(/planGeoTrigger/);
  });

  it('voegt geo_getriggerd en geo_trigger_cap toe aan response', () => {
    expect(src).toMatch(/geo_getriggerd:\s*geoGetriggerd/);
    expect(src).toMatch(/geo_trigger_cap:\s*GEO_TRIGGER_CAP_PER_RUN/);
  });

  it('gebruikt EdgeRuntime.waitUntil voor achtergrond-invocations', () => {
    expect(src).toMatch(/EdgeRuntime\.waitUntil/);
    expect(src).toMatch(/geoTriggerTaken/);
  });
});

describe('V2.6 — geo-verrijk function', () => {
  const src = read('supabase/functions/off-market-geo-verrijk/index.ts');

  it('accepteert x-cron-secret naast bestaande Bearer-auth', () => {
    expect(src).toMatch(/OFF_MARKET_CRON_SECRET/);
    expect(src).toMatch(/x-cron-secret/);
    expect(src).toMatch(/isCronCall/);
    // CORS header opgenomen
    expect(src).toMatch(/Access-Control-Allow-Headers[\s\S]*x-cron-secret/);
  });

  it('batchquery selecteert ook signalen zonder lat/lng', () => {
    // Geen .not(\'lat\', ... ).not(\'lng\', ...) meer in de batch-selectie.
    expect(src).not.toMatch(/\.not\(['"]lat['"],\s*['"]is['"],\s*null\)/);
  });

  it('importeert ensureCoords uit gedeelde geocode-helper', () => {
    expect(src).toMatch(/ensureCoords/);
    expect(src).toMatch(/_shared\/offMarketGeocode/);
  });

  it('zet juiste statussen voor de drie ensureCoords-uitkomsten', () => {
    expect(src).toMatch(/geo_status:\s*['"]geen_coordinaten['"]/);
    expect(src).toMatch(/geo_status:\s*['"]geen_match['"]/);
    expect(src).toMatch(/geo_status:\s*['"]fout['"]/);
    expect(src).toMatch(/geo_status:\s*['"]verrijkt['"]/);
  });
});

describe('V2.6 — geen BAG of Kadaster in nieuwe geo-flow', () => {
  for (const rel of [
    'supabase/functions/_shared/offMarketGeocode.ts',
    'supabase/functions/off-market-geo-verrijk/index.ts',
  ]) {
    it(`${rel} bevat geen BAG- of Kadaster-verwijzingen`, () => {
      const src = read(rel);
      expect(src).not.toMatch(/off-market-bag-verrijk/);
      expect(src).not.toMatch(/off-market-kadaster-check/);
      expect(src).not.toMatch(/kadaster-objectinformatie/);
      expect(src).not.toMatch(/api\.kadaster\.nl/i);
      expect(src).not.toMatch(/KADASTER_OBJECTINFORMATIE_API_KEY/);
    });
  }
});
