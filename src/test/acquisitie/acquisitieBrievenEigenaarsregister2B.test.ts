import { describe, expect, it } from 'vitest';
import { bouwAcquisitieBrievenReadModel } from '@/lib/acquisitieBrievenReadModel';
import type { AcquisitieDossierContext } from '@/lib/acquisitieDossierContext';

const dossier: AcquisitieDossierContext = {
  bronType: 'vastgoedkans',
  bronId: 'kans-1',
  objectId: null,
  adres: 'Singel 150-1, 1015 AG Amsterdam',
  plaats: 'Amsterdam',
  eigenaarRelatieId: null,
};

describe('BUILD 2.0B — Brieven vanuit Eigenaarsregister', () => {
  it('vereist geen CRM-relatie zodra een eigenaar bekend is', () => {
    const model = bouwAcquisitieBrievenReadModel(dossier, {
      eigenaarNaam: 'A.W. Enthoven',
      eigenaarRelatieId: null,
      geadresseerde: null,
      briefStatus: 'niet_gestart',
    });

    expect(model.eigenaarBekend).toBe(true);
    expect(model.relatieGekoppeld).toBe(false);
    expect(model.fase).toBe('geadresseerde_controleren');
    expect(model.primaireActie).toBe('Controleer naam en correspondentieadres');
    expect(model.magBriefVoorbereiden).toBe(true);
  });

  it('blijft eigenaarsonderzoek eisen als er nog geen eigenaar bekend is', () => {
    const model = bouwAcquisitieBrievenReadModel(dossier, {
      eigenaarNaam: null,
      eigenaarRelatieId: null,
      geadresseerde: null,
      briefStatus: 'niet_gestart',
    });

    expect(model.eigenaarBekend).toBe(false);
    expect(model.fase).toBe('eigenaar_nodig');
    expect(model.magBriefVoorbereiden).toBe(false);
  });

  it('houdt voorinvullen veilig en verzending expliciet', () => {
    const model = bouwAcquisitieBrievenReadModel(dossier, {
      eigenaarNaam: 'A.W. Enthoven',
      geadresseerde: 'A.W. Enthoven',
      briefStatus: 'niet_gestart',
    });

    expect(model.fase).toBe('brief_voorbereiden');
    expect(model.magVerzendingRegistreren).toBe(false);
    expect(model.veiligheidsmelding).toContain('Eigenaarsregister');
    expect(model.veiligheidsmelding).toContain('expliciete gebruikershandelingen');
  });
});
