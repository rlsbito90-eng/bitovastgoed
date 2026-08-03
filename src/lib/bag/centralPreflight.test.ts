import { describe, expect, it } from 'vitest';
import {
  beoordeelCentraleBagPreflight,
  VERPLICHTE_CENTRALE_BAG_CONTROLES,
  type CentraleBagPreflightInvoer,
} from './centralPreflight';

const SHADOW_REF = 'abcdefghijklmnopqrst';
const PRODUCTION_REF = 'ljudxyrqoifhfikueric';

function geldigeInvoer(
  overrides: Partial<CentraleBagPreflightInvoer> = {},
): CentraleBagPreflightInvoer {
  return {
    environment: 'shadow',
    projectRef: SHADOW_REF,
    expectedProjectRef: SHADOW_REF,
    productionProjectRefs: [PRODUCTION_REF],
    expectation: 'clean-shadow',
    scopeCode: null,
    checks: VERPLICHTE_CENTRALE_BAG_CONTROLES.map(name => ({
      name,
      passed: true,
      actual: 'ok',
      expected: 'ok',
    })),
    ...overrides,
  };
}

describe('beoordeelCentraleBagPreflight', () => {
  it('geeft alleen vrij wanneer identiteit en alle centrale controles groen zijn', () => {
    expect(beoordeelCentraleBagPreflight(geldigeInvoer())).toEqual({
      toegestaan: true,
      blokkades: [],
      ontbrekendeControles: [],
      gefaaldeControles: [],
    });
  });

  it('blokkeert productie, een afwijkende ref en een niet-shadow omgeving afzonderlijk', () => {
    const besluit = beoordeelCentraleBagPreflight(geldigeInvoer({
      environment: 'production',
      projectRef: PRODUCTION_REF,
    }));
    expect(besluit.toegestaan).toBe(false);
    expect(besluit.blokkades).toHaveLength(3);
  });

  it('faalt gesloten bij een ontbrekende of rode controle', () => {
    const checks = geldigeInvoer().checks.slice(1);
    const rodeNaam = checks[0].name;
    checks[0] = { ...checks[0], passed: false };
    const besluit = beoordeelCentraleBagPreflight(geldigeInvoer({ checks }));
    expect(besluit.toegestaan).toBe(false);
    expect(besluit.ontbrekendeControles).toContain('application_isolation');
    expect(besluit.gefaaldeControles).toContain(rodeNaam);
  });

  it('vereist voor active-dataset een begrensde scopesleutel', () => {
    const besluit = beoordeelCentraleBagPreflight(geldigeInvoer({
      expectation: 'active-dataset',
      scopeCode: null,
    }));
    expect(besluit.toegestaan).toBe(false);
    expect(besluit.blokkades).toContain('Active-dataset vereist een geldige scopesleutel.');
  });
});
