import type {
  ProductiekernConcurrencyProefManifest,
  ProductiekernConcurrencyScenario,
} from './productiekernConcurrencyProefManifest';

export interface ProductiekernConcurrencyScenarioWaarneming {
  scenario: ProductiekernConcurrencyScenario;
  pogingen: number;
  uniekeResultaten: number;
  dubbeleNummers: number;
  optimisticLockConflicten: number;
  onverwachteFouten: readonly string[];
}

export interface ProductiekernConcurrencyProefWaarneming {
  manifestVersie: number;
  doelomgeving: string;
  schemaNaam: string;
  paralleliteit: number;
  transactieTeruggerold: boolean;
  productieBenaderd: boolean;
  scenarios: readonly ProductiekernConcurrencyScenarioWaarneming[];
}

export interface ProductiekernConcurrencyProefResultaat {
  geslaagd: boolean;
  blokkades: string[];
  productieMigratieToegestaan: false;
  productieActivatieToegestaan: false;
}

export function beoordeelProductiekernConcurrencyProef(
  manifest: ProductiekernConcurrencyProefManifest,
  waarneming: ProductiekernConcurrencyProefWaarneming,
): ProductiekernConcurrencyProefResultaat {
  const blokkades: string[] = [];

  if (waarneming.manifestVersie !== manifest.versie) blokkades.push('Manifestversie wijkt af.');
  if (waarneming.doelomgeving !== manifest.doelomgeving) blokkades.push('Doelomgeving wijkt af.');
  if (waarneming.schemaNaam !== manifest.schemaNaam) blokkades.push('Proefschema wijkt af.');
  if (waarneming.paralleliteit !== manifest.paralleliteit) blokkades.push('Paralleliteit wijkt af.');
  if (!waarneming.transactieTeruggerold) blokkades.push('Proeftransactie is niet teruggerold.');
  if (waarneming.productieBenaderd) blokkades.push('Concurrencyproef heeft productie benaderd.');

  const waargenomen = new Map(waarneming.scenarios.map((item) => [item.scenario, item]));
  for (const scenario of manifest.scenarios) {
    const item = waargenomen.get(scenario);
    if (!item) {
      blokkades.push(`Scenario ontbreekt: ${scenario}.`);
      continue;
    }
    if (item.pogingen !== manifest.paralleliteit) {
      blokkades.push(`Scenario ${scenario} heeft niet exact de vereiste pogingen.`);
    }
    if (item.dubbeleNummers > 0) {
      blokkades.push(`Scenario ${scenario} produceerde dubbele nummers.`);
    }
    const onverwachteFouten = Array.isArray(item.onverwachteFouten)
      ? item.onverwachteFouten
      : ['Waarneming bevat geen geldige foutenlijst.'];
    if (onverwachteFouten.length > 0) {
      blokkades.push(`Scenario ${scenario} rapporteerde fouten: ${onverwachteFouten.join(' | ')}`);
    }
    if (scenario.includes('nummer_parallel_reserveren') && item.uniekeResultaten !== item.pogingen) {
      blokkades.push(`Scenario ${scenario} leverde geen uniek resultaat per poging.`);
    }
  }
  if (waarneming.scenarios.length !== manifest.scenarios.length) {
    blokkades.push('Aantal waargenomen scenarios wijkt af van het manifest.');
  }

  return {
    geslaagd: blokkades.length === 0,
    blokkades,
    productieMigratieToegestaan: false,
    productieActivatieToegestaan: false,
  };
}
