import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { valideerPandZoekAanvraagV4, type BagPandZoekAanvraagV4 } from './queryService';

const basis: BagPandZoekAanvraagV4 = {
  scopeCode: '0363',
  naIdentificatie: null,
  limiet: 100,
  bouwjaarVan: null,
  bouwjaarTot: null,
  statussen: [],
  vboOppervlakteSomVan: null,
  vboOppervlakteSomTot: null,
  vboOppervlakteMaxVan: null,
  vboOppervlakteMaxTot: null,
  vboAantalVan: null,
  vboAantalTot: null,
  gebruiksdoelen: [],
  isGemengd: null,
  vboModus: 'alle',
  wijkCodes: [],
  buurtCodes: [],
};

describe('Pandenverkenner search_v4', () => {
  it('accepteert alfanumerieke Amsterdamse wijk- en buurtcodes', () => {
    const resultaat = valideerPandZoekAanvraagV4({
      ...basis,
      wijkCodes: ['WK0363AA'],
      buurtCodes: ['BU0363AA01'],
    });
    expect(resultaat).toEqual({ geldig: true, fouten: [] });
  });

  it('weigert gebiedscodes uit een andere scope', () => {
    const resultaat = valideerPandZoekAanvraagV4({
      ...basis,
      wijkCodes: ['WK0106AA'],
      buurtCodes: ['BU0106AA01'],
    });
    expect(resultaat.geldig).toBe(false);
    expect(resultaat.fouten.join(' ')).toContain('actieve BAG-scope');
  });

  it('bewaakt ruime maar begrensde gebiedsmultiselects', () => {
    const teVeelBuurten = Array.from({ length: 129 }, (_, index) => `BU0363${index.toString(36).toUpperCase().padStart(4, '0').slice(-4)}`);
    const resultaat = valideerPandZoekAanvraagV4({ ...basis, buurtCodes: teVeelBuurten });
    expect(resultaat.geldig).toBe(false);
    expect(resultaat.fouten.join(' ')).toContain('maximaal 128');
  });

  it('houdt v4 additief naast v3 en filtert wijk/buurt server-side', () => {
    const sql = readFileSync('experiments/bag/pandenverkenner-zoek-panden-v4.sql', 'utf8');
    expect(sql).toContain('CREATE OR REPLACE FUNCTION bag_service.zoek_panden_v4');
    expect(sql).toContain('i.wijk_code=ANY(p_wijk_codes)');
    expect(sql).toContain('i.buurt_code=ANY(p_buurt_codes)');
    expect(sql).toContain("WHERE i.scope_code=p_scope_code");
    expect(sql).toContain('v3 blijft ongewijzigd als fallback');
  });

  it('haalt gebiedsopties uitsluitend uit de actieve verrijkte index', () => {
    const sql = readFileSync('experiments/bag/pandenverkenner-gebiedsopties.sql', 'utf8');
    expect(sql).toContain('bag_service.cbs_gebiedsopties');
    expect(sql).toContain("b.status='actief'");
    expect(sql).toContain('b.cbs_gebiedsjaar IS NOT NULL');
    expect(sql).toContain('i.buurt_code IS NOT NULL');
  });
});
