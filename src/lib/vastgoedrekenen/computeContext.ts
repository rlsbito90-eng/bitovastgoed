import type { AcquisitionComponent } from './acquisition';
import type { ComputeContext } from './compute';
import type { PropertyAssumptionType } from './profiles';
import type {
  Component,
  Scenario,
  ScenarioCost,
  SellOffUnit,
  TaxSettings,
  WwsUnit,
} from './types';

export type ScenarioComputeContextInput = {
  scenario: Scenario;
  components?: Component[];
  acquisitionComponents?: AcquisitionComponent[];
  costs?: ScenarioCost[];
  wwsUnits?: WwsUnit[];
  strategyUnits?: SellOffUnit[];
  taxSettings?: TaxSettings | null;
  objectType: 'enkelvoudig' | 'mixed_use';
  objectArea?: number | null;
  objectWoz?: number | null;
  objectEnergyLabel?: string | null;
  objectBouwjaar?: number | null;
  propertyType?: PropertyAssumptionType;
};

/**
 * Bouwt de volledige invoer voor de centrale rekenkern.
 *
 * Deze helper kiest geen rekenpad en voert geen berekeningen uit. De bestaande
 * fallback van verkrijgingsdelen naar legacycomponenten blijft uitsluitend in
 * computeScenario() bepaald.
 */
export function buildScenarioComputeContext(
  input: ScenarioComputeContextInput,
): ComputeContext {
  return {
    scenario: input.scenario,
    components: [...(input.components ?? [])],
    acquisitionComponents: input.acquisitionComponents == null
      ? undefined
      : [...input.acquisitionComponents],
    costs: [...(input.costs ?? [])],
    wwsUnits: [...(input.wwsUnits ?? [])],
    strategyUnits: input.strategyUnits == null
      ? undefined
      : [...input.strategyUnits],
    taxSettings: input.taxSettings ?? null,
    objectType: input.objectType,
    objectArea: input.objectArea ?? null,
    objectWoz: input.objectWoz ?? null,
    objectEnergyLabel: input.objectEnergyLabel ?? null,
    objectBouwjaar: input.objectBouwjaar ?? null,
    propertyType: input.propertyType,
  };
}
