// Validatie en waarschuwingen voor Vastgoedrekenen V1.
// Levert "Nog te controleren" lijst + aanname-waarschuwingen.

import type { Component, Scenario, ScenarioCost, SellOffUnit, WwsUnit } from './types';
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
  sellOffUnits?: SellOffUnit[];
  objectType: 'enkelvoudig' | 'mixed_use';
  propertyType: PropertyAssumptionType;
  hasWoz: boolean;
  hasEnergyLabel: boolean;
  hasBouwjaar: boolean;
  energyLabel?: string | null;
  dirty?: boolean;
};

/** Lijst met dingen die de gebruiker nog moet controleren / aanvullen. */
export function buildNogTeControleren(c: ValidationContext): ValidationItem[] {
  const out: ValidationItem[] = [];
  const { scenario, components, wwsUnits, sellOffUnits = [], objectType } = c;

  // --- Niet-opgeslagen wijzigingen ---
  if (c.dirty) {
    out.push({ level: 'warning', message: 'Er zijn niet-opgeslagen wijzigingen. Berekeningen en scenariovergelijking kunnen verouderd zijn tot je opslaat.' });
  }

  const wooncomponenten = components.filter((x) => x.component_type === 'woning' || x.component_type === 'appartement');
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
  const SALE_STRATS = new Set(['verkopen_leeg','verkopen_verhuurd','renoveren_verkopen','splitsen_verkopen','transformeren_verkopen']);
  const HOLD_STRATS = new Set(['aanhouden','renoveren_aanhouden','transformeren_aanhouden']);
  if (sellOffUnits.length > 0) {
    const sellMissingValue = sellOffUnits.filter((u) => {
      const r = u as unknown as Record<string, unknown>;
      const strat = (r.strategy as string | null) ?? '';
      if (!SALE_STRATS.has(strat)) return false;
      const src = (r.sale_price_source as string | null) ?? 'totaal';
      const total = Number(r.sale_price_total ?? 0);
      const perM2 = Number(r.sale_price_per_m2 ?? 0);
      return src === 'per_m2' ? perM2 <= 0 : total <= 0;
    }).length;
    const holdMissingRent = sellOffUnits.filter((u) => {
      const r = u as unknown as Record<string, unknown>;
      const strat = (r.strategy as string | null) ?? '';
      if (!HOLD_STRATS.has(strat)) return false;
      const method = (r.hold_valuation_method as string | null) ?? 'BAR';
      if (method === 'handmatige_waarde') return Number(r.hold_value_manual ?? 0) <= 0;
      return Number(r.hold_annual_rent ?? 0) <= 0 && Number(r.hold_monthly_rent ?? 0) <= 0;
    }).length;
    const laterBeslissen = sellOffUnits.filter((u) => ((u as unknown as Record<string, unknown>).strategy as string | null) === 'later_beslissen').length;
    if (sellMissingValue > 0) out.push({ level: 'warning', message: `${sellMissingValue} verkoopcomponent(en) zonder verkoopwaarde. Vul verkoopprijs (totaal of per m²) in.` });
    if (holdMissingRent > 0) out.push({ level: 'warning', message: `${holdMissingRent} aanhoudcomponent(en) zonder huur of waarderingsbron. Vul huur of handmatige waarde in.` });
    if (laterBeslissen > 0) out.push({ level: 'info', message: `${laterBeslissen} component(en) op "Later beslissen". Deze tellen niet mee in de scenariowaarde.` });
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
  if (rentSource === 'wws' && wwsUnits.length === 0) {
    out.push({ level: 'warning', message: 'Huurbron staat op "WWS-gecorrigeerd" maar er zijn geen WWS-units aangemaakt.' });
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

  // --- Verkoop / exit waarschuwingen ---
  const rec = scenario as Record<string, unknown>;
  const saleStrategy = (rec.sale_strategy as string | null) ?? null;
  const isSaleFocusedStrategy = ['uitponden','splitsen','verkopen_geheel','verkoop_per_unit','bedrijfsunits_los','buy_fix_sell','buy_split_sell','buy_transform_sell','herontwikkeling'].includes(scenario.strategy_type as string)
    || (saleStrategy != null && saleStrategy !== 'geen_verkoop' && saleStrategy !== '');
  const hasGrossSale = Number(rec.sale_price_total ?? 0) > 0
    || (Number(rec.sale_price_per_m2 ?? 0) > 0 && Number(rec.sale_sellable_m2 ?? 0) > 0)
    || (Number(rec.sale_price_per_unit ?? 0) > 0 && Number(rec.sale_units_count ?? 0) > 0);

  if (isSaleFocusedStrategy && !hasGrossSale && sellOffUnits.length === 0) {
    out.push({ level: 'warning', message: 'Verkoopscenario zonder verkoopopbrengst. Vul verkoopprijs (totaal, per m² of per unit) in, of gebruik componentstrategie.' });
  }
  if (isSaleFocusedStrategy && Number(rec.sale_costs_percentage ?? 0) === 0 && Number(rec.sale_other_costs ?? 0) === 0) {
    out.push({ level: 'info', message: 'Verkoopkosten ontbreken — voeg makelaars-/verkoopkosten % en/of overige verkoopkosten toe.' });
  }
  if (Number(rec.sale_exit_value_manual ?? 0) > 0) {
    out.push({ level: 'info', message: 'Exitwaarde is een handmatige aanname. Onderbouw met referenties, brokeropinion of vergelijkbare transacties.' });
  }
  if (rec.bid_basis === 'verkoop'
    && Number(rec.sale_target_margin_amount ?? 0) === 0
    && Number(rec.sale_target_margin_percentage ?? 0) === 0
    && Number(rec.sale_target_roi_percentage ?? 0) === 0
    && Number(rec.sale_target_exit_value ?? 0) === 0) {
    out.push({ level: 'warning', message: 'Maximale bieding op basis van verkoop, maar geen gewenste marge/ROI/exitwaarde ingevuld.' });
  }

  // --- Dubbele exit-bron ---
  if (hasGrossSale && sellOffUnits.some((u) => {
    const strat = (u as unknown as Record<string, unknown>).strategy as string | null;
    return strat != null && SALE_STRATS.has(strat);
  })) {
    out.push({ level: 'warning', message: 'Zowel scenario-verkoopwaarde als componentstrategie met verkoopcomponenten zijn ingevuld. Kies één bron om dubbele telling te voorkomen.' });
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
