import type { CanonicalScenarioTaxonomy } from './types';
import type { LegacyStrategyType } from './legacyMapping';

export type LegacySaleStrategy =
  | 'geen_verkoop'
  | 'leeg_verkopen'
  | 'verhuurd_verkopen'
  | 'uitponden'
  | 'splitsen_verkopen'
  | 'renoveren_verkopen'
  | 'transformeren_verkopen'
  | 'per_unit_verkopen'
  | 'eindbelegger_exit'
  | 'anders';

export type LegacyBridgeStatus = 'exact' | 'inferred' | 'unsupported';

export interface ScenarioLegacyBridgeSuggestion {
  status: LegacyBridgeStatus;
  strategyType: LegacyStrategyType | null;
  saleStrategy: LegacySaleStrategy | null;
  reasons: string[];
  warnings: string[];
}

export interface ScenarioLegacyCompatibilityPatch {
  strategy_type?: LegacyStrategyType;
  sale_strategy?: LegacySaleStrategy;
}

export interface PersistedLegacyScenarioFields {
  strategy_type?: unknown;
  sale_strategy?: unknown;
}

function suggestion(
  status: Exclude<LegacyBridgeStatus, 'unsupported'>,
  strategyType: LegacyStrategyType,
  saleStrategy: LegacySaleStrategy | null,
  reasons: string[],
  warnings: string[] = [],
): ScenarioLegacyBridgeSuggestion {
  return { status, strategyType, saleStrategy, reasons, warnings };
}

function unsupported(reason: string, warnings: string[] = []): ScenarioLegacyBridgeSuggestion {
  return {
    status: 'unsupported',
    strategyType: null,
    saleStrategy: null,
    reasons: [reason],
    warnings,
  };
}

/**
 * Verbindt de canonieke classificatie met de bestaande gecombineerde rekenvelden.
 *
 * De uitkomst is uitsluitend een voorstel. Deze functie schrijft niets en kiest
 * liever `unsupported` dan een financieel misleidende legacystrategie.
 */
export function suggestLegacyScenarioCompatibility(
  taxonomy: CanonicalScenarioTaxonomy,
): ScenarioLegacyBridgeSuggestion {
  if (taxonomy.intervention === 'expand') {
    return unsupported(
      'Uitbreiden — waaronder optoppen — heeft nog geen passende legacy-rekenstrategie.',
      ['Behoud de canonieke classificatie en bouw hiervoor later een eigen rekenadapter.'],
    );
  }
  if (taxonomy.intervention === 'demolish_newbuild') {
    return unsupported(
      'Sloop/nieuwbouw kan niet veilig door een bestaande legacystrategie worden vertegenwoordigd.',
      ['Een ontwikkelkasstroom en eigen kosten-/opbrengstenadapter zijn nodig.'],
    );
  }
  if (taxonomy.intervention === 'site_development') {
    return unsupported(
      'Locatie- of grondontwikkeling heeft nog geen passende legacy-rekenstrategie.',
      ['Gebruik de classificatie voorlopig alleen als domeinmetadata.'],
    );
  }
  if (taxonomy.intervention === 'sustainability_upgrade') {
    return unsupported(
      'Verduurzamen is nog niet afzonderlijk in de legacy-rekenkern gemodelleerd.',
      ['Koppel dit niet stilzwijgend aan renoveren; kosten, huurimpact en waardesprong moeten apart worden onderbouwd.'],
    );
  }

  if (taxonomy.disposition === 'sale_and_leaseback') {
    return suggestion(
      'exact',
      'sale_leaseback',
      null,
      ['De canonieke disposition correspondeert rechtstreeks met de bestaande Sale & leaseback-strategie.'],
      ['De algemene verkoopstrategie blijft ongewijzigd omdat deze dropdown sale-and-leaseback niet afzonderlijk kent.'],
    );
  }

  if (taxonomy.intervention === 'transform') {
    if (taxonomy.disposition === 'hold' && taxonomy.exploitation === 'rental') {
      return suggestion(
        'exact',
        'buy_transform_hold',
        'geen_verkoop',
        ['Transformeren, verhuren en aanhouden correspondeert met Buy-transform-hold.'],
      );
    }
    if (taxonomy.disposition === 'sell_as_whole') {
      return suggestion(
        'inferred',
        'buy_transform_sell',
        'transformeren_verkopen',
        ['Transformatie met verkoop als geheel wordt benaderd met Buy-transform-sell.'],
        ['De legacycode bevat geen afzonderlijke bezettingsstatus bij verkoop.'],
      );
    }
    if (taxonomy.disposition === 'sell_unit') {
      return suggestion(
        'inferred',
        'buy_transform_sell',
        'per_unit_verkopen',
        ['Transformatie met verkoop per unit wordt benaderd met Buy-transform-sell en verkoop per unit.'],
        ['De gecombineerde legacystrategie onderscheidt verkoop als geheel en verkoop per unit niet volledig.'],
      );
    }
    if (taxonomy.disposition === 'undecided') {
      return suggestion(
        'inferred',
        'transformeren',
        null,
        ['Alleen de fysieke transformatie kan veilig naar de legacystrategie worden vertaald.'],
        ['Exploitatie en exit blijven in de bestaande rekenvelden ongewijzigd totdat zij zijn gekozen.'],
      );
    }
    return unsupported('Deze combinatie van transformatie en disposition heeft geen veilige legacyvertaling.');
  }

  if (taxonomy.intervention === 'split') {
    if (taxonomy.disposition === 'sell_unit') {
      return suggestion(
        'exact',
        'buy_split_sell',
        'splitsen_verkopen',
        ['Splitsen en per unit verkopen correspondeert met Buy-split-sell.'],
      );
    }
    if (taxonomy.disposition === 'hold') {
      return suggestion(
        'inferred',
        'splitsen',
        'geen_verkoop',
        ['De fysieke splitsing kan worden gekoppeld aan de bestaande strategie Splitsen.'],
        ['De legacycode legt niet vast dat de gesplitste delen worden aangehouden.'],
      );
    }
    if (taxonomy.disposition === 'undecided') {
      return suggestion(
        'inferred',
        'splitsen',
        null,
        ['Alleen de fysieke splitsing kan veilig naar de legacystrategie worden vertaald.'],
      );
    }
    return unsupported('Deze combinatie van splitsen en disposition heeft geen veilige legacyvertaling.');
  }

  if (taxonomy.intervention === 'renovate') {
    if (taxonomy.disposition === 'hold' && taxonomy.exploitation === 'rental') {
      return suggestion(
        'exact',
        'buy_fix_hold',
        'geen_verkoop',
        ['Renoveren, verhuren en aanhouden correspondeert met Buy-fix-hold.'],
      );
    }
    if (taxonomy.disposition === 'sell_as_whole') {
      return suggestion(
        'exact',
        'buy_fix_sell',
        'renoveren_verkopen',
        ['Renoveren en als geheel verkopen correspondeert met Buy-fix-sell.'],
      );
    }
    if (taxonomy.disposition === 'sell_unit') {
      return suggestion(
        'inferred',
        'buy_fix_sell',
        'per_unit_verkopen',
        ['Renoveren met verkoop per unit wordt benaderd met Buy-fix-sell en verkoop per unit.'],
        ['De legacystrategie Buy-fix-sell specificeert de verkoopvorm niet.'],
      );
    }
    return unsupported('Deze renovatiecombinatie heeft geen veilige legacyvertaling.');
  }

  if (taxonomy.intervention === 'maintain') {
    if (taxonomy.disposition === 'hold' && taxonomy.exploitation === 'rental') {
      return suggestion(
        'inferred',
        'belegging',
        'geen_verkoop',
        ['Onderhouden en verhuurd aanhouden kan in de bestaande rekenkern als belegging worden doorgerekend.'],
        ['Onderhoud blijft als afzonderlijke kostenpost nodig; de legacystrategie modelleert de ingreep niet.'],
      );
    }
    return unsupported('Onderhouden heeft buiten een verhuurde hold-case geen eenduidige legacyvertaling.');
  }

  if (taxonomy.intervention !== 'none') {
    return unsupported('Deze fysieke ingreep heeft nog geen veilige legacyvertaling.');
  }

  if (taxonomy.disposition === 'hold') {
    if (taxonomy.exploitation === 'rental') {
      if (taxonomy.businessCase === 'value_add') {
        return suggestion(
          'inferred',
          'huur_optimaliseren',
          'geen_verkoop',
          ['Waarde toevoegen zonder fysieke ingreep, via verhuur en aanhouden, wordt benaderd als Huur optimaliseren.'],
        );
      }
      if (taxonomy.businessCase === 'income_investment') {
        return suggestion(
          'exact',
          'belegging',
          'geen_verkoop',
          ['Verhuurd aanhouden correspondeert met Belegging / doorexploiteren.'],
        );
      }
    }
    return unsupported('Aanhouden zonder verhuurexploitatie heeft geen eenduidige bestaande rekenstrategie.');
  }

  if (taxonomy.disposition === 'sell_as_whole') {
    const saleStrategy = taxonomy.exploitation === 'rental'
      ? 'verhuurd_verkopen'
      : taxonomy.exploitation === 'vacant'
        ? 'leeg_verkopen'
        : null;
    return suggestion(
      saleStrategy ? 'exact' : 'inferred',
      'verkopen_geheel',
      saleStrategy,
      ['Verkoop als geheel correspondeert met de bestaande strategie Verkopen als geheel.'],
      saleStrategy ? [] : ['De bezettingsstatus bij verkoop is nog niet bepaald; de verkoopstrategie blijft daarom ongewijzigd.'],
    );
  }

  if (taxonomy.disposition === 'sell_unit') {
    if (taxonomy.businessCase === 'portfolio_optimization') {
      return suggestion(
        'exact',
        'uitponden',
        'uitponden',
        ['Portefeuille-optimalisatie door verkoop per unit correspondeert met Uitponden.'],
      );
    }
    return suggestion(
      'inferred',
      'verkoop_per_unit',
      'per_unit_verkopen',
      ['Verkoop per unit correspondeert met de bestaande strategie Verkoop per unit.'],
      ['Eventuele fasering en leeg-/verhuurdstatus moeten afzonderlijk worden vastgelegd.'],
    );
  }

  if (taxonomy.disposition === 'undecided') {
    if (taxonomy.businessCase === 'redevelopment') {
      return suggestion(
        'inferred',
        'herontwikkeling',
        null,
        ['De brede businesscase kan voorlopig als Herontwikkeling worden weergegeven.'],
        ['Fysieke ingreep en exit zijn nog niet concreet genoeg voor een specifieke rekenstrategie.'],
      );
    }
    return unsupported('De disposition is nog niet bepaald; er wordt geen legacystrategie voorgesteld.');
  }

  return unsupported('Deze businesscase-, exploitatie- en dispositioncombinatie heeft geen veilige legacyvertaling.');
}

/** Bouwt uitsluitend een patch voor velden die daadwerkelijk moeten wijzigen. */
export function buildLegacyCompatibilityPatch(
  current: PersistedLegacyScenarioFields,
  suggestionResult: ScenarioLegacyBridgeSuggestion,
): ScenarioLegacyCompatibilityPatch {
  if (suggestionResult.status === 'unsupported' || !suggestionResult.strategyType) return {};

  const patch: ScenarioLegacyCompatibilityPatch = {};
  if (current.strategy_type !== suggestionResult.strategyType) {
    patch.strategy_type = suggestionResult.strategyType;
  }
  if (suggestionResult.saleStrategy && current.sale_strategy !== suggestionResult.saleStrategy) {
    patch.sale_strategy = suggestionResult.saleStrategy;
  }
  return patch;
}

export function isLegacyCompatibilityAligned(
  current: PersistedLegacyScenarioFields,
  suggestionResult: ScenarioLegacyBridgeSuggestion,
): boolean {
  return Object.keys(buildLegacyCompatibilityPatch(current, suggestionResult)).length === 0;
}
