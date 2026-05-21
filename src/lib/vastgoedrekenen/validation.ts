// Validatie en waarschuwingen voor Vastgoedrekenen V1.
// Levert "Nog te controleren" lijst + aanname-waarschuwingen.

import type { Component, Scenario, ScenarioCost, WwsUnit } from './types';
import type { PropertyAssumptionType } from './profiles';

export type ValidationItem = {
  level: 'warning' | 'info' | 'blocker';
  message: string;
};

export type ValidationContext = {
  scenario: Scenario;
  components: Component[];
  costs: ScenarioCost[];
  wwsUnits: WwsUnit[];
  objectType: 'enkelvoudig' | 'mixed_use';
  propertyType: PropertyAssumptionType;
  hasWoz: boolean;
  hasEnergyLabel: boolean;
  hasBouwjaar: boolean;
  energyLabel?: string | null;
};

/** Lijst met dingen die de gebruiker nog moet controleren / aanvullen. */
export function buildNogTeControleren(c: ValidationContext): ValidationItem[] {
  const out: ValidationItem[] = [];
  const { scenario, components, wwsUnits, objectType } = c;

  const wooncomponenten = components.filter((x) => x.component_type === 'woning' || x.component_type === 'appartement');
  if (wooncomponenten.length > 0 && wwsUnits.length === 0) {
    out.push({ level: 'warning', message: `Er zijn ${wooncomponenten.length} wooncomponent(en) maar nog geen WWS-units. Voeg WWS-units toe of markeer WWS als niet relevant.` });
  }

  if (objectType === 'mixed_use' && scenario.ovb_mode !== 'per_component') {
    out.push({ level: 'warning', message: 'Mixed-use object zonder OVB-toerekening per component. Reken OVB per component voor een correcte berekening.' });
  }

  if (scenario.ovb_mode === 'per_component') {
    const zonderWaarde = components.filter((x) => !x.allocated_component_value && !x.surface_gbo);
    if (zonderWaarde.length > 0) {
      out.push({ level: 'blocker', message: `${zonderWaarde.length} component(en) zonder componentwaarde of m². OVB per component kan niet correct worden berekend.` });
    }
  }

  if (!components.some((x) => x.has_contract) && (scenario.current_monthly_rent ?? 0) > 0) {
    out.push({ level: 'info', message: 'Huurcontracten zijn niet bevestigd. Controleer ingangsdatum, looptijd en indexatie.' });
  }
  if (!c.hasEnergyLabel) out.push({ level: 'info', message: 'Energielabel ontbreekt — controleer label-C-compliance bij kantoor.' });
  if (!c.hasWoz) out.push({ level: 'info', message: 'WOZ-waarde ontbreekt — relevant voor OVB-grondslag en WWS-berekening.' });
  if (!c.hasBouwjaar) out.push({ level: 'info', message: 'Bouwjaar ontbreekt — relevant voor bouwkundige risico-inschatting.' });

  if (!scenario.cost_structure || scenario.cost_structure === 'onbekend') {
    out.push({ level: 'info', message: 'Kostenstructuur/servicekosten onbekend. Controleer wie welke kosten draagt voor leegstandsrisico en NOI.' });
  }
  if (!scenario.contract_checked) out.push({ level: 'info', message: 'Contractduur niet gecontroleerd.' });
  if (!scenario.service_costs_checked) out.push({ level: 'info', message: 'Servicekosten niet gecontroleerd.' });
  if (scenario.mjop_present === 'onbekend' || !scenario.mjop_present) {
    out.push({ level: 'info', message: 'MJOP-status onbekend. Bij ontbreken: gebruik minimaal conservatief profiel.' });
  }
  if (scenario.assumptions_manual && !scenario.assumptions_source) {
    out.push({ level: 'warning', message: 'Aannames zijn handmatig aangepast zonder onderbouwing. Leg de bron vast.' });
  }

  if (scenario.strategy_type === 'transformeren' && c.costs.length === 0) {
    out.push({ level: 'warning', message: 'Transformatiescenario zonder transformatiekosten. Voeg bouwkosten, vergunningskosten en fasering toe.' });
  }

  return out;
}

/** Aanname-waarschuwingen volgens §15. */
export function buildAannameWaarschuwingen(c: ValidationContext, totalCorrectionPct: number): ValidationItem[] {
  const out: ValidationItem[] = [];
  const { scenario, propertyType } = c;
  const isCommercieel = propertyType === 'retail' || propertyType === 'kantoor' || propertyType === 'mixed_use' || propertyType === 'bedrijfsruimte';

  if (propertyType === 'residentieel' && totalCorrectionPct < 20) {
    out.push({ level: 'warning', message: 'Totale NOI-correctie is < 20% bij residentieel. Controleer of onderhoud, beheer, leegstand en overige lasten volledig zijn meegenomen.' });
  }
  if (isCommercieel && totalCorrectionPct < 30) {
    out.push({ level: 'warning', message: 'NOI-correctie lijkt laag voor dit objecttype. Controleer leegstand, onderhoud, beheer, incentives en servicekosten.' });
  }
  if (propertyType !== 'residentieel' && Number(scenario.vacancy_percentage ?? 0) < 2) {
    out.push({ level: 'warning', message: 'Leegstand < 2% bij niet-woningen is alleen realistisch bij zeer sterke huurcontracten of sale-and-leaseback-achtige situaties.' });
  }
  if (propertyType === 'residentieel' && Number(scenario.management_cost_percentage ?? 0) < 5) {
    out.push({ level: 'info', message: 'Beheer < 5% bij residentieel is alleen realistisch bij eigen beheer of grote portefeuilles.' });
  }
  if (propertyType === 'kantoor' && c.energyLabel && /^[D-G]/i.test(c.energyLabel)) {
    out.push({ level: 'warning', message: `Energielabel ${c.energyLabel} bij kantoor — controleer label-C-compliance en capex-risico.` });
  }
  if ((propertyType === 'retail' || propertyType === 'kantoor') && !scenario.incentive_reserve) {
    out.push({ level: 'info', message: 'Geen incentive-/overig-reserve ingesteld. Controleer huurvrije periodes, wederverhuurrisico en incentives.' });
  }
  if (scenario.mjop_present !== 'ja') {
    out.push({ level: 'info', message: 'Geen MJOP/bouwkundige onderbouwing — gebruik minimaal conservatief profiel.' });
  }
  if (scenario.assumption_profile === 'handmatig') {
    out.push({ level: 'info', message: 'Handmatige aannames in gebruik. Leg de onderbouwing vast.' });
  }
  if (isCommercieel && (!scenario.cost_structure || scenario.cost_structure === 'onbekend')) {
    out.push({ level: 'warning', message: 'Kostenstructuur onbekend bij commercieel vastgoed. Gebruik conservatief profiel totdat huurcontracten zijn gecontroleerd.' });
  }
  if (totalCorrectionPct > 60) {
    out.push({ level: 'warning', message: `NOI-correctie zeer hoog (${totalCorrectionPct.toFixed(1)}%). Controleer of kosten niet dubbel zijn meegenomen.` });
  }
  return out;
}
