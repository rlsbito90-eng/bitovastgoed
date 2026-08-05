import { describe, expect, it } from 'vitest';
import type { AcquisitieDossierContext } from './acquisitieDossierContext';
import { bouwAcquisitieKadasterReadModel } from './acquisitieKadasterReadModel';

const dossier: AcquisitieDossierContext = {
  bronType: 'vastgoedkans',
  bronId: 'kans-1',
  objectId: 'object-1',
  adres: 'Damrak 1, 1012 LG, Amsterdam',
  plaats: 'Amsterdam',
  eigenaarRelatieId: null,
};

describe('bouwAcquisitieKadasterReadModel', () => {
  it('begint met adrescontrole en blokkeert vervolgstappen', () => {
    const model = bouwAcquisitieKadasterReadModel(dossier, {});

    expect(model.fase).toBe('adres_controleren');
    expect(model.magKadasterVoorbereiden).toBe(false);
    expect(model.magEigenaarBeoordelen).toBe(false);
    expect(model.magOpvolgingStarten).toBe(false);
  });

  it('vraagt na adrescontrole eerst om BAG-context', () => {
    const model = bouwAcquisitieKadasterReadModel(dossier, {
      adresControleGeslaagd: true,
    });

    expect(model.fase).toBe('bag_context_controleren');
    expect(model.bagContextAanwezig).toBe(false);
  });

  it('staat handmatige Kadastervoorbereiding toe met geldige BAG-context', () => {
    const model = bouwAcquisitieKadasterReadModel(dossier, {
      adresControleGeslaagd: true,
      bagPandId: '0363100012345678',
    });

    expect(model.fase).toBe('kadaster_aanvragen');
    expect(model.magKadasterVoorbereiden).toBe(true);
    expect(model.veiligheidsmelding).toContain('geen automatische bestelling');
  });

  it('gaat na Kadasteronderzoek door naar beoordeling van de eigenaar', () => {
    const model = bouwAcquisitieKadasterReadModel(dossier, {
      adresControleGeslaagd: true,
      bagVerblijfsobjectId: '0363010000123456',
      kadasterStatus: 'gevonden',
      kadastraleAanduiding: 'Amsterdam A 1234',
    });

    expect(model.fase).toBe('eigenaar_beoordelen');
    expect(model.magEigenaarBeoordelen).toBe(true);
    expect(model.eigenaarBekend).toBe(false);
  });

  it('vereist een bewuste CRM-relatiekoppeling voordat opvolging start', () => {
    const zonderRelatie = bouwAcquisitieKadasterReadModel(dossier, {
      adresControleGeslaagd: true,
      bagPandId: '0363100012345678',
      kadasterStatus: 'gevonden',
      eigenaarNaam: 'Voorbeeld Vastgoed B.V.',
    });

    expect(zonderRelatie.fase).toBe('gereed_voor_opvolging');
    expect(zonderRelatie.primaireActie).toBe('Koppel of maak de CRM-relatie');
    expect(zonderRelatie.magOpvolgingStarten).toBe(false);

    const metRelatie = bouwAcquisitieKadasterReadModel(
      { ...dossier, eigenaarRelatieId: 'relatie-1' },
      {
        adresControleGeslaagd: true,
        bagPandId: '0363100012345678',
        kadasterStatus: 'gevonden',
      },
    );

    expect(metRelatie.primaireActie).toBe('Start brief of contactopvolging');
    expect(metRelatie.magOpvolgingStarten).toBe(true);
  });

  it('behandelt legacy niet-gestart statussen niet als uitgevoerd onderzoek', () => {
    const model = bouwAcquisitieKadasterReadModel(dossier, {
      adresControleGeslaagd: true,
      bagPandId: '0363100012345678',
      kadasterStatus: 'niet_gestart',
    });

    expect(model.kadasterOnderzoekAanwezig).toBe(false);
    expect(model.fase).toBe('kadaster_aanvragen');
  });
});
