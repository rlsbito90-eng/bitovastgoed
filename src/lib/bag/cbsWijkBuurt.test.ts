import { describe, expect, it } from 'vitest';
import {
  bouwCbsBuurtenItemsUrl,
  bouwCbsWijkenItemsUrl,
  valideerCbsBuurtFeature,
  valideerCbsWijkFeature,
  wijkcodeUitBuurtcode,
} from './cbsWijkBuurt';

describe('CBS wijk/buurt verrijkingscontract', () => {
  it('leidt de wijkcode deterministisch af uit numerieke en alfanumerieke CBS-buurtcodes', () => {
    expect(wijkcodeUitBuurtcode('BU03630102')).toBe('WK036301');
    expect(wijkcodeUitBuurtcode('BU0363AA01')).toBe('WK0363AA');
  });

  it('accepteert 2025 Amsterdam-buurten met numerieke of alfanumerieke gebiedsdelen', () => {
    expect(valideerCbsBuurtFeature({
      jaar: 2025,
      gemeentecode: 'GM0363',
      gemeentenaam: 'Amsterdam',
      buurtcode: 'BU0363AA01',
      buurtnaam: 'Voorbeeldbuurt',
    })).toEqual({
      bronjaar: 2025,
      gemeenteCode: 'GM0363',
      gemeenteNaam: 'Amsterdam',
      wijkCode: 'WK0363AA',
      buurtCode: 'BU0363AA01',
      buurtNaam: 'Voorbeeldbuurt',
    });
  });

  it('accepteert 2025 Amsterdam-wijken met numerieke of alfanumerieke gebiedsdelen', () => {
    expect(valideerCbsWijkFeature({
      jaar: 2025,
      gemeentecode: 'GM0363',
      gemeentenaam: 'Amsterdam',
      wijkcode: 'WK0363AA',
      wijknaam: 'Voorbeeldwijk',
    })).toEqual({
      bronjaar: 2025,
      gemeenteCode: 'GM0363',
      gemeenteNaam: 'Amsterdam',
      wijkCode: 'WK0363AA',
      wijkNaam: 'Voorbeeldwijk',
    });
  });

  it('weigert bronjaar-, scope- en code-drift', () => {
    expect(() => valideerCbsBuurtFeature({
      jaar: 2024,
      gemeentecode: 'GM0363',
      gemeentenaam: 'Amsterdam',
      buurtcode: 'BU0363AA01',
      buurtnaam: 'Voorbeeldbuurt',
    })).toThrow('Onverwacht CBS-bronjaar');

    expect(() => valideerCbsBuurtFeature({
      jaar: 2025,
      gemeentecode: 'GM0106',
      gemeentenaam: 'Assen',
      buurtcode: 'BU0106AA01',
      buurtnaam: 'Voorbeeldbuurt',
    })).toThrow('buiten de toegestane gemeente');

    expect(() => valideerCbsBuurtFeature({
      jaar: 2025,
      gemeentecode: 'GM0363',
      gemeentenaam: 'Amsterdam',
      buurtcode: 'BU0106AA01',
      buurtnaam: 'Voorbeeldbuurt',
    })).toThrow('inconsistent');

    expect(() => valideerCbsWijkFeature({
      jaar: 2025,
      gemeentecode: 'GM0363',
      gemeentenaam: 'Amsterdam',
      wijkcode: 'WK0106AA',
      wijknaam: 'Voorbeeldwijk',
    })).toThrow('inconsistent');

    expect(() => wijkcodeUitBuurtcode('BU0363-?01')).toThrow('Ongeldige CBS-buurtcode');
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
