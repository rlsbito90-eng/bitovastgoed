import { describe, expect, it } from 'vitest';
import { evaluatePaidActivation } from './activation';

const ready = {
  environment: 'shadow' as const,
  requestedProducts: ['objectinformatie_koopsom'] as const,
  providerClientConfigured: true,
  providerSecretConfiguredServerSide: true,
  browserSecretExposureDetected: false,
  budgetStoreReady: true,
  costLedgerReady: true,
  approvalStoreReady: true,
  piiVaultReady: false,
  retentionPolicyReady: true,
  explicitOperationalAuthorizationId: 'auth-1',
};

describe('Tranche D operationele activatiepoort', () => {
  it('verklaart een volledig voorbereide shadowactivatie gereed', () => {
    expect(evaluatePaidActivation(ready)).toMatchObject({
      status: 'tranche_d_ready', providerCallsAllowed: true,
      purchasesAllowed: true, productionAllowed: false, browserSecretAllowed: false,
    });
  });

  it('blokkeert productie en preview', () => {
    expect(evaluatePaidActivation({ ...ready, environment: 'production' })).toMatchObject({ reason: 'productie_geblokkeerd' });
    expect(evaluatePaidActivation({ ...ready, environment: 'preview' })).toMatchObject({ reason: 'uitsluitend_shadow_toegestaan' });
  });

  it('blokkeert secrets in de browser', () => {
    expect(evaluatePaidActivation({ ...ready, browserSecretExposureDetected: true })).toMatchObject({
      reason: 'browser_secret_exposure', purchasesAllowed: false,
    });
  });

  it('vereist alle persistente controles en expliciete autorisatie', () => {
    expect(evaluatePaidActivation({ ...ready, costLedgerReady: false })).toMatchObject({ reason: 'kostenledger_niet_gereed' });
    expect(evaluatePaidActivation({ ...ready, explicitOperationalAuthorizationId: null })).toMatchObject({
      reason: 'operationele_autorisatie_ontbreekt',
    });
  });

  it('vereist een PII-vault voor Rechten', () => {
    expect(evaluatePaidActivation({
      ...ready,
      requestedProducts: ['objectinformatie_rechten'],
      piiVaultReady: false,
    })).toMatchObject({ reason: 'pii_vault_niet_gereed' });
  });
});
