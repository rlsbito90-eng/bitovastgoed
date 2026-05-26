// Bron-van-waarheid tabel: bepaalt per onderdeel welke bron leidend is in
// de huidige scenario-configuratie en welke alternatieven daarnaast gevuld zijn.

import type { Scenario, Component, ScenarioCost, WwsUnit, SellOffUnit } from '../types';
import type { SourceOfTruthRow } from './types';

const n = (v: unknown): number => {
  const x = Number(v ?? 0);
  return Number.isFinite(x) ? x : 0;
};

export function buildSourcesOfTruth(args: {
  scenario: Scenario;
  components: Component[];
  costs: ScenarioCost[];
  wwsUnits: WwsUnit[];
  strategyUnits: SellOffUnit[];
  object?: { askingPrice?: number | null; areaGbo?: number | null } | null;
}): SourceOfTruthRow[] {
  const { scenario, components, costs, wwsUnits, strategyUnits, object } = args;
  const rec = scenario as unknown as Record<string, unknown>;
  const rows: SourceOfTruthRow[] = [];

  // Vraagprijs
  const askObj = n(object?.askingPrice);
  const askScen = n(scenario.asking_price);
  rows.push({
    onderdeel: 'Vraagprijs',
    actieveBron: askScen > 0 ? 'Scenario (asking_price)' : askObj > 0 ? 'Object' : 'Niet gevuld',
    alternatieveBron: askScen > 0 && askObj > 0 && askObj !== askScen ? `Object (€ ${askObj.toLocaleString('nl-NL')})` : undefined,
    risico: askScen > 0 && askObj > 0 && askObj !== askScen ? 'middel' : askScen > 0 ? 'geen' : 'laag',
    toelichting: 'Berekening gebruikt scenario.asking_price.',
  });

  // Aankoopprijs
  rows.push({
    onderdeel: 'Aankoopprijs',
    actieveBron: n(scenario.purchase_price) > 0 ? 'Scenario (purchase_price)' : 'Niet gevuld',
    risico: n(scenario.purchase_price) > 0 ? 'geen' : 'hoog',
  });

  // Huur
  const rentSource = (scenario.rent_source as string | null) ?? 'handmatig';
  const manualRent = n(scenario.current_monthly_rent) + n(scenario.market_monthly_rent) + n(scenario.manual_corrected_monthly_rent);
  const compRent = components.reduce((s, c) => s + n(c.current_monthly_rent) + n(c.market_monthly_rent), 0);
  const wwsRent = wwsUnits.reduce((s, u) => s + n(u.corrected_monthly_rent) + n(u.wws_max_monthly_rent) + n(u.current_monthly_rent), 0);
  rows.push({
    onderdeel: 'Huur (basis)',
    actieveBron:
      rentSource === 'componenten' ? 'Som van componenten' :
      rentSource === 'wws_gecorrigeerd' ? 'WWS-gecorrigeerd' :
      rentSource === 'handmatig_gecorrigeerd' ? 'Handmatig gecorrigeerd' :
      'Handmatige scenario-huur',
    alternatieveBron: [
      rentSource !== 'handmatig' && manualRent > 0 ? 'Handmatig (scenario)' : null,
      rentSource !== 'componenten' && compRent > 0 ? 'Componenten' : null,
      rentSource !== 'wws_gecorrigeerd' && wwsRent > 0 ? 'WWS-units' : null,
    ].filter(Boolean).join(', ') || undefined,
    risico: (rentSource !== 'handmatig' && manualRent > 0) || (rentSource !== 'componenten' && compRent > 0) ? 'middel' : 'geen',
    toelichting: 'Alleen de actieve bron wordt opgeteld; alternatieven worden niet dubbel meegenomen mits rent_source correct staat.',
  });

  // Oppervlakte
  const compArea = components.reduce((s, c) => s + n(c.surface_gbo) + n(c.surface_vvo) + n(c.surface_bvo), 0);
  rows.push({
    onderdeel: 'Oppervlakte (GBO)',
    actieveBron: n(object?.areaGbo) > 0 ? 'Object (GBO)' : compArea > 0 ? 'Som componenten' : 'Niet gevuld',
    alternatieveBron: n(object?.areaGbo) > 0 && compArea > 0 ? 'Componenten' : undefined,
    risico: n(object?.areaGbo) > 0 ? 'geen' : compArea > 0 ? 'laag' : 'middel',
  });

  // WWS-huur
  rows.push({
    onderdeel: 'WWS-huur',
    actieveBron: rentSource === 'wws_gecorrigeerd' ? 'WWS-units' : 'Niet gebruikt (rent_source)',
    risico: rentSource === 'wws_gecorrigeerd' && wwsUnits.length === 0 ? 'hoog' : 'geen',
    toelichting: wwsUnits.length === 0 && rentSource === 'wws_gecorrigeerd' ? 'WWS gekozen maar geen units aanwezig.' : undefined,
  });

  // OVB
  const ovbMode = scenario.ovb_mode ?? 'auto';
  rows.push({
    onderdeel: 'OVB',
    actieveBron:
      ovbMode === 'manual' ? `Handmatig bedrag (€ ${n(scenario.transfer_tax_amount).toLocaleString('nl-NL')})` :
      ovbMode === 'per_component' ? 'Per component' :
      `Automatisch (${n(scenario.transfer_tax_percentage).toFixed(1)}%)`,
    alternatieveBron: ovbMode !== 'manual' && n(scenario.transfer_tax_amount) > 0 ? 'Handmatig bedrag aanwezig' : undefined,
    risico: ovbMode === 'per_component' && components.some((c) => !c.transfer_tax_classification && !c.transfer_tax_manual_override) ? 'middel' : 'geen',
  });

  // Kosten
  rows.push({
    onderdeel: 'Bouw-/projectkosten',
    actieveBron: costs.length > 0 ? `${costs.length} kostenpost(en)` : 'Geen kosten',
    risico: costs.some((c) => c.reliability_status !== 'hoog') ? 'middel' : costs.length === 0 ? 'laag' : 'geen',
  });

  // Verkoopwaarde
  const sStrat = rec.sale_strategy as string | null;
  const exitManual = n(rec.sale_exit_value_manual);
  const exitTotal = n(rec.sale_price_total);
  rows.push({
    onderdeel: 'Verkoopwaarde / exit',
    actieveBron:
      exitManual > 0 ? 'Handmatige exitwaarde' :
      exitTotal > 0 ? 'Sale price total' :
      sStrat && sStrat !== 'geen_verkoop' ? 'Strategie gekozen, geen bedrag' : 'Niet van toepassing',
    risico: sStrat && sStrat !== 'geen_verkoop' && exitManual === 0 && exitTotal === 0 ? 'hoog' : 'geen',
  });

  // Componentstrategie
  rows.push({
    onderdeel: 'Componentstrategie',
    actieveBron: strategyUnits.length > 0 ? `${strategyUnits.length} unit(s)` : 'Niet gebruikt',
    alternatieveBron: strategyUnits.length > 0 && sStrat && sStrat !== 'geen_verkoop' ? 'Scenario-level exit ook gevuld' : undefined,
    risico: strategyUnits.length > 0 && sStrat && sStrat !== 'geen_verkoop' ? 'middel' : 'geen',
    toelichting: strategyUnits.length > 0 && sStrat && sStrat !== 'geen_verkoop' ? 'Dubbel exit-spoor — controleer welke leidend is.' : undefined,
  });

  // Maximale aankoopprijs
  rows.push({
    onderdeel: 'Maximale aankoopprijs',
    actieveBron: strategyUnits.length > 0 ? 'Componentstrategie (scenariowaarde)' : 'Biedingsadvies (BAR-tak)',
    risico: 'geen',
    toelichting: 'maxPurchasePrice (strategie) of maximumBid (BAR/exit) via computeScenario.',
  });

  return rows;
}
