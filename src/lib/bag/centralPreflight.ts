export const VERPLICHTE_CENTRALE_BAG_CONTROLES = [
  'application_isolation',
  'dataset_state_invariant',
  'forced_rls',
  'function_contract',
  'index_contract',
  'intended_function_grants',
  'mode_dataset_gate',
  'policy_contract',
  'postgis_contract',
  'role_membership_contract',
  'safe_roles',
  'schema_contract',
  'service_function_hardening',
  'table_contract',
  'version_function_hardening',
] as const;

export type CentraleBagControleNaam = typeof VERPLICHTE_CENTRALE_BAG_CONTROLES[number];
export type CentraleBagPreflightVerwachting = 'clean-shadow' | 'active-dataset';

export interface CentraleBagControle {
  name: string;
  passed: boolean;
  actual: string;
  expected: string;
}

export interface CentraleBagPreflightInvoer {
  environment: string;
  projectRef: string;
  expectedProjectRef: string;
  productionProjectRefs: string[];
  expectation: CentraleBagPreflightVerwachting;
  scopeCode: string | null;
  checks: CentraleBagControle[];
}

export interface CentraleBagPreflightBesluit {
  toegestaan: boolean;
  blokkades: string[];
  ontbrekendeControles: CentraleBagControleNaam[];
  gefaaldeControles: CentraleBagControleNaam[];
}

export function beoordeelCentraleBagPreflight(
  invoer: CentraleBagPreflightInvoer,
): CentraleBagPreflightBesluit {
  const blokkades: string[] = [];
  const checks = new Map(invoer.checks.map(check => [check.name, check]));
  const ontbrekendeControles = VERPLICHTE_CENTRALE_BAG_CONTROLES
    .filter(name => !checks.has(name));
  const gefaaldeControles = VERPLICHTE_CENTRALE_BAG_CONTROLES
    .filter(name => checks.get(name)?.passed === false);

  if (invoer.environment !== 'shadow') {
    blokkades.push('De centrale BAG-preflight mag uitsluitend op shadow draaien.');
  }
  if (invoer.projectRef !== invoer.expectedProjectRef) {
    blokkades.push('Projectref wijkt af van de expliciet verwachte shadowref.');
  }
  if (invoer.productionProjectRefs.includes(invoer.projectRef)) {
    blokkades.push('Projectref staat op de productie-denylijst.');
  }
  if (invoer.expectation === 'active-dataset'
    && !invoer.scopeCode?.match(/^[A-Za-z0-9_-]{1,64}$/)) {
    blokkades.push('Active-dataset vereist een geldige scopesleutel.');
  }
  if (ontbrekendeControles.length) {
    blokkades.push(`Verplichte controles ontbreken: ${ontbrekendeControles.join(', ')}.`);
  }
  if (gefaaldeControles.length) {
    blokkades.push(`Centrale controles faalden: ${gefaaldeControles.join(', ')}.`);
  }

  return {
    toegestaan: blokkades.length === 0,
    blokkades,
    ontbrekendeControles,
    gefaaldeControles,
  };
}
