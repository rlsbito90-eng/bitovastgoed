import { describe, it, expect } from 'vitest';
import {
  buildGeoPatchFromPdok as buildPatch,
  formatGebiedsindeling, formatGemeenteBuurt, formatGeoStatus,
} from '@/lib/offMarket/geo';

describe('PDOK buildPatch', () => {
  it('mapt gemeente/wijk/buurt uit gemengde response', () => {
    const pdok = {
      response: {
        docs: [
          { type: 'gemeente', gemeentenaam: 'Amsterdam', gemeentecode: '0363' },
          { type: 'wijk', wijknaam: 'Centrum', wijkcode: '036301' },
          { type: 'buurt', buurtnaam: 'Grachtengordel-West', buurtcode: 'BU03630101',
            gemeentenaam: 'Amsterdam', gemeentecode: '0363' },
        ],
      },
    };
    const p = buildPatch(pdok);
    expect(p.hasAny).toBe(true);
    expect(p.geo_gemeente_naam).toBe('Amsterdam');
    expect(p.geo_gemeente_code).toBe('0363');
    expect(p.geo_wijk_naam).toBe('Centrum');
    expect(p.geo_wijk_code).toBe('036301');
    expect(p.geo_buurt_naam).toBe('Grachtengordel-West');
    expect(p.geo_buurt_code).toBe('BU03630101');
  });

  it('valt terug op gemeente/wijk uit buurt-doc als losse docs ontbreken', () => {
    const pdok = {
      response: { docs: [
        { type: 'buurt', buurtnaam: 'X', buurtcode: 'BUx',
          wijknaam: 'W', wijkcode: 'WK1', gemeentenaam: 'Utrecht', gemeentecode: '0344' },
      ] },
    };
    const p = buildPatch(pdok);
    expect(p.geo_gemeente_naam).toBe('Utrecht');
    expect(p.geo_wijk_naam).toBe('W');
    expect(p.geo_buurt_naam).toBe('X');
  });

  it('lege response → hasAny=false', () => {
    expect(buildPatch({ response: { docs: [] } }).hasAny).toBe(false);
    expect(buildPatch({}).hasAny).toBe(false);
  });
});

describe('format helpers', () => {
  it('formatGebiedsindeling verrijkt → joined', () => {
    expect(formatGebiedsindeling({
      geo_status: 'verrijkt', geo_gemeente_naam: 'Amsterdam',
      geo_wijk_naam: 'Centrum', geo_buurt_naam: 'Grachtengordel-West',
    })).toBe('Amsterdam · Centrum · Grachtengordel-West');
  });
  it('geen coördinaten → duidelijke melding', () => {
    expect(formatGebiedsindeling({ geo_status: 'geen_coordinaten' }))
      .toBe('Wijk/buurt: geen coördinaten');
  });
  it('niet verrijkt → fallback', () => {
    expect(formatGebiedsindeling({ geo_status: 'niet_verrijkt' }))
      .toBe('Wijk/buurt: nog niet verrijkt');
  });
  it('formatGemeenteBuurt geeft null als niet verrijkt', () => {
    expect(formatGemeenteBuurt({ geo_status: 'niet_verrijkt' })).toBeNull();
  });
  it('formatGemeenteBuurt geeft gemeente · buurt', () => {
    expect(formatGemeenteBuurt({
      geo_status: 'verrijkt', geo_gemeente_naam: 'Amsterdam',
      geo_buurt_naam: 'Grachtengordel-West',
    })).toBe('Amsterdam · Grachtengordel-West');
  });
  it('formatGeoStatus default = niet verrijkt', () => {
    expect(formatGeoStatus(null)).toBe('Niet verrijkt');
    expect(formatGeoStatus('verrijkt')).toBe('Verrijkt');
  });
});
