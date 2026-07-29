import { describe, expect, it } from 'vitest';
import {
  buildGebiedsvoorkeurPayload,
  buildLocationKey,
  frequentieSignaal,
  gebiedspad,
  type GebiedsvoorkeurDraft,
} from '@/lib/acquisitie/gebiedsvoorkeuren';

function draft(patch: Partial<GebiedsvoorkeurDraft> = {}): GebiedsvoorkeurDraft {
  return {
    location_key: '',
    location_level: 'municipality',
    province_code: null,
    province_name: 'Zuid-Holland',
    municipality_code: 'GM0518',
    municipality_name: 'Den Haag',
    district_code: null,
    district_name: null,
    neighbourhood_code: null,
    neighbourhood_name: null,
    preference_status: 'expand',
    priority: 2,
    asset_type_codes: ['office', 'office'],
    strategy_codes: ['transform'],
    motivation: 'Meer transformatiekansen zoeken.',
    notes: null,
    source_type: 'manual',
    active: true,
    ...patch,
  };
}

describe('gebiedsvoorkeuren', () => {
  it('gebruikt de officiële CBS-code als stabiele locatie-identiteit', () => {
    expect(buildLocationKey({
      locationLevel: 'municipality',
      municipalityCode: 'GM0518',
      municipalityName: 'Den Haag',
    })).toBe('GM0518');
  });

  it('maakt voor handmatige gebieden zonder code een voorspelbare fallbackcode', () => {
    expect(buildLocationKey({
      locationLevel: 'neighbourhood',
      municipalityName: 'Den Haag',
      neighbourhoodName: 'Zeeheldenkwartier',
    })).toBe('neighbourhood:den haag:zeeheldenkwartier');
  });

  it('normaliseert arrays en bewaart de strategische keuze', () => {
    expect(buildGebiedsvoorkeurPayload(draft())).toMatchObject({
      location_key: 'GM0518',
      preference_status: 'expand',
      priority: 2,
      asset_type_codes: ['office'],
      strategy_codes: ['transform'],
      motivation: 'Meer transformatiekansen zoeken.',
    });
  });

  it('vereist een motivatie en een geldige prioriteit', () => {
    expect(() => buildGebiedsvoorkeurPayload(draft({ motivation: ' ' }))).toThrow(/waarom dit gebied/i);
    expect(() => buildGebiedsvoorkeurPayload(draft({ priority: 6 }))).toThrow(/tussen 1 en 5/i);
  });

  it('bouwt een leesbaar pad en classificeert alleen de frequentie, zonder voorkeur te kiezen', () => {
    expect(gebiedspad({
      location_level: 'neighbourhood',
      province_name: 'Zuid-Holland',
      municipality_name: 'Den Haag',
      district_name: 'Centrum',
      neighbourhood_name: 'Zeeheldenkwartier',
    })).toBe('Zuid-Holland › Den Haag › Centrum › Zeeheldenkwartier');
    expect(frequentieSignaal(2)).toBe('laag');
    expect(frequentieSignaal(3)).toBe('opvallend');
    expect(frequentieSignaal(10)).toBe('hoog');
  });
});
