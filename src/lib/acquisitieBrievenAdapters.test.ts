import { describe, expect, it } from 'vitest';
import {
  offMarketSignaalNaarBrievenReadModel,
  vastgoedkansNaarBrievenReadModel,
} from './acquisitieBrievenAdapters';

describe('acquisitieBrievenAdapters', () => {
  it('vertaalt een Vastgoedkans met camelCase velden', () => {
    const model = vastgoedkansNaarBrievenReadModel({
      id: 'kans-1',
      adres: 'Damrak 1',
      postcode: '1012 LG',
      plaats: 'Amsterdam',
      eigenaarRelatieId: 'relatie-1',
      eigenaarNaam: 'Voorbeeld Vastgoed B.V.',
      briefGeadresseerde: 'Directie Voorbeeld Vastgoed B.V.',
      briefStatus: 'klaar',
    });

    expect(model.dossier.bronType).toBe('vastgoedkans');
    expect(model.fase).toBe('verzending_registreren');
    expect(model.magVerzendingRegistreren).toBe(true);
  });

  it('vertaalt een Off-Market-signaal met snake_case velden', () => {
    const model = offMarketSignaalNaarBrievenReadModel({
      id: 'signaal-1',
      adres: 'Keizersgracht 100',
      postcode: '1015 CS',
      plaats: 'Amsterdam',
      eigenaar_relatie_id: 'relatie-2',
      eigenaar_naam: 'Gracht Beheer B.V.',
      brief_geadresseerde: 'Gracht Beheer B.V.',
      brief_status: 'verzonden',
      brief_verzonden_op: '2026-08-05',
      opvolgdatum: '2026-08-19',
      reactie_status: 'geen_reactie',
    });

    expect(model.dossier.bronType).toBe('off_market_signaal');
    expect(model.fase).toBe('opvolgen');
    expect(model.magOpvolgingRegistreren).toBe(true);
  });

  it('laat briefvoorbereiding toe voor een bekende eigenaar zonder CRM-relatie', () => {
    const model = vastgoedkansNaarBrievenReadModel({
      id: 'kans-2',
      adres: 'Wibautstraat 1',
      eigenaarNaam: 'Bekende eigenaar',
      briefGeadresseerde: 'Bekende eigenaar',
    });

    expect(model.fase).toBe('brief_voorbereiden');
    expect(model.relatieGekoppeld).toBe(false);
    expect(model.magBriefVoorbereiden).toBe(true);
  });
});
