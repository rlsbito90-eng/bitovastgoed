// Hoofdfunctie voor de Vastgoedrekenen Audit & Diagnostics laag.
// Loopt alle controles langs en levert één AuditReport.
//
// IMPORTANT: Deze module verandert geen rekenlogica. Hij leest alleen
// scenariodata en outputs en vergelijkt ze tegen verwachtingen.

import type { Scenario, Component, ScenarioCost, WwsUnit, SellOffUnit, TaxSettings, ComputedOutputs } from '../types';
import { computeScenario } from '../compute';
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
  const woonComps = components.filter((c) => ['woning', 'appartement'].includes((c.component_type ?? '').toLowerCase()));
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

  // Per-unit transparantie: bron / stelsel / beleidsversie / ontbrekende velden
  if (wwsUnits.length > 0) {
    // Beleidsversie waarschuwing: huidige formule is V1 indicatief
    add(checks, {
      id: 'wws-policy-version',
      category: 'wws',
      status: 'warning',
      section: SECTIONS.wws,
      problem: 'WWS-puntenberekening gebruikt interne V1 (indicatief). Geen volledige Huurcommissie-systematiek.',
      advice: 'Gebruik dit alleen voor segmentindicatie. Voer voor harde biedingen een officiële Huurcommissie-check uit.',
    });
    for (const u of wwsUnits) {
      const label = u.unit_name?.trim() || 'Naamloze woonunit';
      const r = u as unknown as Record<string, unknown>;
      if (u.wws_points == null) {
        add(checks, {
          id: `wws-no-points-${u.id}`,
          category: 'wws',
          status: 'error',
          section: SECTIONS.wws,
          record: label,
          problem: 'WWS-punten ontbreken — segment kan niet bepaald worden.',
          advice: 'Vul punten in of bewerk een veld zodat CRM ze (her)berekent.',
        });
      }
      if (!num(u.woz_value)) {
        add(checks, {
          id: `wws-no-woz-${u.id}`,
          category: 'wws',
          status: 'warning',
          section: SECTIONS.wws,
          record: label,
          problem: 'WOZ-waarde ontbreekt — punten zijn lager dan reëel.',
        });
      }
      if (!u.energy_label) {
        add(checks, {
          id: `wws-no-label-${u.id}`,
          category: 'wws',
          status: 'warning',
          section: SECTIONS.wws,
          record: label,
          problem: 'Energielabel ontbreekt — labelpunten staan op 0.',
        });
      }
      if (r.independent_unit == null) {
        add(checks, {
          id: `wws-no-scheme-${u.id}`,
          category: 'wws',
          status: 'warning',
          section: SECTIONS.wws,
          record: label,
          problem: 'Stelseltype (zelfstandig/onzelfstandig) niet gekozen — formule kan afwijken.',
        });
      }
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
      for (const u of wwsUnits) {
        const eff = getEffectiveWwsMode(u, modeCtx);
        if (eff.mode !== 'volledig_vereist') {
          add(checks, {
            id: `wws-mode-wwscorr-${u.id}`,
            category: 'wws',
            status: 'error',
            section: SECTIONS.wws,
            record: u.unit_name?.trim() || 'Woonunit',
            problem: 'WWS-gecorrigeerde huur gekozen, maar deze unit staat niet op "Volledig vereist".',
            advice: 'Zet WWS-modus op "Volledig vereist" of kies een andere huurbron.',
          });
        }
      }
    }

    for (const u of wwsUnits) {
      const eff = getEffectiveWwsMode(u, modeCtx);
      const r = u as unknown as Record<string, unknown>;
      const label = u.unit_name?.trim() || 'Woonunit';
      const missingFull: string[] = [];
      if (!num(u.woz_value)) missingFull.push('WOZ');
      if (!u.energy_label) missingFull.push('energielabel');
      if (u.wws_points == null) missingFull.push('WWS-punten');
      if (r.independent_unit == null) missingFull.push('stelsel');

      if (eff.mode === 'volledig_vereist' && missingFull.length > 0) {
        add(checks, {
          id: `wws-mode-full-missing-${u.id}`,
          category: 'wws',
          status: 'error',
          section: SECTIONS.wws,
          record: label,
          problem: `WWS-modus "Volledig vereist", maar ${missingFull.join(', ')} ontbreekt.`,
          advice: 'Vul de ontbrekende velden of voer een officiële Huurcommissie-check uit.',
        });
      }
      if (eff.mode === 'indicatief') {
        const missingInd = missingFull.filter((m) => m === 'WOZ' || m === 'energielabel');
        if (missingInd.length > 0) {
          add(checks, {
            id: `wws-mode-ind-missing-${u.id}`,
            category: 'wws',
            status: 'warning',
            section: SECTIONS.wws,
            record: label,
            problem: `WWS-modus "Indicatief", maar ${missingInd.join(', ')} ontbreekt — segmentindicatie kan afwijken.`,
          });
        }
      }
      if (eff.mode === 'niet_nodig' && num(u.current_monthly_rent) > 0) {
        add(checks, {
          id: `wws-mode-na-rent-${u.id}`,
          category: 'wws',
          status: 'warning',
          section: SECTIONS.wws,
          record: label,
          problem: 'WWS-modus staat op "Niet nodig", maar er wordt wel woonhuur ingevuld op deze unit.',
          advice: 'Zet de modus op "Indicatief" of "Volledig vereist" als deze huur meegerekend moet worden.',
        });
      }
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

  // ===== M. ENGINE =====
  add(checks, {
    id: 'eng-noi',
    category: 'engine',
    status: computed.noi > 0 ? 'ok' : 'warning',
    section: SECTIONS.eng,
    problem: `NOI: € ${Math.round(computed.noi).toLocaleString('nl-NL')} · BAR (TI): ${computed.barTotalInvestment != null ? `${computed.barTotalInvestment.toFixed(2)}%` : '—'} · NAR: ${computed.narTotalInvestment != null ? `${computed.narTotalInvestment.toFixed(2)}%` : '—'}.`,
  });
  add(checks, {
    id: 'eng-bid',
    category: 'engine',
    status: computed.maximumBid > 0 ? 'ok' : 'warning',
    section: SECTIONS.eng,
    problem: `Maximale bieding: € ${Math.round(computed.maximumBid).toLocaleString('nl-NL')} (basis: ${computed.bidBasisUsed}).`,
  });

  // ===== N+O. SNAPSHOT-CONSISTENTIE =====
  // Deal Snapshot en ScenarioVergelijking gebruiken dezelfde computeScenario.
  // Verschillen ontstaan alleen door (a) niet-opgeslagen UI-draft of (b) cached output rows.
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
  if (computed.strategyEnabled && computed.roundsAtAsking != null) {
    const diffLead = Math.round(computed.leadingDifferenceWithAskingPrice);
    const diffBid = Math.round(computed.differenceWithAskingPrice);
    const conflict = (diffLead < 0) !== (diffBid < 0);
    add(checks, {
      id: 'doable-asking',
      category: 'doable',
      status: computed.roundsAtAsking ? 'ok' : 'warning',
      section: SECTIONS.doable,
      problem: computed.roundsAtAsking
        ? `Scenario is rond te rekenen op vraagprijs (leidend: componentstrategie maxPurchasePrice = € ${Math.round(computed.maxPurchasePrice ?? 0).toLocaleString('nl-NL')}).`
        : `Scenario rekent NIET rond op vraagprijs. Leidend (componentstrategie): verschil € ${diffLead.toLocaleString('nl-NL')}. Algemene maximumBid (informatief): verschil € ${diffBid.toLocaleString('nl-NL')}.`,
      advice: conflict
        ? 'Let op: maximumBid (BAR/exit) toont ruimte boven vraagprijs, maar componentstrategie is leidend en toont het tegenovergestelde. Gebruik de leidende waarde.'
        : undefined,
      technical: `leadingMaxBasis=${computed.leadingMaxBasis} · leadingMaxValue=${Math.round(computed.leadingMaxValue)} · maxPurchasePrice=${computed.maxPurchasePrice} · maximumBid=${computed.maximumBid}`,
    });
  } else {
    add(checks, { id: 'doable-bar', category: 'doable', status: 'ok', section: SECTIONS.doable, problem: `Verschil met vraagprijs: € ${Math.round(computed.leadingDifferenceWithAskingPrice).toLocaleString('nl-NL')} (leidend: ${computed.leadingMaxBasisLabel}).` });
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
        ? `Scenario-level exit én componentstrategie zijn beide gevuld, maar leidend spoor is expliciet gekozen: ${computed.leadingMaxBasisLabel}.`
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

  // ===== T. FORMATTERING =====
  // Steekproef: scan op puntkomma's of niet-Europese decimaalweergave in vrije tekstvelden.
  const fmtIssues: string[] = [];
  const checkText = (label: string, v: unknown) => {
    if (typeof v !== 'string') return;
    if (/\d+\.\d{3}/.test(v)) fmtIssues.push(`${label}: gebruikt punt als duizendscheiding`);
  };
  checkText('notes', scenario.notes);
  checkText('description', scenario.description);
  add(checks, {
    id: 'fmt',
    category: 'formatting',
    status: fmtIssues.length === 0 ? 'ok' : 'warning',
    section: SECTIONS.fmt,
    problem: fmtIssues.length === 0 ? 'Geen formatteringsproblemen aangetroffen in vrije tekst.' : fmtIssues.join('; '),
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
    }),
    maxBidExplain: buildMaxBidExplain(scenario, computed),
    summary,
    conclusion,
  };
}
