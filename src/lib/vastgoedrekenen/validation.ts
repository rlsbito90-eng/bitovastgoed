// Validatie en waarschuwingen voor Vastgoedrekenen V1.
// Levert een strategie-afhankelijke actielijst en aanname-waarschuwingen.

import type { Component, Scenario, ScenarioCost, SellOffUnit, WwsUnit } from './types';
import type { AcquisitionComponent } from './acquisition';
import type { PropertyAssumptionType } from './profiles';
import { isWoonComponentType } from './defaults';
import { getEffectiveWwsMode } from './wws/mode';
import { isHoldStrategy, isSaleStrategy } from './componentStrategy';

export type ValidationAction = {
  label: string;
  sectionId: string;
  targetId?: string;
  /** Open het aangewezen tabelitem of de drawer na navigatie. */
  openTarget?: boolean;
};

export type ValidationDetail = {
  label: string;
  value: string;
  note?: string;
  tone?: 'neutral' | 'warning' | 'info';
};

export type ValidationItem = {
  level: 'warning' | 'info' | 'blocker';
  /** Nu oplossen, later dossiermatig controleren, of bewust niet relevant. */
  category?: 'now' | 'later' | 'not_relevant';
  title?: string;
  message: string;
  details?: ValidationDetail[];
  actions?: ValidationAction[];
};

export type ValidationContext = {
  scenario: Scenario;
  components: Component[];
  acquisitionComponents?: AcquisitionComponent[];
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
    if (isSaleStrategy(strategy)) {
      const source = (record.sale_price_source as string | null) ?? 'totaal';
      return source === 'per_m2'
        ? positive(record.sale_price_per_m2)
          && (positive(record.surface_gbo) || positive(record.surface_vvo) || positive(record.surface_bvo))
        : positive(record.sale_price_total);
    }
    if (isHoldStrategy(strategy)) {
      const method = (record.hold_valuation_method as string | null) ?? 'BAR';
      if (method === 'handmatige_waarde') return positive(record.hold_value_manual);
      return positive(record.hold_annual_rent) || positive(record.hold_monthly_rent);
    }
    return strategy === 'handmatige_waarde' && positive(record.hold_value_manual);
  });
}

export type DevelopmentCostKind = 'renovatie' | 'splitsing' | 'transformatie';

export type DuplicateDevelopmentCostItem = {
  id: string;
  label: string;
  amount: number;
  matchedTerms?: string[];
};

export type DuplicateDevelopmentCostDetail = {
  kind: DevelopmentCostKind;
  centralCostIds: string[];
  centralLabels: string[];
  centralAmount: number;
  componentUnitIds: string[];
  componentLabels: string[];
  componentAmount: number;
  centralItems: DuplicateDevelopmentCostItem[];
  componentItems: DuplicateDevelopmentCostItem[];
  matchedTerms: string[];
  reviewState: 'onbeoordeeld';
};

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

function costLabel(cost: ScenarioCost): string {
  return String(cost.description ?? '').trim()
    || String(cost.cost_category ?? '').trim()
    || 'Naamloze kostenpost';
}

function unitLabel(unit: SellOffUnit): string {
  const record = unitRecord(unit);
  return String(record.unit_label ?? record.unit_name ?? '').trim() || 'Naamloze component';
}

function isContingencyCost(cost: ScenarioCost): boolean {
  return /onvoorzien|contingenc|risicoreserver/.test(centralCostText(cost));
}

const KIND_CONFIG: Record<DevelopmentCostKind, {
  field: 'renovation_costs' | 'splitting_costs' | 'transformation_costs';
  componentLabel: string;
  terms: Array<{ label: string; pattern: RegExp }>;
}> = {
  renovatie: {
    field: 'renovation_costs',
    componentLabel: 'renovatiekosten per component',
    terms: [
      { label: 'renovatie', pattern: /renovat/ },
      { label: 'verbouw', pattern: /verbouw/ },
    ],
  },
  splitsing: {
    field: 'splitting_costs',
    componentLabel: 'splitsingskosten per component',
    terms: [
      { label: 'splitsing', pattern: /splits/ },
    ],
  },
  transformatie: {
    field: 'transformation_costs',
    componentLabel: 'transformatie-/sloop-/nieuwbouwkosten per component',
    terms: [
      { label: 'transformatie', pattern: /transformat/ },
      { label: 'sloop', pattern: /sloop/ },
      { label: 'nieuwbouw', pattern: /nieuwbouw/ },
      { label: 'bouwkosten', pattern: /bouwkosten/ },
    ],
  },
};

function matchingTerms(cost: ScenarioCost, kind: DevelopmentCostKind): string[] {
  const text = centralCostText(cost);
  return KIND_CONFIG[kind].terms
    .filter((term) => term.pattern.test(text))
    .map((term) => term.label);
}

export function findDuplicateDevelopmentCostDetails(
  costs: ScenarioCost[],
  units: SellOffUnit[],
): DuplicateDevelopmentCostDetail[] {
  const details: DuplicateDevelopmentCostDetail[] = [];

  for (const kind of Object.keys(KIND_CONFIG) as DevelopmentCostKind[]) {
    const cfg = KIND_CONFIG[kind];
    const centralMatches = costs.filter((cost) => (
      costAmount(cost) > 0
      && !isContingencyCost(cost)
      && matchingTerms(cost, kind).length > 0
    ));
    const componentMatches = units.filter((unit) => positive(unitRecord(unit)[cfg.field]));
    if (centralMatches.length === 0 || componentMatches.length === 0) continue;

    const centralItems: DuplicateDevelopmentCostItem[] = centralMatches.map((cost) => ({
      id: cost.id,
      label: costLabel(cost),
      amount: costAmount(cost),
      matchedTerms: matchingTerms(cost, kind),
    }));
    const componentItems: DuplicateDevelopmentCostItem[] = componentMatches.map((unit) => ({
      id: unit.id,
      label: unitLabel(unit),
      amount: Number(unitRecord(unit)[cfg.field] ?? 0),
    }));
    const matchedTerms = [...new Set(centralItems.flatMap((item) => item.matchedTerms ?? []))];

    details.push({
      kind,
      centralCostIds: centralItems.map((item) => item.id),
      centralLabels: centralItems.map((item) => item.label),
      centralAmount: centralItems.reduce((sum, item) => sum + item.amount, 0),
      componentUnitIds: componentItems.map((item) => item.id),
      componentLabels: componentItems.map((item) => item.label),
      componentAmount: componentItems.reduce((sum, item) => sum + item.amount, 0),
      centralItems,
      componentItems,
      matchedTerms,
      reviewState: 'onbeoordeeld',
    });
  }

  return details;
}

export function findDuplicateDevelopmentCostKinds(
  costs: ScenarioCost[],
  units: SellOffUnit[],
): DevelopmentCostKind[] {
  return findDuplicateDevelopmentCostDetails(costs, units).map((detail) => detail.kind);
}

function componentDevelopmentKinds(units: SellOffUnit[]): Set<DevelopmentCostKind> {
  const kinds = new Set<DevelopmentCostKind>();
  for (const unit of units) {
    const record = unitRecord(unit);
    if (positive(record.renovation_costs)) kinds.add('renovatie');
    if (positive(record.splitting_costs)) kinds.add('splitsing');
    if (positive(record.transformation_costs)) kinds.add('transformatie');
  }
  return kinds;
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

function wwsAction(targetId?: string): ValidationAction {
  return {
    label: targetId ? 'Open eerste WWS-unit' : 'Open WWS-keuze',
    sectionId: 'sec-wws',
    targetId,
    openTarget: !!targetId,
  };
}

/** Lijst met dingen die de gebruiker nog moet controleren / aanvullen. */
export function buildNogTeControleren(c: ValidationContext): ValidationItem[] {
  const out: ValidationItem[] = [];
  const { scenario, components, acquisitionComponents = [], wwsUnits, sellOffUnits = [], objectType } = c;
  const ovbComponents = acquisitionComponents.length > 0 ? acquisitionComponents : components;
  const hasSeparateAcquisitionStructure = acquisitionComponents.length > 0;

  if (c.dirty) {
    out.push({
      level: 'warning',
      category: 'now',
      title: 'Wijzigingen opslaan',
      message: 'Er zijn niet-opgeslagen wijzigingen. Berekeningen en scenariovergelijking kunnen verouderd zijn tot je opslaat.',
    });
  }

  const wooncomponenten = components.filter((x) => isWoonComponentType(x.component_type));
  const effectiveWwsMode = getEffectiveWwsMode(null, {
    scenario,
    components,
    strategyUnits: sellOffUnits,
    wwsUnits,
  });
  const wwsRelevant = effectiveWwsMode.mode !== 'niet_nodig';

  if (wooncomponenten.length > 0 && wwsUnits.length === 0 && wwsRelevant) {
    out.push({
      level: 'warning',
      category: 'now',
      title: 'WWS-keuze afronden',
      message: `Er zijn ${wooncomponenten.length} wooncomponent(en), maar nog geen WWS-units. Maak WWS-units aan wanneer WWS relevant is, of kies bewust “Niet nodig” voor dit scenario.`,
      actions: [wwsAction()],
    });
  } else if (wooncomponenten.length > 0 && !wwsRelevant) {
    out.push({
      level: 'info',
      category: 'not_relevant',
      title: 'WWS niet relevant',
      message: `WWS is voor dit scenario op “Niet nodig” gezet. De ${wooncomponenten.length} wooncomponent(en) hoeven daarom geen WWS-units te krijgen zolang de gekozen strategie en huurbron niet veranderen.`,
      actions: [wwsAction()],
    });
  }

  if (wwsRelevant && wwsUnits.length > 0) {
    const zonderOppervlakte = wwsUnits.filter((u) => !Number(u.living_area_m2 ?? 0));
    const zonderHuur = wwsUnits.filter((u) => !Number(u.current_monthly_rent ?? 0));
    const zonderWoz = wwsUnits.filter((u) => !Number(u.woz_value ?? 0));
    const zonderLabel = wwsUnits.filter((u) => !u.energy_label);
    if (zonderOppervlakte.length > 0) out.push({
      level: 'warning', category: 'now', title: 'WWS-woonoppervlakte aanvullen',
      message: `${zonderOppervlakte.length} WWS-unit(s) hebben geen woonoppervlakte. WWS-punten en huursegment kunnen daardoor niet betrouwbaar worden bepaald.`,
      actions: [wwsAction(`wws-unit-${zonderOppervlakte[0].id}`)],
    });
    if (zonderHuur.length > 0) out.push({
      level: 'warning', category: 'now', title: 'WWS-huurbron aanvullen',
      message: `${zonderHuur.length} WWS-unit(s) hebben geen huidige maandhuur. Vul de huur aan of controleer of een WWS-gecorrigeerde huurbron wordt gebruikt.`,
      actions: [wwsAction(`wws-unit-${zonderHuur[0].id}`)],
    });
    if (zonderWoz.length > 0) out.push({
      level: 'info', category: 'later', title: 'WOZ voor WWS aanvullen',
      message: `${zonderWoz.length} WWS-unit(s) hebben geen WOZ-waarde. WOZ telt mee in de WWS-punten.`,
      actions: [wwsAction(`wws-unit-${zonderWoz[0].id}`)],
    });
    if (zonderLabel.length > 0) out.push({
      level: 'info', category: 'later', title: 'Energielabel voor WWS aanvullen',
      message: `${zonderLabel.length} WWS-unit(s) hebben geen energielabel. Het label beïnvloedt de WWS-punten.`,
      actions: [wwsAction(`wws-unit-${zonderLabel[0].id}`)],
    });
  }

  const componentHasTerminalValue = hasComponentTerminalValue(sellOffUnits);
  const componentHasSale = sellOffUnits.some((unit) => {
    const strategy = (unitRecord(unit).strategy as string | null) ?? '';
    return isSaleStrategy(strategy);
  });

  if (sellOffUnits.length > 0) {
    const sellMissingValue = sellOffUnits.filter((u) => {
      const r = unitRecord(u);
      const strat = (r.strategy as string | null) ?? '';
      if (!isSaleStrategy(strat)) return false;
      const src = (r.sale_price_source as string | null) ?? 'totaal';
      const total = Number(r.sale_price_total ?? 0);
      const perM2 = Number(r.sale_price_per_m2 ?? 0);
      const surface = Number(r.surface_gbo ?? 0) || Number(r.surface_vvo ?? 0) || Number(r.surface_bvo ?? 0);
      return src === 'per_m2' ? perM2 <= 0 || surface <= 0 : total <= 0;
    });
    const holdMissingRent = sellOffUnits.filter((u) => {
      const r = unitRecord(u);
      const strat = (r.strategy as string | null) ?? '';
      if (!isHoldStrategy(strat)) return false;
      const method = (r.hold_valuation_method as string | null) ?? 'BAR';
      if (method === 'handmatige_waarde') return Number(r.hold_value_manual ?? 0) <= 0;
      return Number(r.hold_annual_rent ?? 0) <= 0 && Number(r.hold_monthly_rent ?? 0) <= 0;
    });
    const laterBeslissen = sellOffUnits.filter((u) => (unitRecord(u).strategy as string | null) === 'later_beslissen');
    const manualValues = sellOffUnits.filter((u) => {
      const r = unitRecord(u);
      return (r.strategy as string | null) === 'handmatige_waarde'
        || (isHoldStrategy((r.strategy as string | null) ?? '')
          && (r.hold_valuation_method as string | null) === 'handmatige_waarde');
    });
    if (sellMissingValue.length > 0) out.push({
      level: 'warning', category: 'now', title: 'Verkoopwaarde per component aanvullen',
      message: `${sellMissingValue.length} verkoopcomponent(en) hebben geen complete verkoopwaarde. Vul totaalprijs of prijs per m² met het bijbehorende metrage in.`,
      actions: [{ label: 'Open eerste componentstrategie', sectionId: 'sec-strategie', targetId: `strategy-unit-${sellMissingValue[0].id}`, openTarget: true }],
    });
    if (holdMissingRent.length > 0) out.push({
      level: 'warning', category: 'now', title: 'Huur of waarde per component aanvullen',
      message: `${holdMissingRent.length} aanhoudcomponent(en) hebben geen huur of waarderingsbron.`,
      actions: [{ label: 'Open eerste componentstrategie', sectionId: 'sec-strategie', targetId: `strategy-unit-${holdMissingRent[0].id}`, openTarget: true }],
    });
    if (laterBeslissen.length > 0) out.push({
      level: 'info', category: 'later', title: 'Componentstrategie later beslissen',
      message: `${laterBeslissen.length} component(en) staan op “Later beslissen” en tellen niet mee in de scenariowaarde.`,
      actions: [{ label: 'Open componentstrategie', sectionId: 'sec-strategie' }],
    });
    if (manualValues.length > 0) out.push({
      level: 'info', category: 'later', title: 'Handmatige componentwaarde onderbouwen',
      message: `${manualValues.length} componentwaarde(n) zijn handmatige waarderingsaannames en geen verkooptransacties. Leg bron, peildatum en onderbouwing vast.`,
      actions: [{ label: 'Open eerste componentstrategie', sectionId: 'sec-strategie', targetId: `strategy-unit-${manualValues[0].id}`, openTarget: true }],
    });
  }

  const formatEur = (value: number) => new Intl.NumberFormat('nl-NL', {
    style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
  }).format(value);

  const costsNeedingSupport = c.costs.filter(
    (cost) => costAmount(cost) > 0 && cost.reliability_status !== 'hoog',
  );
  for (const cost of costsNeedingSupport) {
    const status = cost.reliability_status == null ? 'niet beoordeeld' : cost.reliability_status;
    out.push({
      level: 'warning',
      category: 'now',
      title: 'Kostenpost onderbouwen',
      message: `“${costLabel(cost)}” (${formatEur(costAmount(cost))}) staat op ${status}. Controleer bedrag en scope, vul Bron / onderbouwing in en kies daarna de passende betrouwbaarheid.`,
      actions: [{ label: 'Ga naar deze kostenpost', sectionId: 'sec-kosten', targetId: `cost-${cost.id}` }],
    });
  }

  const duplicateDetails = findDuplicateDevelopmentCostDetails(c.costs, sellOffUnits);
  for (const detail of duplicateDetails) {
    const matchedText = detail.matchedTerms.length > 0
      ? detail.matchedTerms.map((term) => `“${term}”`).join(', ')
      : detail.kind;
    const centralDetails: ValidationDetail[] = detail.centralItems.map((item) => ({
      label: 'Algemene kostenpost',
      value: `${item.label} — ${formatEur(item.amount)}`,
      note: item.matchedTerms && item.matchedTerms.length > 0
        ? `Tekstmatch: ${item.matchedTerms.map((term) => `“${term}”`).join(', ')}`
        : undefined,
      tone: 'warning',
    }));
    const componentDetails: ValidationDetail[] = detail.componentItems.map((item) => ({
      label: 'Componentkosten',
      value: `${item.label} — ${formatEur(item.amount)}`,
      note: `Ingevoerd als ${KIND_CONFIG[detail.kind].componentLabel}.`,
      tone: 'neutral',
    }));

    out.push({
      level: 'warning',
      category: 'now',
      title: `Controleer mogelijke dubbele ${detail.kind}kosten`,
      message: `Mogelijke dubbele kosteninvoer: de module vond een automatische tekstmatch op ${matchedText}. Dit is nog geen bevestigde dubbeling. Controleer of de algemene kostenpost dezelfde werkzaamheden en grondslag bevat als de componentkosten.`,
      details: [
        {
          label: 'Waarom gemeld',
          value: `Er staat ${formatEur(detail.centralAmount)} aan algemene ${detail.kind}kosten naast ${formatEur(detail.componentAmount)} aan ${KIND_CONFIG[detail.kind].componentLabel}.`,
          note: 'Onvoorzien, contingency en risicoreserveringen worden vooraf uitgesloten en veroorzaken deze melding niet.',
          tone: 'info',
        },
        ...centralDetails,
        ...componentDetails,
        {
          label: 'Wat moet je doen?',
          value: 'Vergelijk de scope. Verwijder of verlaag één invoer wanneer dezelfde werkzaamheden dubbel zijn opgenomen. Laat beide staan wanneer de scopes aantoonbaar verschillen en leg dat verschil vast in omschrijving en bron.',
          tone: 'neutral',
        },
      ],
      actions: [
        { label: 'Naar algemene kostenpost', sectionId: 'sec-kosten', targetId: `cost-${detail.centralCostIds[0]}` },
        { label: 'Naar componentkosten', sectionId: 'sec-strategie', targetId: `strategy-unit-${detail.componentUnitIds[0]}`, openTarget: true },
      ],
    });
  }

  const rentSource = (scenario.rent_source as string | null) ?? 'handmatig';
  const hasComponentRent = components.some((x) => Number(x.current_annual_rent ?? 0) > 0 || Number(x.current_monthly_rent ?? 0) > 0);
  const hasScenarioRent = Number(scenario.current_monthly_rent ?? 0) > 0 || Number(scenario.market_monthly_rent ?? 0) > 0;
  if (hasComponentRent && rentSource === 'handmatig' && hasScenarioRent) {
    out.push({
      level: 'warning', category: 'now', title: 'Leidende huurbron kiezen',
      message: 'Componenten bevatten huur terwijl de huuranalyse ook handmatige scenariohuur gebruikt. Kies één leidende bron om dubbele telling te voorkomen.',
      actions: [{ label: 'Open huuranalyse', sectionId: 'sec-huur' }, { label: 'Bekijk componenten', sectionId: 'sec-componenten' }],
    });
  }
  if (rentSource === 'componenten' && !hasComponentRent) {
    out.push({
      level: 'warning', category: 'now', title: 'Componenthuur ontbreekt',
      message: 'De huurbron staat op “Som van componenten”, maar geen component heeft huurgegevens.',
      actions: [{ label: 'Bekijk componenten', sectionId: 'sec-componenten' }, { label: 'Wijzig huurbron', sectionId: 'sec-huur' }],
    });
  }
  if ((rentSource === 'wws' || rentSource === 'wws_gecorrigeerd') && wwsUnits.length === 0) {
    out.push({
      level: 'warning', category: 'now', title: 'WWS-huurbron zonder WWS-units',
      message: 'De huurbron gebruikt WWS, maar er zijn geen WWS-units aangemaakt.',
      actions: [wwsAction()],
    });
  }

  const purchaseBasis = Number(scenario.purchase_price ?? 0) > 0
    || Number(scenario.asking_price ?? 0) > 0;
  if (scenario.ovb_mode !== 'manual' && !purchaseBasis) {
    out.push({
      level: 'warning',
      category: 'now',
      title: 'Actuele aankoopbasis invullen',
      message: 'De OVB in Aankoop & investering staat op € 0 omdat zowel de beoogde aankoopprijs als de vraagprijs ontbreekt. De residuele solver kan OVB per kandidaat-koopsom herberekenen, maar de actuele scenario-investering heeft eerst een aankoopbasis nodig.',
      actions: [{ label: 'Open aankoop & investering', sectionId: 'sec-aankoop' }],
    });
  }

  if (scenario.ovb_mode === 'per_component') {
    const allocationMethods = new Set(
      ovbComponents
        .map((component) => String(component.transfer_tax_allocation_method ?? 'value'))
        .filter((method) => method !== 'manual'),
    );
    if (allocationMethods.size > 1) {
      out.push({
        level: 'warning',
        category: 'now',
        title: 'Eén OVB-verdeelmethode kiezen',
        message: 'Er worden meerdere automatische OVB-verdeelmethoden door elkaar gebruikt. Kies één consistente methode voor de verkrijgingssituatie, zodat de totale grondslag exact aansluit op de aankoopprijs.',
        actions: [{ label: 'Open componenten', sectionId: 'sec-componenten' }],
      });
    }

    const strategyAllocated = hasSeparateAcquisitionStructure
      ? []
      : components.filter((component) => component.transfer_tax_allocation_method === 'strategy');
    if (strategyAllocated.length > 0) {
      out.push({
        level: 'warning',
        category: 'now',
        title: 'Toekomstige waarde niet als standaard OVB-verdeling gebruiken',
        message: `${strategyAllocated.length} component(en) gebruiken de toekomstige strategiewaarde als indicatieve verdeelsleutel. De OVB wordt wel over de aankoopprijs berekend, maar de verdeling moet voor een harde bieding aansluiten op de huidige staat bij verkrijging. Gebruik bij voorkeur huidige componentwaarden of een externe verkrijgingswaardeverdeling.`,
        actions: [{
          label: 'Open eerste betreffende component',
          sectionId: 'sec-componenten',
          targetId: `componenten-unit-${strategyAllocated[0].id}`,
          openTarget: true,
        }],
      });
    }
  }

  if (objectType === 'mixed_use' && scenario.ovb_mode !== 'per_component') {
    out.push({
      level: 'warning',
      category: 'now',
      title: 'OVB-verdeling kiezen',
      message: 'Biedingsrisico: mixed-use object zonder OVB-toerekening per component. Woningen en niet-woningen kunnen verschillend worden behandeld, waardoor de investering en maximale aankoopprijs materieel kunnen veranderen.',
      actions: [
        { label: 'Kies OVB-modus', sectionId: 'sec-aankoop' },
        { label: 'Bekijk componenten', sectionId: 'sec-componenten' },
      ],
    });
  }

  if (scenario.ovb_mode === 'per_component') {
    const zonderWaarde = ovbComponents.filter((x) => !x.allocated_component_value && !x.surface_gbo && x.transfer_tax_allocation_method !== 'manual');
    if (zonderWaarde.length > 0) {
      out.push({
        level: 'blocker',
        category: 'now',
        title: 'OVB per component aanvullen',
        message: `${zonderWaarde.length} component(en) hebben geen toegerekende waarde of bruikbare m²-grondslag. Open het eerste component en kies daar de OVB-classificatie en toerekeningsmethode.`,
        actions: [{
          label: 'Open eerste onvolledige component',
          sectionId: 'sec-componenten',
          targetId: hasSeparateAcquisitionStructure
            ? `acquisition-component-${zonderWaarde[0].id}`
            : `componenten-unit-${zonderWaarde[0].id}`,
          openTarget: true,
        }],
      });
    }
  }

  if (hasSeparateAcquisitionStructure) {
    const unsupportedExemptions = acquisitionComponents.filter((component) => (
      component.transfer_tax_classification === 'vrijgesteld'
      && !String(component.source_note ?? component.notes ?? '').trim()
    ));
    if (unsupportedExemptions.length > 0) {
      out.push({
        level: 'warning',
        category: 'now',
        title: 'OVB-vrijstelling onderbouwen',
        message: `${unsupportedExemptions.length} verkrijgingscomponent(en) staan op “Vrijgesteld / n.v.t.” zonder bron of toelichting. Leg vast waarom op het huidige verkrijgingsdeel geen OVB wordt gerekend.`,
        actions: [{
          label: 'Open eerste vrijgestelde verkrijgingscomponent',
          sectionId: 'sec-componenten',
          targetId: `acquisition-component-${unsupportedExemptions[0].id}`,
          openTarget: true,
        }],
      });
    }
  }

  const vatTreatments = activeVatTreatments(c.costs);
  if (vatTreatments.size > 1) {
    out.push({
      level: 'warning',
      category: 'now',
      title: 'Btw-behandeling controleren',
      message: 'Biedingsrisico: meerdere btw-behandelingen zijn actief binnen hetzelfde scenario. Controleer verrekenbaarheid, vrijgestelde prestaties en of bedragen inclusief of exclusief btw zijn ingevoerd.',
      actions: [{ label: 'Open kosten en btw', sectionId: 'sec-kosten' }],
    });
  }

  if (!components.some((x) => x.has_contract) && (scenario.current_monthly_rent ?? 0) > 0) {
    out.push({ level: 'info', category: 'later', title: 'Huurcontracten controleren', message: 'Huurcontracten zijn niet bevestigd. Controleer ingangsdatum, looptijd en indexatie.' });
  }
  if (!c.hasEnergyLabel) out.push({ level: 'info', category: 'later', title: 'Energielabel aanvullen', message: 'Energielabel ontbreekt. Dit kan relevant zijn voor WWS, exploitatie, verduurzaming en label-C-compliance bij kantoor.' });
  if (!c.hasWoz) out.push({ level: 'info', category: 'later', title: 'WOZ-waarde aanvullen', message: 'WOZ-waarde ontbreekt. Dit kan relevant zijn voor OVB-grondslag en WWS.' });
  if (!c.hasBouwjaar) out.push({ level: 'info', category: 'later', title: 'Bouwjaar aanvullen', message: 'Bouwjaar ontbreekt en is relevant voor de bouwkundige risico-inschatting.' });

  if (!scenario.cost_structure || scenario.cost_structure === 'onbekend') {
    out.push({ level: 'info', category: 'later', title: 'Kostenstructuur controleren', message: 'Kostenstructuur en servicekosten zijn onbekend. Controleer wie welke kosten draagt voor leegstandsrisico en NOI.', actions: [{ label: 'Open onderbouwing', sectionId: 'sec-onderbouwing' }] });
  }
  if (!scenario.contract_checked) out.push({ level: 'info', category: 'later', title: 'Contractduur controleren', message: 'Contractduur is nog niet gecontroleerd.', actions: [{ label: 'Open onderbouwing', sectionId: 'sec-onderbouwing' }] });
  if (!scenario.service_costs_checked) out.push({ level: 'info', category: 'later', title: 'Servicekosten controleren', message: 'Servicekosten zijn nog niet gecontroleerd.', actions: [{ label: 'Open onderbouwing', sectionId: 'sec-onderbouwing' }] });
  if (scenario.mjop_present === 'onbekend' || !scenario.mjop_present) {
    out.push({ level: 'info', category: 'later', title: 'MJOP-status controleren', message: 'MJOP-status is onbekend. Gebruik bij ontbreken minimaal een conservatief profiel.', actions: [{ label: 'Open onderbouwing', sectionId: 'sec-onderbouwing' }] });
  }
  if (scenario.assumptions_manual && !scenario.assumptions_source) {
    out.push({
      level: 'warning', category: 'now', title: 'Bron van handmatige aannames vastleggen',
      message: 'Aannames zijn handmatig aangepast zonder onderbouwing. Leg vast waar de aangepaste percentages of bedragen vandaan komen.',
      actions: [{ label: 'Open onderbouwing', sectionId: 'sec-onderbouwing' }],
    });
  }

  const transformationScenario = ['transformeren', 'buy_transform_hold', 'buy_transform_sell'].includes(String(scenario.strategy_type));
  if (transformationScenario && c.costs.length === 0 && componentDevelopmentKinds(sellOffUnits).size === 0) {
    out.push({
      level: 'warning', category: 'now', title: 'Transformatiekosten toevoegen',
      message: 'Dit transformatiescenario bevat nog geen transformatie- of ontwikkelkosten.',
      actions: [{ label: 'Open bouwkosten', sectionId: 'sec-kosten' }, { label: 'Open componentstrategie', sectionId: 'sec-strategie' }],
    });
  }

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
    out.push({
      level: 'warning', category: 'now', title: 'Verkoopopbrengst toevoegen',
      message: 'Dit verkoopgerichte scenario heeft geen complete verkoopopbrengst. Vul een centrale verkoopprijs in of gebruik een complete componentstrategie.',
      actions: [{ label: 'Open verkoop en exit', sectionId: 'sec-verkoop' }, { label: 'Open componentstrategie', sectionId: 'sec-strategie' }],
    });
  }
  if (hasGrossSale && Number(rec.sale_costs_percentage ?? 0) === 0 && Number(rec.sale_other_costs ?? 0) === 0) {
    out.push({ level: 'info', category: 'later', title: 'Verkoopkosten controleren', message: 'Bij de centrale scenario-exit zijn geen makelaars- of overige verkoopkosten ingevuld.', actions: [{ label: 'Open verkoop en exit', sectionId: 'sec-verkoop' }] });
  }
  if (Number(rec.sale_exit_value_manual ?? 0) > 0) {
    out.push({ level: 'info', category: 'later', title: 'Handmatige exitwaarde onderbouwen', message: 'De handmatige exitwaarde is een waarderingsaanname en geen verkooptransactie. Onderbouw met bron, peildatum, broker opinion of vergelijkbare transacties.', actions: [{ label: 'Open verkoop en exit', sectionId: 'sec-verkoop' }] });
  }
  if (rec.bid_basis === 'verkoop'
    && Number(rec.sale_target_margin_amount ?? 0) === 0
    && Number(rec.sale_target_margin_percentage ?? 0) === 0
    && Number(rec.sale_target_roi_percentage ?? 0) === 0
    && Number(rec.sale_target_exit_value ?? 0) === 0) {
    out.push({
      level: 'warning', category: 'now', title: 'Doelwinst voor maximale bieding kiezen',
      message: 'De maximale bieding gebruikt verkoop als basis, maar er is geen doelwinst op GDV, winst op kosten, vaste doelwinst of target exitwaarde ingevuld.',
      actions: [{ label: 'Open doelstelling', sectionId: 'sec-verkoop' }],
    });
  }

  if (hasGrossSale && componentHasSale) {
    out.push({
      level: 'warning', category: 'now', title: 'Eén verkoopopbrengstbron kiezen',
      message: 'Zowel centrale scenario-verkoopwaarde als verkoopcomponenten zijn ingevuld. Kies één leidende opbrengstbron om dubbele invoer te voorkomen.',
      actions: [{ label: 'Open verkoop en exit', sectionId: 'sec-verkoop' }, { label: 'Open componentstrategie', sectionId: 'sec-strategie' }],
    });
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
