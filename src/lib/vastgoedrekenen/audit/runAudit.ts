// Hoofdfunctie voor de Vastgoedrekenen Audit & Diagnostics laag.
// Loopt alle controles langs en levert één AuditReport.
//
// IMPORTANT: Deze module verandert geen rekenlogica. Hij leest alleen
// scenariodata en outputs en vergelijkt ze tegen verwachtingen.

import type { Scenario, Component, ScenarioCost, WwsUnit, SellOffUnit, TaxSettings, ComputedOutputs } from '../types';
import { computeScenario } from '../compute';
import { computeComponentStrategy } from '../componentStrategy';
import type { PropertyAssumptionType } from '../profiles';
import type { AuditCheck, AuditReport, AuditStatus, AuditCategory } from './types';
import { buildSourcesOfTruth } from './sourcesOfTruth';
import { buildMaxBidExplain } from './maxBidExplain';
import { runHinthamerCheck } from './hinthamerstraat';
import { suggestWwsMode, getEffectiveWwsMode, WWS_MODE_LABEL } from '../wws/mode';

const num = (v: unknown): number => {
  const x = Number(v ?? 0);
  return Number.isFinite(x) ? x : 0;
};

const SECTIONS = {
  save: 'Save-state',
  obj: 'Objectdata',
  scen: 'Scenario-instellingen',
  comp: 'Componenten',
  wmap: 'Componenten → WWS',
  smap: 'Componenten → Strategie',
  rent: 'Huur & exploitatie',
  wws: 'WWS',
  ovb: 'OVB',
  cost: 'Kosten',
  exit: 'Verkoop / exit',
  strat: 'Componentstrategie',
  eng: 'Rekenengine',
  snap: 'Snapshot & vergelijking',
  bid: 'Maximale bieding',
  doable: 'Rond te rekenen',
  dub: 'Dubbele tellingen',
  ond: 'Onderbouwing',
  fmt: 'NL-formattering',
};

export interface AuditInput {
  scenario: Scenario;
  components: Component[];
  costs: ScenarioCost[];
  wwsUnits: WwsUnit[];
  strategyUnits: SellOffUnit[];
  taxSettings: TaxSettings | null;
  objectType: 'enkelvoudig' | 'mixed_use';
  objectArea: number | null;
  objectWoz?: number | null;
  objectEnergyLabel?: string | null;
  objectBouwjaar?: number | null;
  objectTitle?: string | null;
  objectAddress?: string | null;
  objectAskingPrice?: number | null;
  propertyType?: PropertyAssumptionType;
  dirty?: boolean;
  hasUnsavedCosts?: boolean;
  /** Outputs zoals nu in de UI getoond (draft). Optioneel. */
  uiOutputs?: ComputedOutputs;
}

function add(checks: AuditCheck[], c: { id: string; category: AuditCategory; status: AuditStatus; section: string; record?: string; field?: string; problem: string; advice?: string; technical?: string }) {
  checks.push(c);
}

export function runScenarioAudit(input: AuditInput): AuditReport {
  const checks: AuditCheck[] = [];
  const { scenario, components, costs, wwsUnits, strategyUnits, taxSettings, objectType, objectArea } = input;
  const rec = scenario as unknown as Record<string, unknown>;

  // --- Centrale recompute op opgeslagen scenariodata ---
  const computed: ComputedOutputs = computeScenario({
    scenario, components, costs, wwsUnits, strategyUnits, taxSettings,
    objectType, objectArea,
    objectWoz: input.objectWoz, objectEnergyLabel: input.objectEnergyLabel, objectBouwjaar: input.objectBouwjaar,
    propertyType: input.propertyType,
  });

  // ===== A. SAVE-STATE =====
  add(checks, {
    id: 'save-dirty',
    category: 'save_state',
    status: input.dirty ? 'warning' : 'ok',
    section: SECTIONS.save,
    problem: input.dirty ? 'Er zijn lokale wijzigingen die nog niet zijn opgeslagen.' : 'Alle wijzigingen zijn opgeslagen.',
    advice: input.dirty ? 'Klik op "Opslaan" voordat je het auditrapport deelt of exporteert.' : undefined,
  });
  if (input.hasUnsavedCosts) {
    add(checks, {
      id: 'save-cost-draft',
      category: 'save_state',
      status: 'warning',
      section: SECTIONS.cost,
      problem: 'Kostenposten staan in draft en zijn nog niet weggeschreven.',
      advice: 'Sla het scenario op zodat ScenarioVergelijking en Deal Snapshot dezelfde data zien.',
    });
  }
  if (input.uiOutputs && Math.round(input.uiOutputs.maximumBid) !== Math.round(computed.maximumBid)) {
    add(checks, {
      id: 'save-stale-output',
      category: 'save_state',
      status: 'warning',
      section: SECTIONS.snap,
      problem: 'De live UI-output en de op-database-data berekende output verschillen.',
      advice: 'Opslaan zodat ScenarioVergelijking en Deal Snapshot de juiste waarden tonen.',
      technical: `UI maxBid=${input.uiOutputs.maximumBid} · DB maxBid=${computed.maximumBid}`,
    });
  }

  // ===== B. OBJECTDATA =====
  add(checks, {
    id: 'obj-asking',
    category: 'object_data',
    status: num(scenario.asking_price) > 0 ? 'ok' : 'warning',
    section: SECTIONS.obj,
    problem: num(scenario.asking_price) > 0 ? 'Vraagprijs aanwezig in scenario.' : 'Vraagprijs ontbreekt in scenario.',
    advice: num(scenario.asking_price) === 0 ? 'Vul scenario.asking_price om verschil-met-vraagprijs te berekenen.' : undefined,
  });
  add(checks, {
    id: 'obj-area',
    category: 'object_data',
    status: (objectArea ?? 0) > 0 ? 'ok' : 'warning',
    section: SECTIONS.obj,
    problem: (objectArea ?? 0) > 0 ? `Object-oppervlakte (GBO) bekend: ${objectArea} m².` : 'Object-oppervlakte ontbreekt.',
    advice: (objectArea ?? 0) === 0 ? 'Zonder GBO geen €/m²-KPI\'s en geen kosten per m².' : undefined,
  });
  add(checks, {
    id: 'obj-woz',
    category: 'object_data',
    status: input.objectWoz ? 'ok' : 'warning',
    section: SECTIONS.obj,
    problem: input.objectWoz ? 'WOZ-waarde bekend.' : 'WOZ-waarde ontbreekt — relevant voor WWS-punten.',
  });
  add(checks, {
    id: 'obj-label',
    category: 'object_data',
    status: input.objectEnergyLabel ? 'ok' : 'warning',
    section: SECTIONS.obj,
    problem: input.objectEnergyLabel ? `Energielabel: ${input.objectEnergyLabel}.` : 'Energielabel ontbreekt.',
  });

  // ===== C. SCENARIO-INSTELLINGEN =====
  add(checks, {
    id: 'scen-strategy',
    category: 'scenario_settings',
    status: scenario.strategy_type ? 'ok' : 'error',
    section: SECTIONS.scen,
    problem: scenario.strategy_type ? `Strategie: ${scenario.strategy_type}.` : 'Geen strategie gekozen.',
  });
  add(checks, {
    id: 'scen-targetbar',
    category: 'scenario_settings',
    status: num(scenario.target_bar) > 0 ? 'ok' : 'warning',
    section: SECTIONS.scen,
    problem: num(scenario.target_bar) > 0 ? `Gewenste BAR: ${num(scenario.target_bar).toFixed(2)}%.` : 'Geen target_bar — biedingsadvies valt terug op default.',
  });
  add(checks, {
    id: 'scen-profile',
    category: 'scenario_settings',
    status: scenario.assumption_profile ? 'ok' : 'warning',
    section: SECTIONS.scen,
    problem: scenario.assumption_profile ? `Aannameprofiel: ${scenario.assumption_profile}.` : 'Geen aannameprofiel — exploitatiepercentages onbepaald.',
  });

  // ===== D. COMPONENTEN =====
  if (components.length === 0) {
    add(checks, {
      id: 'comp-none',
      category: 'components',
      status: objectType === 'mixed_use' ? 'error' : 'warning',
      section: SECTIONS.comp,
      problem: 'Geen componenten geregistreerd.',
      advice: objectType === 'mixed_use' ? 'Mixed-use objecten zonder componenten kunnen geen OVB-toerekening en geen WWS-mapping uitvoeren.' : 'Componenten zijn optioneel voor enkelvoudige objecten maar aanbevolen.',
    });
  } else {
    add(checks, {
      id: 'comp-count',
      category: 'components',
      status: 'ok',
      section: SECTIONS.comp,
      problem: `${components.length} component(en) aanwezig.`,
    });
    for (const c of components) {
      const r = c as unknown as Record<string, unknown>;
      const label = c.component_name?.trim() || 'Naamloze component';
      const missing: string[] = [];
      if (!num(c.surface_gbo) && !num(c.surface_vvo) && !num(c.surface_bvo)) missing.push('oppervlakte');
      if (!num(c.current_monthly_rent) && !num(c.current_annual_rent) && !num(c.market_monthly_rent)) missing.push('huur');
      if (!num(r.woz_value)) missing.push('WOZ');
      if (!r.energy_label) missing.push('energielabel');
      if (missing.length > 0) {
        add(checks, {
          id: `comp-missing-${c.id}`,
          category: 'components',
          status: 'warning',
          section: SECTIONS.comp,
          record: label,
          problem: `Ontbrekende velden: ${missing.join(', ')}.`,
        });
      }
    }
  }

  // ===== E. COMPONENTEN → WWS =====
  const woonComps = components.filter((c) => ['woning', 'appartement', 'studio', 'kamer'].includes((c.component_type ?? '').toLowerCase()));
  if (woonComps.length > 0) {
    add(checks, {
      id: 'wmap-count',
      category: 'wws_mapping',
      status: wwsUnits.length >= woonComps.length ? 'ok' : 'warning',
      section: SECTIONS.wmap,
      problem: `${woonComps.length} wooncomponent(en) gevonden, ${wwsUnits.length} WWS-unit(s) aanwezig.`,
      advice: wwsUnits.length < woonComps.length ? 'Gebruik "Genereer WWS uit componenten" om mapping te voltooien.' : undefined,
    });
    let missArea = 0, missWoz = 0, missLabel = 0, missRent = 0;
    for (const u of wwsUnits) {
      if (!num(u.living_area_m2)) missArea++;
      if (!num(u.woz_value)) missWoz++;
      if (!u.energy_label) missLabel++;
      if (!num(u.current_monthly_rent) && !num(u.corrected_monthly_rent) && !num(u.wws_max_monthly_rent)) missRent++;
    }
    const wwsFieldSummary = [
      missArea > 0 ? `${missArea}× oppervlakte` : null,
      missRent > 0 ? `${missRent}× huur` : null,
      missWoz > 0 ? `${missWoz}× WOZ` : null,
      missLabel > 0 ? `${missLabel}× energielabel` : null,
    ].filter(Boolean);
    if (wwsFieldSummary.length > 0) {
      add(checks, {
        id: 'wmap-incompleet',
        category: 'wws_mapping',
        status: missArea > 0 || missRent > 0 ? 'error' : 'warning',
        section: SECTIONS.wmap,
        problem: `Onvolledige WWS-units: ${wwsFieldSummary.join(', ')}.`,
        advice: 'Vul ontbrekende velden of pas componentmapping aan zodat surface_gbo, current_monthly_rent, woz en label worden doorgezet.',
      });
    }
  } else {
    add(checks, {
      id: 'wmap-na',
      category: 'wws_mapping',
      status: 'na',
      section: SECTIONS.wmap,
      problem: 'Geen wooncomponenten — WWS-mapping niet van toepassing.',
    });
  }

  // ===== F. COMPONENTEN → COMPONENTSTRATEGIE =====
  if (components.length > 0) {
    const importedIds = new Set(strategyUnits.map((u) => (u as unknown as { component_id?: string }).component_id).filter(Boolean));
    const notImported = components.filter((c) => !importedIds.has(c.id));
    add(checks, {
      id: 'smap-count',
      category: 'strategy_mapping',
      status: notImported.length === 0 ? 'ok' : strategyUnits.length === 0 ? 'warning' : 'warning',
      section: SECTIONS.smap,
      problem: strategyUnits.length === 0
        ? 'Geen componentstrategie aangemaakt.'
        : notImported.length > 0
          ? `${notImported.length} component(en) nog niet geïmporteerd in componentstrategie.`
          : 'Alle componenten zijn geïmporteerd.',
      advice: strategyUnits.length === 0 ? 'Gebruik "Importeer uit componenten" om strategie-units te genereren.' : undefined,
    });
    for (const u of strategyUnits) {
      const r = u as unknown as Record<string, unknown>;
      const label = String(r.unit_label ?? r.unit_name ?? 'Unit');
      const st = String(r.strategy ?? '');
      const isSale = ['verkopen_leeg', 'verkopen_verhuurd', 'renoveren_verkopen', 'splitsen_verkopen', 'transformeren_verkopen'].includes(st);
      const isHold = ['aanhouden', 'renoveren_aanhouden', 'transformeren_aanhouden'].includes(st);
      if (!st || st === 'later_beslissen') {
        add(checks, {
          id: `smap-pending-${u.id}`,
          category: 'strategy_mapping',
          status: 'warning',
          section: SECTIONS.smap,
          record: label,
          problem: 'Nog geen definitieve strategie gekozen.',
        });
      }
      if (isSale && !num(r.sale_price_total) && !num(r.sale_price_per_m2)) {
        add(checks, {
          id: `smap-sale-${u.id}`,
          category: 'strategy_mapping',
          status: 'error',
          section: SECTIONS.smap,
          record: label,
          problem: 'Verkoopwaarde ontbreekt.',
        });
      }
      if (isHold) {
        if (!num(r.hold_monthly_rent) && !num(r.hold_annual_rent)) {
          add(checks, {
            id: `smap-holdrent-${u.id}`,
            category: 'strategy_mapping',
            status: 'error',
            section: SECTIONS.smap,
            record: label,
            problem: 'Huur ontbreekt voor aanhouden.',
          });
        }
        const valMethod = String(r.hold_valuation_method ?? 'BAR');
        const valMissing =
          (valMethod === 'BAR' && !num(r.hold_bar)) ||
          (valMethod === 'NAR' && !num(r.hold_nar)) ||
          (valMethod === 'factor' && !num(r.hold_factor));
        if (valMissing) {
          add(checks, {
            id: `smap-holdval-${u.id}`,
            category: 'strategy_mapping',
            status: 'error',
            section: SECTIONS.smap,
            record: label,
            problem: `Waarderingsmethode "${valMethod}" gekozen maar bijbehorend tarief/factor ontbreekt.`,
          });
        }
      }
    }
  } else {
    add(checks, { id: 'smap-na', category: 'strategy_mapping', status: 'na', section: SECTIONS.smap, problem: 'Geen componenten — strategiemapping niet van toepassing.' });
  }

  // ===== G+H. HUURBRON & WWS =====
  const rentSource = (scenario.rent_source as string | null) ?? 'handmatig';
  const manualRent = num(scenario.current_monthly_rent) + num(scenario.market_monthly_rent) + num(scenario.manual_corrected_monthly_rent);
  const compRent = components.reduce((s, c) => s + num(c.current_monthly_rent) + num(c.market_monthly_rent), 0);
  add(checks, {
    id: 'rent-active',
    category: 'rent_source',
    status: 'ok',
    section: SECTIONS.rent,
    problem: `Actieve huurbron: ${rentSource}.`,
  });
  if (rentSource === 'componenten' && compRent === 0) {
    add(checks, {
      id: 'rent-comp-empty',
      category: 'rent_source',
      status: 'error',
      section: SECTIONS.rent,
      problem: '"Som van componenten" gekozen maar componenten hebben geen huur.',
    });
  }
  if (rentSource !== 'handmatig' && rentSource !== 'handmatig_gecorrigeerd' && manualRent > 0 && rentSource === 'componenten' && compRent > 0) {
    add(checks, {
      id: 'rent-dual',
      category: 'rent_source',
      status: 'warning',
      section: SECTIONS.rent,
      problem: 'Zowel handmatige scenario-huur als componenthuur is gevuld. Bron "componenten" is leidend; controleer of dit bewust is.',
    });
  }
  if (rentSource === 'wws_gecorrigeerd' && wwsUnits.length === 0) {
    add(checks, {
      id: 'rent-wws-missing',
      category: 'rent_source',
      status: 'error',
      section: SECTIONS.rent,
      problem: 'WWS-gecorrigeerde huur gekozen maar geen WWS-units aanwezig.',
      advice: 'Maak WWS-units aan of kies een andere huurbron.',
    });
  }
  add(checks, {
    id: 'wws-segments',
    category: 'wws',
    status: wwsUnits.some((u) => num(u.wws_points) > 0 && num(u.wws_points) < 187) ? 'warning' : 'ok',
    section: SECTIONS.wws,
    problem: wwsUnits.some((u) => num(u.wws_points) > 0 && num(u.wws_points) < 187)
      ? 'Eén of meer WWS-units in middenhuur-/sociaal-zone.'
      : wwsUnits.length === 0 ? 'Geen WWS-units.' : 'WWS-units allemaal in vrije sector of zonder punten.',
  });

  // Per-unit transparantie: bron / stelsel / beleidsversie / ontbrekende velden — gegroepeerd
  if (wwsUnits.length > 0) {
    add(checks, {
      id: 'wws-policy-version',
      category: 'wws',
      status: 'warning',
      section: SECTIONS.wws,
      problem: 'WWS-puntenberekening gebruikt interne V1 (indicatief). Geen volledige Huurcommissie-systematiek.',
      advice: 'Gebruik dit alleen voor segmentindicatie. Voer voor harde biedingen een officiële Huurcommissie-check uit.',
    });
    const noPoints = wwsUnits.filter((u) => u.wws_points == null);
    const noWoz = wwsUnits.filter((u) => !num(u.woz_value));
    const noLabel = wwsUnits.filter((u) => !u.energy_label);
    const noScheme = wwsUnits.filter((u) => (u as unknown as Record<string, unknown>).independent_unit == null);
    if (noPoints.length > 0) {
      add(checks, { id: 'wws-grp-points', category: 'wws', status: 'error', section: SECTIONS.wws,
        problem: `${noPoints.length}× WWS-punten ontbreken — segment kan niet bepaald worden.`,
        advice: 'Vul punten in of bewerk een veld zodat CRM ze (her)berekent.' });
    }
    if (noWoz.length > 0) {
      add(checks, { id: 'wws-grp-woz', category: 'wws', status: 'warning', section: SECTIONS.wws,
        problem: `${noWoz.length}× WOZ-waarde ontbreekt — punten zijn lager dan reëel.` });
    }
    if (noLabel.length > 0) {
      add(checks, { id: 'wws-grp-label', category: 'wws', status: 'warning', section: SECTIONS.wws,
        problem: `${noLabel.length}× energielabel ontbreekt — labelpunten staan op 0.` });
    }
    if (noScheme.length > 0) {
      add(checks, { id: 'wws-grp-scheme', category: 'wws', status: 'warning', section: SECTIONS.wws,
        problem: `${noScheme.length}× stelseltype (zelfstandig/onzelfstandig) niet gekozen — formule kan afwijken.` });
    }
  }

  // ===== H2. WWS-MODUS PER UNIT =====
  {
    const modeCtx = { scenario, components, strategyUnits, wwsUnits };
    const scenarioSuggestion = suggestWwsMode(modeCtx);
    add(checks, {
      id: 'wws-mode-suggested',
      category: 'wws',
      status: 'ok',
      section: SECTIONS.wws,
      problem: `Voorgestelde WWS-modus voor dit scenario: ${WWS_MODE_LABEL[scenarioSuggestion.mode]}.`,
      advice: scenarioSuggestion.reasons.join(' '),
    });

    const rentSourceForMode = String(scenario.rent_source ?? 'handmatig');
    if (rentSourceForMode === 'wws_gecorrigeerd') {
      const offMode = wwsUnits.filter((u) => getEffectiveWwsMode(u, modeCtx).mode !== 'volledig_vereist');
      if (offMode.length > 0) {
        add(checks, { id: 'wws-mode-wwscorr-grp', category: 'wws', status: 'error', section: SECTIONS.wws,
          problem: `${offMode.length}× WWS-gecorrigeerde huur gekozen maar unit staat niet op "Volledig vereist".`,
          advice: 'Zet WWS-modus op "Volledig vereist" of kies een andere huurbron.' });
      }
    }

    const fullMissing: string[] = [];
    const indMissing: string[] = [];
    let naRent = 0;
    for (const u of wwsUnits) {
      const eff = getEffectiveWwsMode(u, modeCtx);
      const r = u as unknown as Record<string, unknown>;
      const m: string[] = [];
      if (!num(u.woz_value)) m.push('WOZ');
      if (!u.energy_label) m.push('energielabel');
      if (u.wws_points == null) m.push('WWS-punten');
      if (r.independent_unit == null) m.push('stelsel');
      if (eff.mode === 'volledig_vereist' && m.length > 0) fullMissing.push(`${u.unit_name?.trim() || 'unit'}: ${m.join(', ')}`);
      if (eff.mode === 'indicatief') {
        const mi = m.filter((x) => x === 'WOZ' || x === 'energielabel');
        if (mi.length > 0) indMissing.push(`${u.unit_name?.trim() || 'unit'}: ${mi.join(', ')}`);
      }
      if (eff.mode === 'niet_nodig' && num(u.current_monthly_rent) > 0) naRent++;
    }
    if (fullMissing.length > 0) {
      add(checks, { id: 'wws-mode-full-missing-grp', category: 'wws', status: 'error', section: SECTIONS.wws,
        problem: `${fullMissing.length}× modus "Volledig vereist" met ontbrekende velden.`,
        advice: 'Vul de ontbrekende velden of voer een officiële Huurcommissie-check uit.',
        technical: fullMissing.slice(0, 8).join(' · ') + (fullMissing.length > 8 ? ` …+${fullMissing.length - 8}` : ''),
      });
    }
    if (indMissing.length > 0) {
      add(checks, { id: 'wws-mode-ind-missing-grp', category: 'wws', status: 'warning', section: SECTIONS.wws,
        problem: `${indMissing.length}× modus "Indicatief" mist WOZ/energielabel — segmentindicatie kan afwijken.`,
        technical: indMissing.slice(0, 8).join(' · ') + (indMissing.length > 8 ? ` …+${indMissing.length - 8}` : ''),
      });
    }
    if (naRent > 0) {
      add(checks, { id: 'wws-mode-na-rent-grp', category: 'wws', status: 'warning', section: SECTIONS.wws,
        problem: `${naRent}× WWS-modus "Niet nodig" met woonhuur gevuld.`,
        advice: 'Zet de modus op "Indicatief" of "Volledig vereist" als deze huur meegerekend moet worden.' });
    }
  }

  // ===== I. OVB =====
  const ovbMode = scenario.ovb_mode ?? 'auto';
  add(checks, {
    id: 'ovb-mode',
    category: 'ovb',
    status: 'ok',
    section: SECTIONS.ovb,
    problem: `OVB-modus: ${ovbMode}. Berekend OVB-bedrag: € ${Math.round(computed.totalTransferTax).toLocaleString('nl-NL')}.`,
  });
  if (objectType === 'mixed_use' && ovbMode !== 'per_component') {
    add(checks, {
      id: 'ovb-mixed',
      category: 'ovb',
      status: 'warning',
      section: SECTIONS.ovb,
      problem: 'Mixed-use object zonder OVB-toerekening per component.',
      advice: 'Zet ovb_mode op "per_component" voor scherpere toerekening.',
    });
  }
  if (ovbMode === 'per_component') {
    const missing = components.filter((c) => !c.transfer_tax_classification && !c.transfer_tax_manual_override && !num(c.allocated_component_value));
    if (missing.length > 0) {
      add(checks, {
        id: 'ovb-percomp',
        category: 'ovb',
        status: 'warning',
        section: SECTIONS.ovb,
        problem: `${missing.length} component(en) zonder OVB-classificatie of toerekeningsbasis.`,
        advice: 'Vul classificatie of allocated_component_value in per component, anders valt OVB terug op m²-verdeling.',
      });
    }
    if (computed.ovbMissingBasisCount > 0) {
      const isMixed = objectType === 'mixed_use';
      add(checks, {
        id: 'ovb-basis-missing',
        category: 'ovb',
        status: isMixed ? 'error' : 'warning',
        section: SECTIONS.ovb,
        problem: `OVB per component: ${computed.ovbMissingBasisCount} component(en) zonder bruikbare grondslag — OVB komt daar stilletjes op € 0.`,
        advice: 'Vul "Toegerekende waarde" in, kies "Op m²", "Uit componentstrategie" of voer een handmatig OVB-bedrag in.',
        technical: computed.ovbPerComponent
          .filter((p) => p.missingValueBasis || p.missingStrategyBasis || p.missingManualAmount)
          .map((p) => `${p.id}: ${p.basisMethod}${p.missingValueBasis ? ' (waarde ontbreekt)' : ''}${p.missingStrategyBasis ? ' (strategie ontbreekt)' : ''}${p.missingManualAmount ? ' (bedrag ontbreekt)' : ''}`)
          .join(' · '),
      });
    }
  }
  if (ovbMode !== 'manual' && num(scenario.transfer_tax_amount) > 0) {
    add(checks, {
      id: 'ovb-alt',
      category: 'ovb',
      status: 'warning',
      section: SECTIONS.ovb,
      problem: 'Handmatig OVB-bedrag is gevuld maar mode is niet "manual" — bedrag wordt genegeerd.',
    });
  }

  // ===== J. KOSTEN =====
  if (costs.length === 0) {
    add(checks, {
      id: 'cost-none',
      category: 'costs',
      status: 'warning',
      section: SECTIONS.cost,
      problem: 'Geen kostenposten — projectkosten worden op € 0 gezet.',
    });
  } else {
    const indicatief = costs.filter((c) => c.reliability_status !== 'hoog');
    if (indicatief.length > 0) {
      add(checks, {
        id: 'cost-indic',
        category: 'costs',
        status: 'warning',
        section: SECTIONS.cost,
        problem: `${indicatief.length} kostenpost(en) met betrouwbaarheid lager dan "hoog".`,
        advice: 'Onderbouw of vervang met offertes voordat je hard biedt.',
      });
    }

    // Btw-behandeling audit: posten met bedrag > 0 maar behandeling 'geen' (default backwards-compat).
    const unforeseenPct = num(rec.unforeseen_percentage);
    let totalIncludedVat = 0;
    let totalInformationalVat = 0;
    const undecided: string[] = [];
    for (const cost of costs) {
      const cr = cost as unknown as Record<string, unknown>;
      const treatment = (cr.vat_treatment as string | null) ?? 'geen';
      const eff = num(cost.amount);
      if (eff > 0 && treatment === 'geen') undecided.push(cost.cost_category || 'Kostenpost');
      const subtotal = eff + Math.round((eff * unforeseenPct) / 100);
      const rate = treatment === 'pct_9' ? 9 : treatment === 'handmatig' ? (num(cr.vat_percentage) || 21) : 21;
      totalInformationalVat += Math.round((subtotal * rate) / 100);
      if (treatment === 'pct_21') totalIncludedVat += Math.round((subtotal * 21) / 100);
      else if (treatment === 'pct_9') totalIncludedVat += Math.round((subtotal * 9) / 100);
      else if (treatment === 'handmatig') {
        const manual = num(cr.vat_amount_manual);
        totalIncludedVat += manual !== 0 ? manual : Math.round((subtotal * num(cr.vat_percentage)) / 100);
      }
    }
    add(checks, {
      id: 'cost-vat-summary',
      category: 'costs',
      status: 'ok',
      section: SECTIONS.cost,
      problem: `Btw informatief: € ${totalInformationalVat.toLocaleString('nl-NL')} · Btw meegenomen in investering: € ${totalIncludedVat.toLocaleString('nl-NL')}.`,
    });
    if (undecided.length > 0) {
      add(checks, {
        id: 'cost-vat-undecided',
        category: 'costs',
        status: 'warning',
        section: SECTIONS.cost,
        problem: `${undecided.length} kostenpost(en) zonder expliciete btw-behandeling (default "geen btw").`,
        advice: 'Kies per kostenpost: niet verrekenbaar (incl. btw), volledig verrekenbaar (excl. btw), deels of geen btw. Bij mixed-use is handmatige beoordeling vereist.',
      });
    }
    if (objectType === 'mixed_use') {
      const anyExplicit = costs.some((c) => {
        const t = (c as unknown as Record<string, unknown>).vat_treatment as string | null;
        return t === 'handmatig' || t === 'verrekenbaar';
      });
      if (!anyExplicit && costs.length > 0) {
        add(checks, {
          id: 'cost-vat-mixed-use',
          category: 'costs',
          status: 'warning',
          section: SECTIONS.cost,
          problem: 'Mixed-use object zonder deels-verrekenbare of verrekenbare btw-keuze.',
          advice: 'Beoordeel fiscaal hoe btw verdeeld is over woon- en commerciële delen.',
        });
      }
    }
  }

  // ===== K. EXIT =====
  const sStrat = rec.sale_strategy as string | null;
  if (sStrat && sStrat !== 'geen_verkoop') {
    if (!num(rec.sale_price_total) && !num(rec.sale_price_per_m2) && !num(rec.sale_exit_value_manual)) {
      add(checks, {
        id: 'exit-noprice',
        category: 'exit',
        status: 'error',
        section: SECTIONS.exit,
        problem: 'Verkoopstrategie gekozen maar geen prijs of exitwaarde ingevuld.',
      });
    } else {
      add(checks, {
        id: 'exit-ok',
        category: 'exit',
        status: 'ok',
        section: SECTIONS.exit,
        problem: `Verkoopstrategie: ${sStrat}. Bruto opbrengst: € ${(computed.grossSaleProceeds ?? 0).toLocaleString('nl-NL')}.`,
      });
    }
  } else {
    add(checks, { id: 'exit-na', category: 'exit', status: 'na', section: SECTIONS.exit, problem: 'Geen verkoopstrategie op scenario-niveau.' });
  }

  // ===== L. STRATEGIE-MIX =====
  if (strategyUnits.length > 0) {
    add(checks, {
      id: 'strat-mix',
      category: 'strategy_mix',
      status: 'ok',
      section: SECTIONS.strat,
      problem: `Strategie-mix: ${computed.strategyMix || '—'}. Scenariowaarde: € ${Math.round(computed.scenarioValue).toLocaleString('nl-NL')}.`,
    });
  } else {
    add(checks, { id: 'strat-na', category: 'strategy_mix', status: 'na', section: SECTIONS.strat, problem: 'Geen componentstrategie aangemaakt.' });
  }

  // €/m² inzicht componentstrategie + waarschuwing bij ontbrekende m²
  if (strategyUnits.length > 0) {
    let totalVal = 0; let totalM2 = 0; let missM2 = 0;
    for (const u of strategyUnits) {
      const r = u as unknown as Record<string, unknown>;
      const calc = computeComponentStrategy(u).contribution;
      const m2 = num(r.surface_gbo) || num(r.surface_vvo);
      if (calc > 0 && m2 > 0) { totalVal += calc; totalM2 += m2; }
      else if (calc > 0 && m2 <= 0) missM2++;
    }
    const avg = totalM2 > 0 ? Math.round(totalVal / totalM2) : 0;
    if (avg > 0) {
      add(checks, { id: 'strat-eur-m2', category: 'strategy_mix', status: 'ok', section: SECTIONS.strat,
        problem: `Gem. prijs/m² strategie: € ${avg.toLocaleString('nl-NL')}/m² (totaal € ${totalVal.toLocaleString('nl-NL')} / ${totalM2.toLocaleString('nl-NL')} m²).` });
    }
    if (missM2 > 0) {
      add(checks, { id: 'strat-missing-m2', category: 'strategy_mix', status: 'warning', section: SECTIONS.strat,
        problem: `${missM2}× unit met bijdrage maar zonder m² — €/m² niet berekenbaar.`,
        advice: 'Vul surface_gbo/vvo aan zodat €/m² zichtbaar wordt.' });
    }
  }

  // ===== M. ENGINE =====
  const isSaleAssessment = computed.assessmentType === 'verkoop' || computed.leadingMaxBasis === 'verkoop' || computed.leadingMaxBasis === 'strategie';
  if (isSaleAssessment && computed.noi <= 0 && computed.correctedAnnualRent <= 0) {
    add(checks, {
      id: 'eng-noi',
      category: 'engine',
      status: 'na',
      section: SECTIONS.eng,
      problem: 'NOI/BAR/NAR: niet relevant voor dit scenario (verkoop- of strategie-spoor leidend, geen huurbasis).',
    });
  } else {
    add(checks, {
      id: 'eng-noi',
      category: 'engine',
      status: computed.noi > 0 ? 'ok' : 'warning',
      section: SECTIONS.eng,
      problem: `NOI: € ${Math.round(computed.noi).toLocaleString('nl-NL')} · BAR (TI): ${computed.barTotalInvestment != null ? `${computed.barTotalInvestment.toFixed(2)}%` : '—'} · NAR: ${computed.narTotalInvestment != null ? `${computed.narTotalInvestment.toFixed(2)}%` : '—'}.`,
    });
  }
  add(checks, {
    id: 'eng-bid',
    category: 'engine',
    status: computed.leadingMaxValue > 0 ? 'ok' : 'warning',
    section: SECTIONS.eng,
    problem: `Leidende max prijs: € ${Math.round(computed.leadingMaxValue).toLocaleString('nl-NL')} (${computed.leadingMaxBasisLabel}).`,
  });

  // ===== N+O. SNAPSHOT-CONSISTENTIE =====
  add(checks, {
    id: 'snap-engine',
    category: 'snapshot',
    status: 'ok',
    section: SECTIONS.snap,
    problem: 'Deal Snapshot, ScenarioVergelijking en ScenarioEditor delen één computeScenario-bron.',
    technical: 'computeScenario(ctx) → ComputedOutputs. Geen alternatieve rekenpaden geconstateerd.',
  });

  // ===== P. MAX BID =====
  add(checks, {
    id: 'bid-explain',
    category: 'max_bid',
    status: 'ok',
    section: SECTIONS.bid,
    problem: 'Stap-voor-stap onderbouwing zichtbaar in tabblad "Maximale bieding".',
  });

  // ===== Q. ROND TE REKENEN =====
  // Eén waarheid: gebruik altijd het leidende spoor (leadingMaxBasis/leadingMaxValue/leadingRoundsAtAsking).
  // Comparator: rondt rond → "≥ vraagprijs"; rondt niet rond → "< vraagprijs".
  {
    const asking = num(scenario.asking_price);
    const lead = computed.leadingMaxValue;
    const diffLead = Math.round(computed.leadingDifferenceWithAskingPrice);
    if (asking <= 0) {
      add(checks, { id: 'doable-no-asking', category: 'doable', status: 'na', section: SECTIONS.doable,
        problem: 'Geen vraagprijs ingevuld — "rond te rekenen" niet bepaalbaar.' });
    } else if (computed.leadingRoundsAtAsking === true) {
      add(checks, { id: 'doable-yes', category: 'doable', status: 'ok', section: SECTIONS.doable,
        problem: `Scenario is rond te rekenen op vraagprijs. Leidende basis: ${computed.leadingMaxBasisLabel} = € ${Math.round(lead).toLocaleString('nl-NL')} (≥ vraagprijs € ${asking.toLocaleString('nl-NL')}).`,
        technical: `leadingMaxBasis=${computed.leadingMaxBasis} · leadingMaxValue=${Math.round(lead)} · ruimte=€ ${diffLead.toLocaleString('nl-NL')}`,
      });
    } else {
      // Detecteer tegenstrijdige signalen tussen sporen — alleen als info, niet leidend.
      const altMax = computed.maxPurchasePrice != null ? computed.maxPurchasePrice : computed.maximumBid;
      const altDiff = Math.round((altMax ?? 0) - asking);
      const conflict = computed.strategyEnabled && altMax != null && (diffLead < 0) !== (altDiff < 0);
      add(checks, { id: 'doable-no', category: 'doable', status: 'warning', section: SECTIONS.doable,
        problem: `Scenario rekent NIET rond op vraagprijs. Leidende basis: ${computed.leadingMaxBasisLabel} = € ${Math.round(lead).toLocaleString('nl-NL')} (< vraagprijs € ${asking.toLocaleString('nl-NL')}, tekort € ${Math.abs(diffLead).toLocaleString('nl-NL')}).`,
        advice: conflict ? 'Informatief: een alternatief spoor toont een ander signaal, maar telt niet voor de conclusie — de leidende basis is bindend.' : undefined,
        technical: `leadingMaxBasis=${computed.leadingMaxBasis} · leadingMaxValue=${Math.round(lead)} · maxPurchasePrice=${computed.maxPurchasePrice} · maximumBid=${computed.maximumBid}`,
      });
    }
  }

  // ===== R. DUBBELE TELLINGEN =====
  if (sStrat && sStrat !== 'geen_verkoop' && strategyUnits.length > 0) {
    const trackChoice = computed.leadingValuationTrackChoice;
    const resolved = trackChoice !== 'auto';
    add(checks, {
      id: 'dub-exit',
      category: 'double_counting',
      status: resolved ? 'ok' : 'warning',
      section: SECTIONS.dub,
      problem: resolved
        ? `Scenario-level exit én componentstrategie zijn beide gevuld. Leidend spoor: ${computed.leadingMaxBasisLabel}. Alternatief spoor is informatief.`
        : 'Scenario-level exit én componentstrategie zijn beide actief zonder gekozen leidend spoor.',
      advice: resolved
        ? undefined
        : 'Kies "Leidend waarderingsspoor" in Verkoop / exit, of zet sale_strategy op "geen_verkoop" als componentstrategie leidend moet zijn.',
    });
  }
  if (rentSource === 'componenten' && manualRent > 0) {
    add(checks, {
      id: 'dub-rent',
      category: 'double_counting',
      status: 'warning',
      section: SECTIONS.dub,
      problem: 'Scenario-huur en componenthuur staan beide gevuld; bron "componenten" wordt gebruikt.',
    });
  }
  if (ovbMode !== 'manual' && num(scenario.transfer_tax_amount) > 0) {
    add(checks, {
      id: 'dub-ovb',
      category: 'double_counting',
      status: 'warning',
      section: SECTIONS.dub,
      problem: 'OVB-bedrag handmatig gevuld maar mode is auto/per_component.',
    });
  }

  // ===== S. ONDERBOUWING =====
  add(checks, {
    id: 'ond-reliability',
    category: 'onderbouwing',
    status: computed.inputReliability === 'hoog' ? 'ok' : computed.inputReliability === 'middel' ? 'warning' : 'warning',
    section: SECTIONS.ond,
    problem: `Input-betrouwbaarheid: ${computed.inputReliability}.`,
  });

  // ===== T. FORMATTERING (alleen info — nooit blokkerend) =====
  const fmtIssues: string[] = [];
  const checkText = (label: string, v: unknown) => {
    if (typeof v !== 'string') return;
    if (/\d+\.\d{3}/.test(v)) fmtIssues.push(`${label}: punt als duizendscheiding`);
  };
  checkText('notes', scenario.notes);
  checkText('description', scenario.description);
  add(checks, {
    id: 'fmt',
    category: 'formatting',
    status: 'ok', // formattering is informatief; opmerkingen worden enkel in tekst gemeld.
    section: SECTIONS.fmt,
    problem: fmtIssues.length === 0
      ? 'Geen formatteringsopmerkingen in vrije tekst.'
      : `Tip (informatief): ${fmtIssues.join('; ')}.`,
  });

  // ===== TESTCASE Hinthamerstraat =====
  checks.push(...runHinthamerCheck({
    objectTitle: input.objectTitle ?? null,
    objectAddress: input.objectAddress ?? null,
    components,
    strategyUnits,
  }));

  // ===== SAMENVATTING =====
  const summary = { ok: 0, warning: 0, error: 0, na: 0 };
  for (const c of checks) summary[c.status]++;
  const conclusion = summary.error > 0
    ? 'Scenario is nog niet betrouwbaar voor biedingsadvies. Los eerst de fouten op.'
    : summary.warning > 0
      ? 'Scenario is bruikbaar maar er zijn aandachtspunten. Controleer waarschuwingen.'
      : 'Scenario is consistent en bruikbaar voor biedingsadvies.';

  return {
    scenarioId: scenario.id,
    scenarioName: scenario.scenario_name ?? '—',
    generatedAt: new Date().toISOString(),
    checks,
    sourcesOfTruth: buildSourcesOfTruth({
      scenario, components, costs, wwsUnits, strategyUnits,
      object: { askingPrice: input.objectAskingPrice, areaGbo: objectArea },
      leading: { basis: computed.leadingMaxBasis, basisLabel: computed.leadingMaxBasisLabel, value: computed.leadingMaxValue },
    }),
    maxBidExplain: buildMaxBidExplain(scenario, computed),
    summary,
    conclusion,
  };
}
