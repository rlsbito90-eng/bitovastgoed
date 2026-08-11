import { describe, expect, it } from 'vitest';
import {
  bouwCbsBuurtenItemsUrl,
  valideerCbsBuurtFeature,
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
  });

  it('bouwt uitsluitend de vaste PDOK buurtenroute met begrensde bbox-paginering', () => {
    const url = bouwCbsBuurtenItemsUrl({
      bbox: [4.7, 52.28, 5.02, 52.44],
      limit: 1000,
    });
    expect(url).toContain('https://api.pdok.nl/cbs/wijken-en-buurten-2025/ogc/v1/collections/buurten/items?');
    expect(url).toContain('bbox=4.7%2C52.28%2C5.02%2C52.44');
    expect(url).toContain('limit=1000');
    expect(url).toContain('f=json');
  });
});
