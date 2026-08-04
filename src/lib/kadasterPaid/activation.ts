import type { PaidProductCode } from './contracts';

export interface PaidActivationInput {
  environment: 'preview' | 'shadow' | 'production';
  requestedProducts: readonly PaidProductCode[];
  providerClientConfigured: boolean;
  providerSecretConfiguredServerSide: boolean;
  browserSecretExposureDetected: boolean;
  budgetStoreReady: boolean;
  costLedgerReady: boolean;
  approvalStoreReady: boolean;
  piiVaultReady: boolean;
  retentionPolicyReady: boolean;
  explicitOperationalAuthorizationId?: string | null;
}

export interface PaidActivationDecision {
  status: 'tranche_d_ready' | 'activation_blocked';
  reason: string;
  enabledProducts: readonly PaidProductCode[];
  providerCallsAllowed: boolean;
  purchasesAllowed: boolean;
  productionAllowed: false;
  browserSecretAllowed: false;
  requiresSeparateOperationalAuthorization: true;
}

export function evaluatePaidActivation(input: PaidActivationInput): PaidActivationDecision {
  const blocked = (reason: string): PaidActivationDecision => ({
    status: 'activation_blocked', reason, enabledProducts: [],
    providerCallsAllowed: false, purchasesAllowed: false,
    productionAllowed: false, browserSecretAllowed: false,
    requiresSeparateOperationalAuthorization: true,
  });

  if (input.environment === 'production') return blocked('productie_geblokkeerd');
  if (input.environment !== 'shadow') return blocked('uitsluitend_shadow_toegestaan');
  if (input.requestedProducts.length === 0) return blocked('geen_producten_aangevraagd');
  if (new Set(input.requestedProducts).size !== input.requestedProducts.length) return blocked('dubbele_producten');
  if (input.browserSecretExposureDetected) return blocked('browser_secret_exposure');
  if (!input.providerClientConfigured) return blocked('providerclient_ontbreekt');
  if (!input.providerSecretConfiguredServerSide) return blocked('server_secret_ontbreekt');
  if (!input.budgetStoreReady) return blocked('budgetopslag_niet_gereed');
  if (!input.costLedgerReady) return blocked('kostenledger_niet_gereed');
  if (!input.approvalStoreReady) return blocked('goedkeuringsopslag_niet_gereed');
  if (input.requestedProducts.includes('objectinformatie_rechten') && !input.piiVaultReady) {
    return blocked('pii_vault_niet_gereed');
  }
  if (!input.retentionPolicyReady) return blocked('retentiebeleid_niet_gereed');
  if (!input.explicitOperationalAuthorizationId?.trim()) return blocked('operationele_autorisatie_ontbreekt');

  return {
    status: 'tranche_d_ready', reason: 'shadow_activation_ready',
    enabledProducts: [...input.requestedProducts], providerCallsAllowed: true,
    purchasesAllowed: true, productionAllowed: false, browserSecretAllowed: false,
    requiresSeparateOperationalAuthorization: true,
  };
}
