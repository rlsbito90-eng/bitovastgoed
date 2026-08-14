import { describe, expect, it } from 'vitest';
import { bouwAcquisitieBrievenReadModel } from './acquisitieBrievenReadModel';
import { bepaalAcquisitieBrievenCommando } from './acquisitieBrievenCommando';

const dossier = {
  bronType: 'vastgoedkans' as const,
  bronId: 'kans-1',
  objectId: null,
  adres: 'Damrak 1, Amsterdam',
  plaats: 'Amsterdam',
  eigenaarRelatieId: null,
};

describe('bepaalAcquisitieBrievenCommando', () => {
  it('stuurt een bekende eigenaar zonder CRM-relatie naar geadresseerdecontrole', () => {
    const model = bouwAcquisitieBrievenReadModel(dossier, { eigenaarNaam: 'Eigenaar BV' });
    const commando = bepaalAcquisitieBrievenCommando(model);
    expect(commando.type).toBe('geadresseerde_controleren');
    expect(commando.toegestaan).toBe(true);
  });

  it('stuurt met relatie maar zonder adres eveneens naar geadresseerdecontrole', () => {
    const model = bouwAcquisitieBrievenReadModel(
      { ...dossier, eigenaarRelatieId: 'rel-1' },
      { eigenaarNaam: 'Eigenaar BV', eigenaarRelatieId: 'rel-1' },
    );
    expect(bepaalAcquisitieBrievenCommando(model).type).toBe('geadresseerde_controleren');
  });

  it('gebruikt de bestaande briefvoorbereiding wanneer de basis gereed is zonder verplichte relatie', () => {
    const model = bouwAcquisitieBrievenReadModel(
      dossier,
      { eigenaarNaam: 'Eigenaar BV', geadresseerde: 'Eigenaar BV, Straat 1' },
    );
    const commando = bepaalAcquisitieBrievenCommando(model);
    expect(commando.type).toBe('brief_voorbereiden');
    expect(commando.toegestaan).toBe(true);
  });

  it('registreert verzending uitsluitend na een voorbereid concept', () => {
    const model = bouwAcquisitieBrievenReadModel(
      dossier,
      { eigenaarNaam: 'Eigenaar BV', geadresseerde: 'Eigenaar BV', briefStatus: 'klaar' },
    );
    expect(bepaalAcquisitieBrievenCommando(model).type).toBe('verzending_registreren');
  });

  it('stuurt een geregistreerde reactie naar handmatige beoordeling', () => {
    const model = bouwAcquisitieBrievenReadModel(
      dossier,
      {
        eigenaarNaam: 'Eigenaar BV',
        geadresseerde: 'Eigenaar BV',
        briefStatus: 'reactie_ontvangen',
        reactieStatus: 'interesse',
      },
    );
    expect(bepaalAcquisitieBrievenCommando(model).type).toBe('respons_beoordelen');
  });
});
