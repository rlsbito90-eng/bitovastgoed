import { describe, expect, it } from 'vitest';
import {
  BAG_EXTRACT_MAPPINGPUNTEN,
  OFFICIEEL_BAG_EXTRACT_BRONCONTRACT,
  magProductieAdapterBouwen,
  openMappingpunten,
} from './officieelExtractContract';

describe('officieel BAG Extract broncontract', () => {
  it('legt alle zeven BAG-objecttypen vast', () => {
    expect(OFFICIEEL_BAG_EXTRACT_BRONCONTRACT.objecttypen).toEqual([
      'pand',
      'verblijfsobject',
      'nummeraanduiding',
      'openbare_ruimte',
      'woonplaats',
      'standplaats',
      'ligplaats',
    ]);
  });

  it('legt IMBAG- en koppelvlakversie expliciet vast', () => {
    expect(OFFICIEEL_BAG_EXTRACT_BRONCONTRACT.imbagVersie).toBe('v20180601');
    expect(OFFICIEEL_BAG_EXTRACT_BRONCONTRACT.koppelvlakVersie).toBe('1.9');
  });

  it('blokkeert een productieadapter zolang XSD- en proefbestandspunten openstaan', () => {
    expect(magProductieAdapterBouwen(BAG_EXTRACT_MAPPINGPUNTEN)).toBe(false);
    expect(openMappingpunten(BAG_EXTRACT_MAPPINGPUNTEN).map((punt) => punt.sleutel)).toEqual([
      'exacte_namespace_uris',
      'exacte_xml_paden',
      'zip_en_bestandsnamen',
      'gml_geometrievarianten',
    ]);
  });

  it('staat implementatie pas toe wanneer ieder mappingpunt bevestigd is', () => {
    const bevestigd = BAG_EXTRACT_MAPPINGPUNTEN.map((punt) => ({
      ...punt,
      zekerheid: 'bevestigd' as const,
    }));

    expect(magProductieAdapterBouwen(bevestigd)).toBe(true);
    expect(openMappingpunten(bevestigd)).toEqual([]);
  });
});
