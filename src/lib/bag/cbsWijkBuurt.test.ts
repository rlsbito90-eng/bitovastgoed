import { describe, expect, it } from 'vitest';
import {
  bouwCbsBuurtenItemsUrl,
  bouwCbsWijkenItemsUrl,
  valideerCbsBuurtFeature,
  valideerCbsWijkFeature,
  wijkcodeUitBuurtcode,
} from './cbsWijkBuurt';

describe('CBS wijk/buurt verrijkingscontract', () => {
  it('leidt de wijkcode deterministisch af uit de CBS-buurtcode', () => {
    expect(wijkcodeUitBuurtcode('BU03630102')).toBe('WK036301');
  });

  it('accepteert uitsluitend 2025 Amsterdam-buurten met consistente codes', () => {
    expect(valideerCbsBuurtFeature({
      jaar: 2025,
      gemeentecode: 'GM0363',
      gemeentenaam: 'Amsterdam',
      buurtcode: 'BU03630102',
      buurtnaam: 'Voorbeeldbuurt',
    })).toEqual({
      bronjaar: 2025,
      gemeenteCode: 'GM0363',
      gemeenteNaam: 'Amsterdam',
      wijkCode: 'WK036301',
      buurtCode: 'BU03630102',
      buurtNaam: 'Voorbeeldbuurt',
    });
  });

  it('accepteert uitsluitend 2025 Amsterdam-wijken met consistente codes', () => {
    expect(valideerCbsWijkFeature({
      jaar: 2025,
      gemeentecode: 'GM0363',
      gemeentenaam: 'Amsterdam',
      wijkcode: 'WK036301',
      wijknaam: 'Voorbeeldwijk',
    })).toEqual({
      bronjaar: 2025,
      gemeenteCode: 'GM0363',
      gemeenteNaam: 'Amsterdam',
      wijkCode: 'WK036301',
      wijkNaam: 'Voorbeeldwijk',
    });
  });

  it('weigert bronjaar-, scope- en code-drift', () => {
    expect(() => valideerCbsBuurtFeature({
      jaar: 2024,
      gemeentecode: 'GM0363',
      gemeentenaam: 'Amsterdam',
      buurtcode: 'BU03630102',
      buurtnaam: 'Voorbeeldbuurt',
    })).toThrow('Onverwacht CBS-bronjaar');

    expect(() => valideerCbsBuurtFeature({
      jaar: 2025,
      gemeentecode: 'GM0106',
      gemeentenaam: 'Assen',
      buurtcode: 'BU01060102',
      buurtnaam: 'Voorbeeldbuurt',
    })).toThrow('buiten de toegestane gemeente');

    expect(() => valideerCbsBuurtFeature({
      jaar: 2025,
      gemeentecode: 'GM0363',
      gemeentenaam: 'Amsterdam',
      buurtcode: 'BU01060102',
      buurtnaam: 'Voorbeeldbuurt',
    })).toThrow('inconsistent');

    expect(() => valideerCbsWijkFeature({
      jaar: 2025,
      gemeentecode: 'GM0363',
      gemeentenaam: 'Amsterdam',
      wijkcode: 'WK010601',
      wijknaam: 'Voorbeeldwijk',
    })).toThrow('inconsistent');
  });

  it('bouwt uitsluitend de vaste PDOK routes met begrensde bbox-paginering', () => {
    const params = { bbox: [4.7, 52.28, 5.02, 52.44] as [number, number, number, number], limit: 1000 };
    const buurten = bouwCbsBuurtenItemsUrl(params);
    const wijken = bouwCbsWijkenItemsUrl(params);
    expect(buurten).toContain('https://api.pdok.nl/cbs/wijken-en-buurten-2025/ogc/v1/collections/buurten/items?');
    expect(wijken).toContain('https://api.pdok.nl/cbs/wijken-en-buurten-2025/ogc/v1/collections/wijken/items?');
    expect(buurten).toContain('bbox=4.7%2C52.28%2C5.02%2C52.44');
    expect(buurten).toContain('limit=1000');
    expect(buurten).toContain('f=json');
  });
});
