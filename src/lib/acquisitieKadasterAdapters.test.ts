import { describe, expect, it } from 'vitest';
import {
  offMarketSignaalNaarKadasterReadModel,
  vastgoedkansNaarKadasterReadModel,
} from './acquisitieKadasterAdapters';

describe('acquisitieKadasterAdapters', () => {
  it('bouwt voor Vastgoedkansen een read-model uit camelCase velden', () => {
    const model = vastgoedkansNaarKadasterReadModel({
      id: 'kans-1',
      adres: 'Damrak 1',
      postcode: '1012 LG',
      plaats: 'Amsterdam',
      adresControleGeslaagd: true,
      bagPandId: '0363100012345678',
      kadasterStatus: 'gegevens_bekend',
      kadastraleAanduiding: 'Amsterdam A 1234',
      eigenaarNaam: 'Voorbeeld Vastgoed B.V.',
      eigenaarRelatieId: 'relatie-1',
    });

    expect(model.dossier.bronType).toBe('vastgoedkans');
    expect(model.dossier.adres).toContain('Damrak 1');
    expect(model.fase).toBe('gereed_voor_opvolging');
    expect(model.magOpvolgingStarten).toBe(true);
  });

  it('normaliseert Off-Market snake_case BAG- en eigenaarvelden', () => {
    const model = offMarketSignaalNaarKadasterReadModel({
      id: 'signaal-1',
      adres: 'Kalverstraat 10',
      postcode: '1012 PC',
      plaats: 'Amsterdam',
      adres_controle_geslaagd: true,
      bag_geselecteerd_pand_id: '0363100098765432',
      kadaster_status: 'gevonden',
      eigenaar_naam: 'Kalverstraat Beheer B.V.',
      eigenaar_relatie_id: null,
    });

    expect(model.dossier.bronType).toBe('off_market_signaal');
    expect(model.bagContextAanwezig).toBe(true);
    expect(model.eigenaarBekend).toBe(true);
    expect(model.eigenaarRelatieGekoppeld).toBe(false);
    expect(model.primaireActie).toBe('Koppel of maak de CRM-relatie');
  });

  it('laat ontbrekende adresbevestiging niet impliciet slagen', () => {
    const model = vastgoedkansNaarKadasterReadModel({
      id: 'kans-2',
      adres: 'Nieuwezijds Voorburgwal 1',
      bagPandId: '0363100011111111',
    });

    expect(model.fase).toBe('adres_controleren');
    expect(model.magKadasterVoorbereiden).toBe(false);
  });
});
