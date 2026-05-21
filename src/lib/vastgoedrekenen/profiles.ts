// Aannameprofielen per vastgoedtype voor Vastgoedrekenen V1 quickscan.
// Percentages zijn van de theoretische bruto jaarhuur.

export type AssumptionProfileKey = 'licht' | 'normaal' | 'conservatief' | 'zwaar' | 'handmatig';

export const ASSUMPTION_PROFILE_LABELS: Record<AssumptionProfileKey, string> = {
  licht: 'Licht / gunstig',
  normaal: 'Normaal / realistisch',
  conservatief: 'Conservatief',
  zwaar: 'Zwaar / risicovol',
  handmatig: 'Handmatig',
};

export type PropertyAssumptionType =
  | 'residentieel'
  | 'mixed_use'
  | 'retail'
  | 'kantoor'
  | 'bedrijfsruimte'
  | 'logistiek'
  | 'zorg';

export const PROPERTY_ASSUMPTION_TYPE_LABELS: Record<PropertyAssumptionType, string> = {
  residentieel: 'Residentieel',
  mixed_use: 'Woon-/winkelpand of mixed-use',
  retail: 'Retail / winkelruimte',
  kantoor: 'Kantoor',
  bedrijfsruimte: 'Bedrijfsruimte / light industrial',
  logistiek: 'Logistiek',
  zorg: 'Zorgvastgoed',
};

export type AssumptionSet = {
  vacancy_percentage: number;
  operating_cost_percentage: number;
  maintenance_reserve_percentage: number;
  management_cost_percentage: number;
  // Overig komt erbij als kostenpct, niet aftrekbaar van de huur direct in compute,
  // maar wel doorgevoerd als extra correctie in de NOI-opbouw.
  other_percentage: number;
};

type Profile = Record<Exclude<AssumptionProfileKey, 'handmatig'>, AssumptionSet>;

export const ASSUMPTION_PROFILES: Record<PropertyAssumptionType, Profile> = {
  residentieel: {
    licht: { vacancy_percentage: 1.5, operating_cost_percentage: 6, maintenance_reserve_percentage: 5, management_cost_percentage: 5, other_percentage: 1.5 },
    normaal: { vacancy_percentage: 4, operating_cost_percentage: 9, maintenance_reserve_percentage: 7, management_cost_percentage: 6.5, other_percentage: 2.5 },
    conservatief: { vacancy_percentage: 6.5, operating_cost_percentage: 11, maintenance_reserve_percentage: 9, management_cost_percentage: 7.5, other_percentage: 3.5 },
    zwaar: { vacancy_percentage: 10, operating_cost_percentage: 13.5, maintenance_reserve_percentage: 12.5, management_cost_percentage: 9, other_percentage: 4.5 },
  },
  mixed_use: {
    licht: { vacancy_percentage: 4, operating_cost_percentage: 8, maintenance_reserve_percentage: 6, management_cost_percentage: 6.5, other_percentage: 2.5 },
    normaal: { vacancy_percentage: 6.5, operating_cost_percentage: 10.5, maintenance_reserve_percentage: 8, management_cost_percentage: 7.5, other_percentage: 3.5 },
    conservatief: { vacancy_percentage: 10, operating_cost_percentage: 13.5, maintenance_reserve_percentage: 10.5, management_cost_percentage: 8.5, other_percentage: 4.5 },
    zwaar: { vacancy_percentage: 15, operating_cost_percentage: 16.5, maintenance_reserve_percentage: 13.5, management_cost_percentage: 9.5, other_percentage: 5.5 },
  },
  retail: {
    licht: { vacancy_percentage: 4, operating_cost_percentage: 9, maintenance_reserve_percentage: 6, management_cost_percentage: 6.5, other_percentage: 2.5 },
    normaal: { vacancy_percentage: 8.5, operating_cost_percentage: 11.5, maintenance_reserve_percentage: 8, management_cost_percentage: 7.5, other_percentage: 3.5 },
    conservatief: { vacancy_percentage: 12.5, operating_cost_percentage: 14, maintenance_reserve_percentage: 10, management_cost_percentage: 8.5, other_percentage: 4.5 },
    zwaar: { vacancy_percentage: 20, operating_cost_percentage: 17.5, maintenance_reserve_percentage: 13, management_cost_percentage: 9.5, other_percentage: 6 },
  },
  kantoor: {
    licht: { vacancy_percentage: 6.5, operating_cost_percentage: 11, maintenance_reserve_percentage: 7, management_cost_percentage: 7.5, other_percentage: 3.5 },
    normaal: { vacancy_percentage: 10, operating_cost_percentage: 13.5, maintenance_reserve_percentage: 9, management_cost_percentage: 8.5, other_percentage: 4.5 },
    conservatief: { vacancy_percentage: 15, operating_cost_percentage: 16.5, maintenance_reserve_percentage: 12, management_cost_percentage: 9.5, other_percentage: 5.5 },
    zwaar: { vacancy_percentage: 24, operating_cost_percentage: 21.5, maintenance_reserve_percentage: 17, management_cost_percentage: 11, other_percentage: 7 },
  },
  bedrijfsruimte: {
    licht: { vacancy_percentage: 3, operating_cost_percentage: 8, maintenance_reserve_percentage: 5, management_cost_percentage: 5.5, other_percentage: 2.5 },
    normaal: { vacancy_percentage: 5.5, operating_cost_percentage: 10, maintenance_reserve_percentage: 7, management_cost_percentage: 6.5, other_percentage: 3.5 },
    conservatief: { vacancy_percentage: 8.5, operating_cost_percentage: 12, maintenance_reserve_percentage: 9, management_cost_percentage: 7.5, other_percentage: 4.5 },
    zwaar: { vacancy_percentage: 12.5, operating_cost_percentage: 14.5, maintenance_reserve_percentage: 11.5, management_cost_percentage: 8.5, other_percentage: 5.5 },
  },
  logistiek: {
    licht: { vacancy_percentage: 3, operating_cost_percentage: 6, maintenance_reserve_percentage: 4, management_cost_percentage: 4.5, other_percentage: 1.5 },
    normaal: { vacancy_percentage: 5, operating_cost_percentage: 8, maintenance_reserve_percentage: 6, management_cost_percentage: 5.5, other_percentage: 2.5 },
    conservatief: { vacancy_percentage: 8, operating_cost_percentage: 10, maintenance_reserve_percentage: 8, management_cost_percentage: 6.5, other_percentage: 3.5 },
    zwaar: { vacancy_percentage: 14, operating_cost_percentage: 12.5, maintenance_reserve_percentage: 10, management_cost_percentage: 7.5, other_percentage: 4.5 },
  },
  zorg: {
    licht: { vacancy_percentage: 1, operating_cost_percentage: 9, maintenance_reserve_percentage: 7, management_cost_percentage: 6.5, other_percentage: 2.5 },
    normaal: { vacancy_percentage: 3.5, operating_cost_percentage: 11.5, maintenance_reserve_percentage: 9, management_cost_percentage: 7.5, other_percentage: 3.5 },
    conservatief: { vacancy_percentage: 7.5, operating_cost_percentage: 14.5, maintenance_reserve_percentage: 12, management_cost_percentage: 8.5, other_percentage: 4.5 },
    zwaar: { vacancy_percentage: 15, operating_cost_percentage: 18, maintenance_reserve_percentage: 16, management_cost_percentage: 9.5, other_percentage: 6 },
  },
};

/** Geef profiel terug; bij 'handmatig' return null zodat scenariovelden leidend zijn. */
export function getAssumptionSet(
  type: PropertyAssumptionType,
  profile: AssumptionProfileKey,
): AssumptionSet | null {
  if (profile === 'handmatig') return null;
  return ASSUMPTION_PROFILES[type][profile];
}

/** Standaardprofiel op basis van vastgoedtype + strategie. */
export function defaultProfileFor(
  type: PropertyAssumptionType,
  strategy?: string | null,
): AssumptionProfileKey {
  if (strategy === 'transformeren' || strategy === 'buy_transform_hold' || strategy === 'buy_transform_sell' || strategy === 'herontwikkeling') return 'zwaar';
  if (strategy === 'uitponden' || strategy === 'splitsen' || strategy === 'buy_split_sell') return 'conservatief';
  if (type === 'retail' || type === 'kantoor' || type === 'mixed_use') return 'conservatief';
  if (type === 'residentieel') return 'normaal';
  if (type === 'bedrijfsruimte' || type === 'logistiek' || type === 'zorg') return 'normaal';
  return 'conservatief';
}

/** Map ruw objecttype (van object/scenario) naar PropertyAssumptionType. */
export function mapToAssumptionType(raw: string | null | undefined, objectMode: 'enkelvoudig' | 'mixed_use'): PropertyAssumptionType {
  if (objectMode === 'mixed_use') return 'mixed_use';
  const v = (raw ?? '').toLowerCase();
  if (/wonen|woning|appartement|residenti/.test(v)) return 'residentieel';
  if (/winkel|retail|horeca/.test(v)) return 'retail';
  if (/kantoor|office/.test(v)) return 'kantoor';
  if (/logistiek|dc|distributie/.test(v)) return 'logistiek';
  if (/zorg|care|gezondheid/.test(v)) return 'zorg';
  if (/bedrijf|industrie|unit|opslag/.test(v)) return 'bedrijfsruimte';
  if (/mixed|gemengd|combinatie/.test(v)) return 'mixed_use';
  return 'residentieel';
}

export const COST_STRUCTURE_LABELS: Record<string, string> = {
  eigenaar: 'Eigenaar draagt meeste kosten',
  deels_doorbelast: 'Kosten deels doorbelast aan huurder',
  huurder: 'Huurder draagt meeste kosten',
  triple_net: 'Triple-net / netto huurachtig',
  onbekend: 'Onbekend',
};

export const RENT_SOURCE_LABELS: Record<string, string> = {
  handmatig: 'Handmatig in huuranalyse',
  componenten: 'Som van componenten',
  wws_gecorrigeerd: 'WWS-gecorrigeerd',
  handmatig_gecorrigeerd: 'Handmatige gecorrigeerde huur',
};

export const RELIABILITY_LABELS: Record<string, string> = {
  laag: 'Laag',
  middel: 'Middel',
  hoog: 'Hoog',
};

export const MJOP_LABELS: Record<string, string> = {
  ja: 'Aanwezig',
  nee: 'Niet aanwezig',
  onbekend: 'Onbekend',
};
