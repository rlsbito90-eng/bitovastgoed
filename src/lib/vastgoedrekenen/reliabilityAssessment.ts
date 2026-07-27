import type { Component, Scenario, ScenarioCost, SellOffUnit, WwsUnit } from './types';
import { aggregateStrategy } from './componentStrategy';
import { getEffectiveWwsMode } from './wws/mode';
import { SALE_FOCUSED_SALE_STRATEGIES, SALE_FOCUSED_STRATEGIES } from './verkoop';

export type ReliabilityLevel = 'laag' | 'middel' | 'hoog';
export type ReliabilityPillarStatus = 'voldoende' | 'aandacht' | 'ontbreekt' | 'niet_relevant';

export type ReliabilityPillar = {
  key: 'opbrengst' | 'rendement' | 'kosten' | 'fiscaliteit' | 'componenten' | 'wws' | 'aannames';
  label: string;
  status: ReliabilityPillarStatus;
  current: string;
  needed: string;
  core: boolean;
  sectionId: string;
  targetId?: string;
  actionLabel?: string;
};

export type ReliabilityAssessment = {
  level: ReliabilityLevel;
  title: string;
  summary: string;
  pillars: ReliabilityPillar[];
  sufficientCount: number;
  relevantCount: number;
};

export type ReliabilityAssessmentInput = {
  scenario: Scenario;
  components: Component[];
  costs: ScenarioCost[];
  wwsUnits: WwsUnit[];
  strategyUnits: SellOffUnit[];
  objectType: 'enkelvoudig' | 'mixed_use';
  correctedAnnualRent: number;
  saleHasInput: boolean;
  ovbMissingBasisCount: number;
};

const DEVELOPMENT_SCENARIOS = new Set([
  'transformeren',
  'splitsen',
  'uitponden',
  'renoveren_verhuren',
  'buy_fix_sell',
  'buy_fix_hold',
  'buy_split_sell',
  'buy_transform_sell',
  'buy_transform_hold',
  'herontwikkeling',
]);

const n = (value: unknown): number => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

function assessmentType(scenario: Scenario): 'exploitatie' | 'verkoop' {
  const rec = scenario as unknown as Record<string, unknown>;
  const saleStrategy = typeof rec.sale_strategy === 'string' ? rec.sale_strategy : null;
  const bidBasis = typeof rec.bid_basis === 'string' ? rec.bid_basis : null;
  if (bidBasis === 'verkoop') return 'verkoop';
  if (saleStrategy && saleStrategy !== 'geen_verkoop' && SALE_FOCUSED_SALE_STRATEGIES.has(saleStrategy)) return 'verkoop';
  if (SALE_FOCUSED_STRATEGIES.has(String(scenario.strategy_type))) return 'verkoop';
  return 'exploitatie';
}

function targetPresent(scenario: Scenario, type: 'exploitatie' | 'verkoop'): boolean {
  if (type === 'exploitatie') return n(scenario.target_bar) > 0;
  const rec = scenario as unknown as Record<string, unknown>;
  return n(rec.sale_target_margin_amount) > 0
    || n(rec.sale_target_margin_percentage) > 0
    || n(rec.sale_target_roi_percentage) > 0
    || n(rec.sale_target_exit_value) > 0;
}

function positiveCostRows(costs: ScenarioCost[]): ScenarioCost[] {
  return costs.filter((cost) => n(cost.amount) > 0 || n((cost as unknown as Record<string, unknown>).amount_per_m2) > 0);
}

function costName(cost: ScenarioCost): string {
  return cost.description?.trim() || cost.cost_category?.trim() || 'Naamloze kostenpost';
}

export function assessInputReliability(input: ReliabilityAssessmentInput): ReliabilityAssessment {
  const { scenario, components, costs, wwsUnits, strategyUnits, objectType } = input;
  const type = assessmentType(scenario);
  const strategy = aggregateStrategy(strategyUnits);
  const rec = scenario as unknown as Record<string, unknown>;
  const strategyType = String(scenario.strategy_type ?? '');
  const developmentRelevant = DEVELOPMENT_SCENARIOS.has(strategyType)
    || strategy.componentDevelopmentCosts > 0
    || strategy.perUnit.some((unit) => unit.extraInvestmentCosts > 0);
  const generalCosts = positiveCostRows(costs);
  const costsNotHigh = generalCosts.filter((cost) => cost.reliability_status !== 'hoog');
  const assumptionsSource = String(scenario.assumptions_source ?? '').trim();
  const assumptionsReliability = String(scenario.assumptions_reliability ?? 'middel');
  const pillars: ReliabilityPillar[] = [];

  const hasTerminalValue = strategy.grossDevelopmentValue > 0 || input.saleHasInput;
  pillars.push(type === 'verkoop'
    ? {
        key: 'opbrengst',
        label: 'Opbrengst / exitwaarde',
        status: hasTerminalValue ? 'voldoende' : 'ontbreekt',
        current: hasTerminalValue
          ? (strategy.grossDevelopmentValue > 0 ? `Componentstrategie bevat een opbrengstwaarde van € ${Math.round(strategy.grossDevelopmentValue).toLocaleString('nl-NL')}.` : 'Verkoop-/exitwaarde is aanwezig.')
          : 'Er is geen bruikbare verkoop- of exitwaarde.',
        needed: hasTerminalValue ? 'Geen ontbrekende kerninvoer.' : 'Vul een verkoopwaarde in of leg per component een verkoop-/aanhoudstrategie met waarde vast.',
        core: true,
        sectionId: strategy.enabled ? 'sec-strategie' : 'sec-verkoop',
        actionLabel: strategy.enabled ? 'Open componentstrategie' : 'Open verkoop / exit',
      }
    : {
        key: 'opbrengst',
        label: 'Huurgrondslag',
        status: input.correctedAnnualRent > 0 ? 'voldoende' : 'ontbreekt',
        current: input.correctedAnnualRent > 0
          ? `Gecorrigeerde jaarhuur: € ${Math.round(input.correctedAnnualRent).toLocaleString('nl-NL')}.`
          : 'Er is geen bruikbare gecorrigeerde jaarhuur.',
        needed: input.correctedAnnualRent > 0 ? 'Geen ontbrekende kerninvoer.' : 'Kies de huurbron en vul de daarbij behorende huur in.',
        core: true,
        sectionId: 'sec-huur',
        actionLabel: 'Open huur & NOI',
      });

  const hasTarget = targetPresent(scenario, type);
  pillars.push({
    key: 'rendement',
    label: type === 'verkoop' ? 'Doelwinst / rendementseis' : 'Doel-BAR',
    status: hasTarget ? 'voldoende' : 'ontbreekt',
    current: hasTarget
      ? (type === 'verkoop' ? 'Minimaal één expliciete doelwinst of rendementseis is ingevuld.' : `Doel-BAR: ${n(scenario.target_bar).toLocaleString('nl-NL')}%.`)
      : (type === 'verkoop' ? 'Geen doelwinst op GDV, kosten, vast bedrag of target exitwaarde.' : 'Geen doel-BAR ingevuld.'),
    needed: hasTarget
      ? 'Geen ontbrekende kerninvoer.'
      : (type === 'verkoop' ? 'Vul minimaal één doelwinst of rendementseis in.' : 'Vul de gewenste BAR in.'),
    core: true,
    sectionId: type === 'verkoop' ? 'sec-verkoop' : 'sec-huur',
    actionLabel: type === 'verkoop' ? 'Open doelstelling' : 'Open doel-BAR',
  });

  if (!developmentRelevant && generalCosts.length === 0) {
    pillars.push({
      key: 'kosten',
      label: 'Bouw- en projectkosten',
      status: 'niet_relevant',
      current: 'De huidige strategie bevat geen ontwikkel-/bouwspoor en geen algemene projectkosten.',
      needed: 'Deze pijler beïnvloedt de betrouwbaarheid nu niet. Bij een andere strategie wordt hij opnieuw relevant.',
      core: false,
      sectionId: 'sec-kosten',
    });
  } else {
    const hasDevelopmentCosts = strategy.componentDevelopmentCosts > 0 || generalCosts.length > 0;
    const costStatus: ReliabilityPillarStatus = !hasDevelopmentCosts
      ? 'ontbreekt'
      : costsNotHigh.length > 0
        ? 'aandacht'
        : 'voldoende';
    const firstCost = costsNotHigh[0];
    pillars.push({
      key: 'kosten',
      label: 'Bouw- en projectkosten',
      status: costStatus,
      current: !hasDevelopmentCosts
        ? 'Voor deze ontwikkelstrategie zijn nog geen directe of algemene projectkosten vastgelegd.'
        : costsNotHigh.length > 0
          ? `${costsNotHigh.length} algemene kostenpost${costsNotHigh.length === 1 ? '' : 'en'} nog niet op Hoog: ${costsNotHigh.slice(0, 3).map(costName).join(', ')}${costsNotHigh.length > 3 ? ` en ${costsNotHigh.length - 3} overige` : ''}.`
          : `Directe componentkosten en ${generalCosts.length} algemene kostenpost${generalCosts.length === 1 ? '' : 'en'} zijn aanwezig; alle positieve algemene kostenposten staan op Hoog.`,
      needed: !hasDevelopmentCosts
        ? 'Vul de relevante directe componentkosten en/of algemene projectkosten in.'
        : costsNotHigh.length > 0
          ? 'Controleer per genoemde kostenpost bedrag, scope en bron en kies daarna pas betrouwbaarheid Hoog.'
          : 'Geen ontbrekende kerninvoer volgens de huidige betrouwbaarheidsregel.',
      core: true,
      sectionId: 'sec-kosten',
      targetId: firstCost ? `cost-${firstCost.id}` : undefined,
      actionLabel: firstCost ? 'Open eerste kostenpost' : 'Open bouw- en projectkosten',
    });
  }

  if (objectType === 'mixed_use') {
    const perComponent = scenario.ovb_mode === 'per_component';
    const fiscalStatus: ReliabilityPillarStatus = !perComponent
      ? 'ontbreekt'
      : input.ovbMissingBasisCount > 0
        ? 'aandacht'
        : 'voldoende';
    pillars.push({
      key: 'fiscaliteit',
      label: 'OVB-verdeling mixed-use',
      status: fiscalStatus,
      current: !perComponent
        ? 'OVB is niet per component ingesteld.'
        : input.ovbMissingBasisCount > 0
          ? `Voor ${input.ovbMissingBasisCount} component${input.ovbMissingBasisCount === 1 ? '' : 'en'} ontbreekt nog een bruikbare OVB-grondslag.`
          : 'OVB staat per component en alle componenten hebben een bruikbare grondslag.',
      needed: !perComponent
        ? 'Kies OVB-modus Per component.'
        : input.ovbMissingBasisCount > 0
          ? 'Vul per onvolledig component de methode, grondslag en classificatie in.'
          : 'Geen ontbrekende kerninvoer; fiscale kwalificatie blijft ter controle van notaris/fiscalist.',
      core: true,
      sectionId: !perComponent ? 'sec-aankoop' : 'sec-componenten',
      actionLabel: !perComponent ? 'Open OVB-modus' : 'Open OVB per component',
    });
  } else {
    pillars.push({
      key: 'fiscaliteit',
      label: 'OVB-invoer',
      status: scenario.ovb_mode ? 'voldoende' : 'aandacht',
      current: scenario.ovb_mode ? `OVB-modus: ${scenario.ovb_mode}.` : 'OVB-modus is niet expliciet vastgelegd.',
      needed: scenario.ovb_mode ? 'Controleer classificatie en tarief bij twijfel.' : 'Kies de passende OVB-modus en classificatie.',
      core: true,
      sectionId: 'sec-aankoop',
      actionLabel: 'Open OVB-invoer',
    });
  }

  const componentsRelevant = objectType === 'mixed_use' || strategy.enabled;
  if (!componentsRelevant) {
    pillars.push({
      key: 'componenten',
      label: 'Componenten / units',
      status: 'niet_relevant',
      current: 'Het huidige enkelvoudige scenario gebruikt geen componentstrategie.',
      needed: 'Deze pijler beïnvloedt de betrouwbaarheid nu niet.',
      core: false,
      sectionId: 'sec-componenten',
    });
  } else {
    const componentStatus: ReliabilityPillarStatus = components.length === 0
      ? 'ontbreekt'
      : strategy.enabled && strategyUnits.length === 0
        ? 'aandacht'
        : 'voldoende';
    pillars.push({
      key: 'componenten',
      label: 'Componenten en strategie',
      status: componentStatus,
      current: components.length === 0
        ? 'Er zijn geen componenten geregistreerd.'
        : strategy.enabled && strategyUnits.length === 0
          ? `${components.length} componenten aanwezig, maar geen strategie-units.`
          : `${components.length} componenten en ${strategyUnits.length} strategie-units aanwezig.`,
      needed: components.length === 0
        ? 'Registreer de relevante componenten/units.'
        : strategy.enabled && strategyUnits.length === 0
          ? 'Importeer of maak de componentstrategie aan.'
          : 'Geen ontbrekende kerninvoer.',
      core: true,
      sectionId: components.length === 0 ? 'sec-componenten' : 'sec-strategie',
      actionLabel: components.length === 0 ? 'Open componenten' : 'Open componentstrategie',
    });
  }

  const effectiveWws = getEffectiveWwsMode(null, { scenario, components, strategyUnits, wwsUnits });
  if (effectiveWws.mode !== 'volledig_vereist') {
    pillars.push({
      key: 'wws',
      label: 'WWS',
      status: 'niet_relevant',
      current: effectiveWws.mode === 'niet_nodig' ? 'WWS is voor dit scenario niet nodig.' : 'WWS is alleen indicatief en niet leidend voor de huidige kernuitkomst.',
      needed: 'WWS beïnvloedt de kernbetrouwbaarheid nu niet. De keuze blijft als dossiercontrole zichtbaar.',
      core: false,
      sectionId: 'sec-wws',
    });
  } else {
    const completeUnits = wwsUnits.filter((unit) => n(unit.wws_points) > 0).length;
    const wwsStatus: ReliabilityPillarStatus = wwsUnits.length === 0
      ? 'ontbreekt'
      : completeUnits < wwsUnits.length
        ? 'aandacht'
        : 'voldoende';
    pillars.push({
      key: 'wws',
      label: 'WWS voor verhuur',
      status: wwsStatus,
      current: wwsUnits.length === 0
        ? 'WWS is volledig vereist, maar er zijn geen WWS-units.'
        : `${completeUnits} van ${wwsUnits.length} WWS-units hebben een berekende puntenscore.`,
      needed: wwsUnits.length === 0
        ? 'Maak WWS-units aan en vul de vereiste gegevens in.'
        : completeUnits < wwsUnits.length
          ? 'Vul de ontbrekende WWS-invoer per unit aan en herbereken.'
          : 'De modelinvoer is aanwezig; voor een harde verhuurbeslissing blijft een officiële Huurcommissie-check nodig.',
      core: true,
      sectionId: 'sec-wws',
      actionLabel: 'Open WWS',
    });
  }

  const assumptionStatus: ReliabilityPillarStatus = !assumptionsSource
    ? 'aandacht'
    : assumptionsReliability === 'hoog'
      ? 'voldoende'
      : 'aandacht';
  pillars.push({
    key: 'aannames',
    label: 'Bron en onderbouwing aannames',
    status: assumptionStatus,
    current: !assumptionsSource
      ? 'Er is geen algemene bron/onderbouwing voor de scenario-aannames vastgelegd.'
      : `Bron vastgelegd; gekozen betrouwbaarheid: ${assumptionsReliability}.`,
    needed: !assumptionsSource
      ? 'Leg vast waarop de leidende opbrengst-, huur- en rendementsaannames zijn gebaseerd.'
      : assumptionsReliability !== 'hoog'
        ? 'Controleer de onderbouwing en kies alleen Hoog wanneer deze projectspecifiek voldoende is.'
        : 'Geen ontbrekende kerninvoer volgens de huidige onderbouwingsregel.',
    core: true,
    sectionId: 'sec-onderbouwing',
    actionLabel: 'Open onderbouwing',
  });

  const corePillars = pillars.filter((pillar) => pillar.core && pillar.status !== 'niet_relevant');
  const missing = corePillars.filter((pillar) => pillar.status === 'ontbreekt');
  const attention = corePillars.filter((pillar) => pillar.status === 'aandacht');
  const level: ReliabilityLevel = missing.length > 0 ? 'laag' : attention.length > 0 ? 'middel' : 'hoog';
  const sufficientCount = corePillars.filter((pillar) => pillar.status === 'voldoende').length;

  return {
    level,
    title: level === 'hoog' ? 'Kerninvoer voldoende onderbouwd' : level === 'middel' ? 'Kerninvoer aanwezig, onderbouwing verbeteren' : 'Kerninvoer onvolledig',
    summary: missing.length > 0
      ? `${missing.length} noodzakelijke kernpijler${missing.length === 1 ? '' : 's'} ontbreekt${missing.length === 1 ? '' : 'en'}.`
      : attention.length > 0
        ? `Alle kernpijlers zijn aanwezig; ${attention.length} pijler${attention.length === 1 ? '' : 's'} vraagt${attention.length === 1 ? '' : 'en'} nog controle of betere onderbouwing.`
        : 'Alle voor dit rekenspoor relevante kernpijlers voldoen aan de huidige betrouwbaarheidsregels.',
    pillars,
    sufficientCount,
    relevantCount: corePillars.length,
  };
}
