import { describe, expect, it } from 'vitest';
import {
  BAG_ASSEN_INSPECTIE_2021,
  BAG_BESTANDSFAMILIES,
  BAG_EXTRACT_MAPPING_VERSIE,
  BAG_NAMESPACE_MAPPING,
  BAG_OBJECTTYPEN,
  valideerOfficieleBagMapping,
} from './officieleExtractMapping';

describe('officiële BAG Extract-mapping', () => {
  it('legt IMBAG v20200601 en GML 3.2 vast', () => {
    expect(BAG_EXTRACT_MAPPING_VERSIE).toBe('v20200601');
    expect(BAG_NAMESPACE_MAPPING.gml).toBe('http://www.opengis.net/gml/3.2');
    expect(BAG_NAMESPACE_MAPPING.objecten).toContain('/v20200601');
  });

  it('bevat alle zeven BAG-objecttypen', () => {
    expect(BAG_OBJECTTYPEN).toEqual([
      'Ligplaats',
      'Nummeraanduiding',
      'OpenbareRuimte',
      'Pand',
      'Standplaats',
      'Verblijfsobject',
      'Woonplaats',
    ]);
  });

  it('onderscheidt actief, in onderzoek, inactief en niet-BAG', () => {
    expect(BAG_BESTANDSFAMILIES.actief).toContain('PND');
    expect(BAG_BESTANDSFAMILIES.inOnderzoek).toContain('IOPND');
    expect(BAG_BESTANDSFAMILIES.inactief).toContain('IAPND');
    expect(BAG_BESTANDSFAMILIES.nietBag).toContain('NBPND');
  });

  it('legt de volledige officiële Assen-inspectie vast', () => {
    expect(BAG_ASSEN_INSPECTIE_2021).toMatchObject({
      xsdBestanden: 18,
      xmlBestanden: 45,
      genesteZipBestanden: 33,
      totaalUitgepakteBestanden: 96,
    });
    expect(BAG_ASSEN_INSPECTIE_2021.objectTellingen.Pand).toBe(66_904);
    expect(BAG_ASSEN_INSPECTIE_2021.objectTellingen.Verblijfsobject).toBe(55_436);
    expect(BAG_ASSEN_INSPECTIE_2021.objectTellingen.Nummeraanduiding).toBe(44_524);
  });

  it('valideert zonder open fouten', () => {
    expect(valideerOfficieleBagMapping()).toEqual([]);
  });
});
