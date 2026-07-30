import type { KengetalBand, KengetalScenarioVeld, ScenarioKengetalSnapshot, VastgoedrekenenKengetal } from './kengetallen';

export const SCENARIO_INPUT_PROFILE_SCHEMA_VERSION = 1 as const;

export type ScenarioProfileCode = 'conservative' | 'base' | 'optimistic';

export type ScenarioInputContext = {
  scenario_id: string;
  asset_type_code: string | null;
  strategy_code: string | null;
  project_phase_code: string | null;
  risk_class_code: string | null;
  quality_level_code: string | null;
  complexity_code: string | null;
  location_type_code: string | null;
  market_condition_code: string | null;
  scenario_profile_code: ScenarioProfileCode;
  location_keys: string[];
  derivation_notes: Record<string, string>;
  schema_version: number;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ScenarioInputContextDraft = Omit<
  ScenarioInputContext,
  'updated_by' | 'created_at' | 'updated_at'
>;

export type ScenarioInputContextSuggestion = {
  context: ScenarioInputContextDraft;
  reasons: string[];
};

export type ProfileMatchStatus = 'exact' | 'broad' | 'incomplete' | 'mismatch' | 'expired';

export type KengetalProfileMatch = {
  kengetal: VastgoedrekenenKengetal;
  status: ProfileMatchStatus;
  score: number;
  scorePercentage: number;
  reasons: string[];
  missingContext: string[];
  mismatches: string[];
  selectedBand: Exclude<KengetalBand, 'handmatig'> | null;
  selectedValue: number | null;
  applicable: boolean;
  blocker: string | null;
};

export type ProfileApplicationConflict = 'none' | 'tracked_snapshot' | 'untracked_value';

export type ProfileApplicationCandidate = {
  match: KengetalProfileMatch;
  currentValue: number | null;
  existingSnapshot: ScenarioKengetalSnapshot | null;
  conflict: ProfileApplicationConflict;
  selectedByDefault: boolean;
};

const DIMENSIONS = [
  { context: 'asset_type_code', entry: 'asset_type_codes', label: 'assettype', weight: 25 },
  { context: 'strategy_code', entry: 'strategy_codes', label: 'strategie', weight: 25 },
  { context: 'project_phase_code', entry: 'project_phase_codes', label: 'projectfase', weight: 10 },
  { context: 'risk_class_code', entry: 'risk_class_codes', label: 'risicoklasse', weight: 8 },
  { context: 'quality_level_code', entry: 'quality_level_codes', label: 'kwaliteitsniveau', weight: 8 },
  { context: 'complexity_code', entry: 'complexity_codes', label: 'complexiteit', weight: 8 },
  { context: 'location_type_code', entry: 'location_type_codes', label: 'locatietype', weight: 6 },
  { context: 'market_condition_code', entry: 'market_condition_codes', label: 'marktomstandigheid', weight: 5 },
  { context: 'scenario_profile_code', entry: 'scenario_profile_codes', label: 'scenarioprofiel', weight: 5 },
] as const;

function unique(values: readonly string[] | null | undefined): string[] {
  return Array.from(new Set((values ?? []).filter(Boolean)));
}

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function profileBandFor(
  kengetal: Pick<VastgoedrekenenKengetal, 'conservative_band' | 'optimistic_band'>,
  profile: ScenarioProfileCode,
): Exclude<KengetalBand, 'handmatig'> | null {
  if (profile === 'base') return 'basis';
  if (profile === 'conservative') return kengetal.conservative_band ?? null;
  return kengetal.optimistic_band ?? null;
}

function valueForSelectedBand(
  kengetal: VastgoedrekenenKengetal,
  band: Exclude<KengetalBand, 'handmatig'> | null,
): number | null {
  if (!band) return null;
  if (band === 'minimum') return Number(kengetal.minimum_waarde);
  if (band === 'maximum') return Number(kengetal.maximum_waarde);
  return Number(kengetal.basis_waarde);
}

export function matchKengetalToContext(
  kengetal: VastgoedrekenenKengetal,
  context: ScenarioInputContextDraft,
  todayIso = new Date().toISOString().slice(0, 10),
): KengetalProfileMatch {
  const reasons: string[] = [];
  const missingContext: string[] = [];
  const mismatches: string[] = [];
  let score = 0;
  let constrainedWeight = 0;
  let broadWeight = 0;

  for (const dimension of DIMENSIONS) {
    const allowed = unique(kengetal[dimension.entry] as string[] | null | undefined);
    const selected = context[dimension.context] as string | null;
    if (allowed.length === 0) {
      broadWeight += dimension.weight;
      continue;
    }
    constrainedWeight += dimension.weight;
    if (!selected) {
      missingContext.push(dimension.label);
      continue;
    }
    if (allowed.includes(selected)) {
      score += dimension.weight;
      reasons.push(`${dimension.label} past`);
    } else {
      mismatches.push(`${dimension.label} wijkt af`);
    }
  }

  const allowedLocations = unique(kengetal.location_keys);
  const selectedLocations = unique(context.location_keys);
  const locationWeight = 20;
  if (allowedLocations.length === 0) {
    broadWeight += locationWeight;
  } else {
    constrainedWeight += locationWeight;
    if (selectedLocations.length === 0) {
      missingContext.push('gebied');
    } else if (allowedLocations.some((key) => selectedLocations.includes(key))) {
      score += locationWeight;
      reasons.push('gebied past');
    } else {
      mismatches.push('gebied wijkt af');
    }
  }

  // Een algemeen kengetal blijft bruikbaar, maar scoort lager dan een specifieke match.
  score += broadWeight * 0.15;
  const maximum = constrainedWeight + broadWeight;
  const scorePercentage = maximum > 0 ? Math.round((score / maximum) * 100) : 0;
  const expired = kengetal.vervaldatum < todayIso;
  const selectedBand = profileBandFor(kengetal, context.scenario_profile_code);
  const selectedValue = valueForSelectedBand(kengetal, selectedBand);

  let status: ProfileMatchStatus;
  if (expired) status = 'expired';
  else if (mismatches.length > 0) status = 'mismatch';
  else if (missingContext.length > 0) status = 'incomplete';
  else if (constrainedWeight === 0) status = 'broad';
  else status = 'exact';

  let blocker: string | null = null;
  if (expired) blocker = 'De bron is verlopen.';
  else if (mismatches.length > 0) blocker = 'Het kengetal past niet bij dit invoerprofiel.';
  else if (missingContext.length > 0) blocker = `Vul eerst in: ${missingContext.join(', ')}.`;
  else if (!selectedBand) blocker = `De ${context.scenario_profile_code === 'conservative' ? 'conservatieve' : 'optimistische'} profielband is nog niet ingericht in het register.`;
  else if (!kengetal.scenario_veld) blocker = 'Dit kengetal is alleen onderbouwing en vult geen scenarioveld.';

  return {
    kengetal,
    status,
    score: Math.round(score * 100) / 100,
    scorePercentage,
    reasons,
    missingContext,
    mismatches,
    selectedBand,
    selectedValue,
    applicable: blocker === null,
    blocker,
  };
}

export function rankKengetallenForContext(
  entries: readonly VastgoedrekenenKengetal[],
  context: ScenarioInputContextDraft,
  todayIso?: string,
): KengetalProfileMatch[] {
  return entries
    .filter((entry) => entry.actief)
    .map((entry) => matchKengetalToContext(entry, context, todayIso))
    .sort((left, right) => {
      const statusRank: Record<ProfileMatchStatus, number> = {
        exact: 0,
        broad: 1,
        incomplete: 2,
        mismatch: 3,
        expired: 4,
      };
      return statusRank[left.status] - statusRank[right.status]
        || Number(right.applicable) - Number(left.applicable)
        || right.scorePercentage - left.scorePercentage
        || left.kengetal.naam.localeCompare(right.kengetal.naam, 'nl-NL');
    });
}

export function scenarioFieldValue(
  scenario: Record<string, unknown>,
  field: KengetalScenarioVeld | null,
): number | null {
  if (!field) return null;
  return numberOrNull(scenario[field]);
}

export function buildProfileApplicationCandidates(args: {
  matches: readonly KengetalProfileMatch[];
  scenario: Record<string, unknown>;
  snapshots: readonly ScenarioKengetalSnapshot[];
}): ProfileApplicationCandidate[] {
  const snapshotByCode = new Map(args.snapshots.map((snapshot) => [snapshot.kengetal_code, snapshot]));
  return args.matches.map((match) => {
    const existingSnapshot = snapshotByCode.get(match.kengetal.code) ?? null;
    const currentValue = scenarioFieldValue(args.scenario, match.kengetal.scenario_veld);
    const conflict: ProfileApplicationConflict = currentValue === null
      ? 'none'
      : existingSnapshot
        ? 'tracked_snapshot'
        : 'untracked_value';
    return {
      match,
      currentValue,
      existingSnapshot,
      conflict,
      selectedByDefault: match.applicable && conflict !== 'untracked_value',
    };
  });
}

function assetTypeCode(raw: string | null | undefined): string | null {
  const value = String(raw ?? '').toLocaleLowerCase('nl-NL');
  if (!value) return null;
  if (/mixed|gemengd/.test(value)) return 'mixed_use';
  if (/wonen|woning|appartement/.test(value)) return 'residential';
  if (/kantoor|office/.test(value)) return 'office';
  if (/winkel|retail/.test(value)) return 'retail';
  if (/horeca|restaurant|café|cafe/.test(value)) return 'hospitality';
  if (/hotel|short.?stay/.test(value)) return 'hotel';
  if (/logistiek|distributie|dc\b/.test(value)) return 'logistics';
  if (/bedrijf|industrie|hal|opslag/.test(value)) return 'light_industrial';
  if (/zorg|care/.test(value)) return 'care';
  if (/grond|ontwikkellocatie/.test(value)) return 'land';
  return 'other';
}

function strategyCode(scenario: Record<string, unknown>): string | null {
  const intervention = String(scenario.intervention ?? '');
  if (['hold', 'rent', 'renovate', 'split', 'room_rental', 'transform', 'expand', 'demolish_newbuild', 'site_development', 'sell', 'sale_and_leaseback'].includes(intervention)) {
    return intervention;
  }
  const raw = String(scenario.strategy_type ?? '').toLocaleLowerCase('nl-NL');
  if (/transform/.test(raw)) return 'transform';
  if (/split|splits|uitpond/.test(raw)) return 'split';
  if (/renov/.test(raw)) return 'renovate';
  if (/verhuur|rent/.test(raw)) return 'rent';
  if (/hold|belegging|aanhouden/.test(raw)) return 'hold';
  if (/verkoop|sell/.test(raw)) return 'sell';
  if (/sloop|nieuwbouw/.test(raw)) return 'demolish_newbuild';
  return null;
}

function complexityCode(strategy: string | null): string | null {
  if (!strategy) return null;
  if (['transform', 'demolish_newbuild', 'site_development'].includes(strategy)) return 'high';
  if (['renovate', 'split', 'room_rental', 'expand'].includes(strategy)) return 'medium';
  return 'low';
}

export function deriveScenarioInputContextSuggestion(args: {
  scenarioId: string;
  scenario: Record<string, unknown>;
  objectType?: string | null;
  locationKeys?: readonly string[] | null;
}): ScenarioInputContextSuggestion {
  const asset = assetTypeCode(args.objectType);
  const strategy = strategyCode(args.scenario);
  const complexity = complexityCode(strategy);
  const reasons = [
    asset ? `Assettype voorgesteld uit het object: ${asset}.` : 'Assettype kon niet uit het object worden afgeleid.',
    strategy ? `Strategie voorgesteld uit de scenario-classificatie: ${strategy}.` : 'Strategie kon niet eenduidig worden afgeleid.',
    'Projectfase voorgesteld als Quickscan, omdat dit profiel in Vastgoedrekenen wordt gebruikt.',
    'Scenarioprofiel voorgesteld als Basis; dit wordt pas actief na opslaan.',
  ];
  if (complexity) reasons.push(`Complexiteit voorgesteld als ${complexity} op basis van de ingreep.`);
  if ((args.locationKeys ?? []).length > 0) reasons.push('Gebied voorgesteld uit gekoppelde geo-data of actieve gebiedsvoorkeuren.');

  return {
    context: {
      scenario_id: args.scenarioId,
      asset_type_code: asset,
      strategy_code: strategy,
      project_phase_code: 'quickscan',
      risk_class_code: null,
      quality_level_code: null,
      complexity_code: complexity,
      location_type_code: null,
      market_condition_code: null,
      scenario_profile_code: 'base',
      location_keys: unique(args.locationKeys),
      derivation_notes: {
        asset_type_code: asset ? 'Afgeleid uit objecttype' : 'Niet afleidbaar',
        strategy_code: strategy ? 'Afgeleid uit scenario-classificatie of legacy strategie' : 'Niet afleidbaar',
        project_phase_code: 'Voorgesteld voor Vastgoedrekenen Quickscan',
        complexity_code: complexity ? 'Voorgesteld uit ingreep' : 'Niet afleidbaar',
        location_keys: (args.locationKeys ?? []).length > 0 ? 'Gekoppelde geo-data/gebiedsvoorkeur' : 'Geen gebied gevonden',
      },
      schema_version: SCENARIO_INPUT_PROFILE_SCHEMA_VERSION,
    },
    reasons,
  };
}
