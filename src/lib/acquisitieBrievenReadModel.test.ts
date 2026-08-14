import { describe, expect, it } from 'vitest';
import type { AcquisitieDossierContext } from './acquisitieDossierContext';
import { bouwAcquisitieBrievenReadModel } from './acquisitieBrievenReadModel';

const dossier: AcquisitieDossierContext = {
  bronType: 'vastgoedkans',
  bronId: 'kans-1',
  objectId: 'object-1',
  adres: 'Damrak 1, 1012 LG, Amsterdam',
  plaats: 'Amsterdam',
  eigenaarRelatieId: null,
};

describe('bouwAcquisitieBrievenReadModel', () => {
  it('blokkeert briefvoorbereiding zonder bekende eigenaar', () => {
    const model = bouwAcquisitieBrievenReadModel(dossier, {});

    expect(model.fase).toBe('eigenaar_nodig');
    expect(model.magBriefVoorbereiden).toBe(false);
  });

  it('vereist geen CRM-relatie wanneer de eigenaar al bekend is', () => {
    const model = bouwAcquisitieBrievenReadModel(dossier, {
      eigenaarNaam: 'Voorbeeld Vastgoed B.V.',
    });

    expect(model.fase).toBe('geadresseerde_controleren');
    expect(model.relatieGekoppeld).toBe(false);
    expect(model.primaireActie).toBe('Controleer naam en correspondentieadres');
    expect(model.magBriefVoorbereiden).toBe(true);
  });

  it('vraagt met bekende eigenaar eerst om controle van de geadresseerde', () => {
    const model = bouwAcquisitieBrievenReadModel(
      { ...dossier, eigenaarRelatieId: 'relatie-1' },
      { eigenaarNaam: 'Voorbeeld Vastgoed B.V.' },
    );

    expect(model.fase).toBe('geadresseerde_controleren');
    expect(model.magBriefVoorbereiden).toBe(true);
  });

  it('staat briefvoorbereiding toe met bekende geadresseerde, ook zonder verplichte CRM-relatie', () => {
    const model = bouwAcquisitieBrievenReadModel(
      dossier,
      { eigenaarNaam: 'Voorbeeld Vastgoed B.V.', geadresseerde: 'Voorbeeld Vastgoed B.V.' },
    );

    expect(model.fase).toBe('brief_voorbereiden');
    expect(model.magBriefVoorbereiden).toBe(true);
    expect(model.relatieGekoppeld).toBe(false);
    expect(model.veiligheidsmelding).toContain('Eigenaarsregister');
    expect(model.veiligheidsmelding).toContain('expliciete gebruikershandelingen');
  });

  it('gaat van voorbereid naar expliciete verzendregistratie', () => {
    const model = bouwAcquisitieBrievenReadModel(
      dossier,
      {
        eigenaarNaam: 'Voorbeeld Vastgoed B.V.',
        geadresseerde: 'Voorbeeld Vastgoed B.V.',
        briefStatus: 'klaar',
        briefKenmerk: 'BR-2026-001',
      },
    );

    expect(model.fase).toBe('verzending_registreren');
    expect(model.magVerzendingRegistreren).toBe(true);
  });

  it('plant opvolging na verzending en rondt af na een reactie', () => {
    const verzonden = bouwAcquisitieBrievenReadModel(
      dossier,
      {
        eigenaarNaam: 'Voorbeeld Vastgoed B.V.',
        geadresseerde: 'Voorbeeld Vastgoed B.V.',
        briefStatus: 'verzonden',
        briefVerzondenOp: '2026-08-05',
      },
    );

    expect(verzonden.fase).toBe('opvolgen');
    expect(verzonden.magOpvolgingRegistreren).toBe(true);

    const reactie = bouwAcquisitieBrievenReadModel(
      dossier,
      {
        eigenaarNaam: 'Voorbeeld Vastgoed B.V.',
        geadresseerde: 'Voorbeeld Vastgoed B.V.',
        briefStatus: 'reactie_ontvangen',
        reactieStatus: 'interesse',
      },
    );

    expect(reactie.fase).toBe('afgerond');
    expect(reactie.reactieOntvangen).toBe(true);
  });
});
