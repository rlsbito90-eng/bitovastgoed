// Validatie en waarschuwingen voor Vastgoedrekenen V1.
// Levert "Nog te controleren" lijst + aanname-waarschuwingen.

import type { Component, Scenario, ScenarioCost, SellOffUnit, WwsUnit } from './types';
import type { PropertyAssumptionType } from './profiles';
import { isWoonComponentType } from './defaults';

export type ValidationItem = {
  level: 'warning' | 'info' | 'blocker';
  message: string;
};

export type ValidationContext = {
  scenario: Scenario;
  components: Component[];
  costs: ScenarioCost[];
  wwsUnits: WwsUnit[];
  sellOffUnits?: SellOffUnit[];
  objectType: 'enkelvoudig' | 'mixed_use';
  propertyType: PropertyAssumptionType;
  hasWoz: boolean;
  hasEnergyLabel: boolean;
  hasBouwjaar: boolean;
  energyLabel?: string | null;
  dirty?: boolean;
};

const SALE_STRATS = new Set([
  'verkopen_leeg',
  'verkopen_verhuurd',
  'renoveren_verkopen',
  'splitsen_verkopen',
  'transformeren_verkopen',
  'sloop_nieuwbouw_verkopen',
]);

const HOLD_STRATS = new Set([
  'aanhouden',
  'renoveren_aanhouden',
  'transformeren_aanhouden',
  'sloop_nieuwbouw_aanhouden',
]);

function unitRecord(unit: SellOffUnit): Record<string, unknown> {
  return unit as unknown as Record<string, unknown>;
}

function positive(value: unknown): boolean {
  return Number(value ?? 0) > 0;
}

function hasComponentTerminalValue(units: SellOffUnit[]): boolean {
  return units.some((unit) => {
    const record = unitRecord(unit);
    const strategy = (record.strategy as string | null) ?? '';
    if (SALE_STRATS.has(strategy)) {
      const source = (record.sale_price_source as string | null) ?? 'totaal';
      return source === 'per_m2'
        ? positive(record.sale_price_per_m2)
          && (positive(record.surface_gbo) || positive(record.surface_vvo) || positive(record.surface_bvo))
        : positive(record.sale_price_total);
    }
    if (HOLD_STRATS.has(strategy)) {
      const method = (record.hold_valuation_method as string | null) ?? 'BAR';
      if (method === 'handmatige_waarde') return positive(record.hold_value_manual);
      return positive(record.hold_annual_rent) || positive(record.hold_monthly_rent);
    }
    return strategy === 'handmatige_waarde' && positive(record.hold_value_manual);
  });
}

function componentDevelopmentKinds(units: SellOffUnit[]): Set<'renovatie' | 'splitsing' | 'transformatie'> {
  const kinds = new Set<'renovatie' | 'splitsing' | 'transformatie'>();
  for (const unit of units) {
    const record = unitRecord(unit);
    if (positive(record.renovation_costs)) kinds.add('renovatie');
    if (positive(record.splitting_costs)) kinds.add('splitsing');
    if (positive(record.transformation_costs)) kinds.add('transformatie');
  }
  return kinds;
}

function centralCostText(cost: ScenarioCost): string {
  const record = cost as unknown as Record<string, unknown>;
  return `${cost.cost_category ?? ''} ${cost.description ?? ''} ${record.notes ?? ''}`.toLowerCase();
}

function costAmount(cost: ScenarioCost): number {
  const record = cost as unknown as Record<string, unknown>;
  const amount = Number(cost.amount ?? 0);
  const perM2 = Number(record.amount_per_m2 ?? 0);
  const basis = Number(record.m2_basis ?? 0);
  return amount > 0 ? amount : Math.max(0, perM2 * basis);
}

function findDuplicateDevelopmentCostKinds(
  costs: ScenarioCost[],
  units: SellOffUnit[],
): Array<'renovatie' | 'splitsing' | 'transformatie'> {
  const componentKinds = componentDevelopmentKinds(units);
  if (componentKinds.size === 0) return [];

  const centralTexts = costs
    .filter((cost) => costAmount(cost) > 0)
    .map(centralCostText);

  const overlaps: Array<'renovatie' | 'splitsing' | 'transformatie'> = [];
  if (
    componentKinds.has('renovatie')
    && centralTexts.some((text) => /renovat|verbouw/.test(text))
  ) overlaps.push('renovatie');
  if (
    componentKinds.has('splitsing')
    && centralTexts.some((text) => /splits/.test(text))
  ) overlaps.push('splitsing');
  if (
    componentKinds.has('transformatie')
    && centralTexts.some((text) => /transformat|sloop|nieuwbouw|bouwkosten/.test(text))
  ) overlaps.push('transformatie');
  return overlaps;
}

function activeVatTreatments(costs: ScenarioCost[]): Set<string> {
  const treatments = new Set<string>();
  for (const cost of costs) {
    if (costAmount(cost) <= 0) continue;
    const record = cost as unknown as Record<string, unknown>;
    const treatment = String(record.vat_treatment ?? '').trim();
    if (treatment && treatment !== 'geen') treatments.add(treatment);
  }
  return treatments;
}

/** Lijst met dingen die de gebruiker nog moet controleren / aanvullen. */
export function buildNogTeControleren(c: ValidationContext): ValidationItem[] {
  const out: ValidationItem[] = [];
  const { scenario, components, wwsUnits, sellOffUnits = [], objectType } = c;

  // --- Niet-opgeslagen wijzigingen ---
  if (c.dirty) {
    out.push({ level: 'warning', message: 'Er zijn niet-opgeslagen wijzigingen. Berekeningen en scenariovergelijking kunnen verouderd zijn tot je opslaat.' });
  }

  const wooncomponenten = components.filter((x) => isWoonComponentType(x.component_type));
  if (wooncomponenten.length > 0 && wwsUnits.length === 0) {
    out.push({ level: 'warning', message: `Er zijn ${wooncomponenten.length} wooncomponent(en) maar nog geen WWS-units. Klik "Maak WWS-units uit wooncomponenten" of markeer WWS als niet relevant.` });
  }

  // --- WWS-units: ontbrekende kerngegevens ---
  if (wwsUnits.length > 0) {
    const zonderOppervlakte = wwsUnits.filter((u) => !Number(u.living_area_m2 ?? 0)).length;
    const zonderHuur = wwsUnits.filter((u) => !Number(u.current_monthly_rent ?? 0)).length;
    const zonderWoz = wwsUnits.filter((u) => !Number(u.woz_value ?? 0)).length;
    const zonderLabel = wwsUnits.filter((u) => !u.energy_label).length;
    if (zonderOppervlakte > 0) out.push({ level: 'warning', message: `${zonderOppervlakte} WWS-unit(s) zonder woonoppervlakte. WWS-punten en huursegment kunnen niet betrouwbaar worden bepaald.` });
    if (zonderHuur > 0) out.push({ level: 'warning', message: `${zonderHuur} WWS-unit(s) zonder huidige maandhuur. Vul huur aan of zet huurbron op "WWS-gecorrigeerd".` });
    if (zonderWoz > 0) out.push({ level: 'info', message: `${zonderWoz} WWS-unit(s) zonder WOZ-waarde. WOZ telt mee in WWS-punten.` });
    if (zonderLabel > 0) out.push({ level: 'info', message: `${zonderLabel} WWS-unit(s) zonder energielabel. Label beïnvloedt WWS-punten.` });
  }

  // --- Componentstrategie ---
  const componentHasTerminalValue = hasComponentTerminalValue(sellOffUnits);
  const componentHasSale = sellOffUnits.some((unit) => {
    const strategy = (unitRecord(unit).strategy as string | null) ?? '';
    return SALE_STRATS.has(strategy);
  });

  if (sellOffUnits.length > 0) {
    const sellMissingValue = sellOffUnits.filter((u) => {
      const r = unitRecord(u);
      const strat = (r.strategy as string | null) ?? '';
      if (!SALE_STRATS.has(strat)) return false;
      const src = (r.sale_price_source as string | null) ?? 'totaal';
      const total = Number(r.sale_price_total ?? 0);
      const perM2 = Number(r.sale_price_per_m2 ?? 0);
      const surface = Number(r.surface_gbo ?? 0) || Number(r.surface_vvo ?? 0) || Number(r.surface_bvo ?? 0);
      return src === 'per_m2' ? perM2 <= 0 || surface <= 0 : total <= 0;
    }).length;
    const holdMissingRent = sellOffUnits.filter((u) => {
      const r = unitRecord(u);
      const strat = (r.strategy as string | null) ?? '';
      if (!HOLD_STRATS.has(strat)) return false;
      const method = (r.hold_valuation_method as string | null) ?? 'BAR';
      if (method === 'handmatige_waarde') return Number(r.hold_value_manual ?? 0) <= 0;
      return Number(r.hold_annual_rent ?? 0) <= 0 && Number(r.hold_monthly_rent ?? 0) <= 0;
    }).length;
    const laterBeslissen = sellOffUnits.filter((u) => (unitRecord(u).strategy as string | null) === 'later_beslissen').length;
    const manualValues = sellOffUnits.filter((u) => {
      const r = unitRecord(u);
      return (r.strategy as string | null) === 'handmatige_waarde'
        || (HOLD_STRATS.has((r.strategy as string | null) ?? '')
          && (r.hold_valuation_method as string | null) === 'handmatige_waarde');
    }).length;
    if (sellMissingValue > 0) out.push({ level: 'warning', message: `${sellMissingValue} verkoopcomponent(en) zonder verkoopwaarde. Vul verkoopprijs (totaal of per m²) én het bijbehorende metrage in.` });
    if (holdMissingRent > 0) out.push({ level: 'warning', message: `${holdMissingRent} aanhoudcomponent(en) zonder huur of waarderingsbron. Vul huur of handmatige waarde in.` });
    if (laterBeslissen > 0) out.push({ level: 'info', message: `${laterBeslissen} component(en) op "Later beslissen". Deze tellen niet mee in de scenariowaarde.` });
    if (manualValues > 0) out.push({ level: 'info', message: `${manualValues} componentwaarde(n) zijn handmatige waarderingsaannames en geen verkooptransacties. Leg bron, peildatum en onderbouwing vast.` });
  }

  const duplicateKinds = findDuplicateDevelopmentCostKinds(c.costs, sellOffUnits);
  if (duplicateKinds.length > 0) {
    out.push({
      level: 'warning',
      message: `Mogelijke dubbele kosteninvoer: ${duplicateKinds.join(', ')} staat zowel bij algemene kosten als bij componenten. Verwijder één invoerbron of leg vast waarom beide bedragen verschillend zijn.`,
    });
  }

  // --- Huurbron-conflicten ---
  const rentSource = (scenario.rent_source as string | null) ?? 'handmatig';
  const hasComponentRent = components.some((x) => Number(x.current_annual_rent ?? 0) > 0 || Number(x.current_monthly_rent ?? 0) > 0);
  const hasScenarioRent = Number(scenario.current_monthly_rent ?? 0) > 0 || Number(scenario.market_monthly_rent ?? 0) > 0;
  if (hasComponentRent && rentSource === 'handmatig' && hasScenarioRent) {
    out.push({ level: 'warning', message: 'Componenten bevatten huur, maar huurbron staat op "Handmatig in huuranalyse". Kies welke bron leidend is om dubbele telling te voorkomen.' });
  }
  if (rentSource === 'componenten' && !hasComponentRent) {
    out.push({ level: 'warning', message: 'Huurbron staat op "Som van componenten" maar geen enkel component heeft huurgegevens.' });
  }
  if ((rentSource === 'wws' || rentSource === 'wws_gecorrigeerd') && wwsUnits.length === 0) {
    out.push({ level: 'warning', message: 'Huurbron staat op "WWS-gecorrigeerd" maar er zijn geen WWS-units aangemaakt.' });
  }

  if (objectType === 'mixed_use' && scenario.ovb_mode !== 'per_component') {
    out.push({ level: 'warning', message: 'Biedingsrisico: mixed-use object zonder OVB-toerekening per component. Verschillende tarieven kunnen de maximale koopsom materieel beïnvloeden.' });
  }

  if (scenario.ovb_mode === 'per_component') {
    const zonderWaarde = components.filter((x) => !x.allocated_component_value && !x.surface_gbo);
    if (zonderWaarde.length > 0) {
      out.push({ level: 'blocker', message: `${zonderWaarde.length} component(en) zonder componentwaarde of m². OVB per component kan niet correct worden berekend.` });
    }
  }

  const vatTreatments = activeVatTreatments(c.costs);
  if (vatTreatments.size > 1) {
    out.push({
      level: 'warning',
      message: 'Biedingsrisico: meerdere btw-behandelingen zijn actief binnen hetzelfde scenario. Controleer verrekenbaarheid, vrijgestelde prestaties en of alle bedragen inclusief of exclusief btw zijn ingevoerd.',
    });
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

  if (scenario.strategy_type === 'transformeren' && c.costs.length === 0 && componentDevelopmentKinds(sellOffUnits).size === 0) {
    out.push({ level: 'warning', message: 'Transformatiescenario zonder transformatiekosten. Voeg bouwkosten, vergunningskosten en fasering toe.' });
  }

  // --- Verkoop / exit waarschuwingen ---
  const rec = scenario as Record<string, unknown>;
  const saleStrategy = (rec.sale_strategy as string | null) ?? null;
  const scenarioSaleStrategyActive = saleStrategy != null && saleStrategy !== 'geen_verkoop' && saleStrategy !== '';
  const isSaleFocusedStrategy = ['uitponden','splitsen','verkopen_geheel','verkoop_per_unit','bedrijfsunits_los','buy_fix_sell','buy_split_sell','buy_transform_sell','herontwikkeling'].includes(scenario.strategy_type as string)
    || scenarioSaleStrategyActive
    || componentHasSale;
  const hasGrossSale = Number(rec.sale_price_total ?? 0) > 0
    || (Number(rec.sale_price_per_m2 ?? 0) > 0 && Number(rec.sale_sellable_m2 ?? 0) > 0)
    || (Number(rec.sale_price_per_unit ?? 0) > 0 && Number(rec.sale_units_count ?? 0) > 0);

  if (isSaleFocusedStrategy && !hasGrossSale && !componentHasTerminalValue) {
    out.push({ level: 'warning', message: 'Verkoopscenario zonder verkoopopbrengst. Vul verkoopprijs (totaal, per m² of per unit) in, of gebruik een complete componentstrategie.' });
  }
  if (hasGrossSale && Number(rec.sale_costs_percentage ?? 0) === 0 && Number(rec.sale_other_costs ?? 0) === 0) {
    out.push({ level: 'info', message: 'Verkoopkosten ontbreken bij de centrale scenario-exit — voeg makelaars-/verkoopkosten % en/of overige verkoopkosten toe.' });
  }
  if (Number(rec.sale_exit_value_manual ?? 0) > 0) {
    out.push({ level: 'info', message: 'Handmatige exitwaarde is een waarderingsaanname en geen verkooptransactie. Onderbouw met bron, peildatum, broker opinion of vergelijkbare transacties.' });
  }
  if (rec.bid_basis === 'verkoop'
    && Number(rec.sale_target_margin_amount ?? 0) === 0
    && Number(rec.sale_target_margin_percentage ?? 0) === 0
    && Number(rec.sale_target_roi_percentage ?? 0) === 0
    && Number(rec.sale_target_exit_value ?? 0) === 0) {
    out.push({ level: 'warning', message: 'Maximale bieding op basis van verkoop, maar geen doelwinst op GDV, winst op kosten of vaste doelwinst ingevuld.' });
  }

  // --- Dubbele exit-bron ---
  if (hasGrossSale && componentHasSale) {
    out.push({ level: 'warning', message: 'Zowel centrale scenario-verkoopwaarde als componentstrategie met verkoopcomponenten zijn ingevuld. Kies één opbrengstbron om dubbele invoer te voorkomen.' });
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
