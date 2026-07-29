export type Gebiedsniveau = 'province' | 'municipality' | 'district' | 'neighbourhood';
export type GebiedsvoorkeurStatus = 'core' | 'expand' | 'watch' | 'exclude';
export type GebiedsvoorkeurBron = 'manual' | 'signal_frequency' | 'market_research' | 'relationship_network' | 'other';

export type Gebiedsvoorkeur = {
  id: string;
  location_key: string;
  location_level: Gebiedsniveau;
  province_code: string | null;
  province_name: string | null;
  municipality_code: string | null;
  municipality_name: string | null;
  district_code: string | null;
  district_name: string | null;
  neighbourhood_code: string | null;
  neighbourhood_name: string | null;
  preference_status: GebiedsvoorkeurStatus;
  priority: number;
  asset_type_codes: string[];
  strategy_codes: string[];
  motivation: string;
  notes: string | null;
  source_type: GebiedsvoorkeurBron;
  active: boolean;
  version: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type Gebiedsfrequentie = {
  location_level: Gebiedsniveau;
  location_key: string;
  province_code: string | null;
  province_name: string | null;
  municipality_code: string | null;
  municipality_name: string | null;
  district_code: string | null;
  district_name: string | null;
  neighbourhood_code: string | null;
  neighbourhood_name: string | null;
  signal_count: number;
  active_signal_count: number;
  latest_signal_date: string | null;
};

export type GebiedsvoorkeurDraft = Omit<
  Gebiedsvoorkeur,
  'id' | 'version' | 'created_by' | 'created_at' | 'updated_at'
>;

export const GEBIEDSNIVEAU_LABELS: Record<Gebiedsniveau, string> = {
  province: 'Provincie',
  municipality: 'Gemeente',
  district: 'Wijk',
  neighbourhood: 'Buurt',
};

export const GEBIEDSVOORKEUR_LABELS: Record<GebiedsvoorkeurStatus, string> = {
  core: 'Kerngebied',
  expand: 'Uitbreidingsgebied',
  watch: 'Volgen',
  exclude: 'Uitsluiten',
};

export const GEBIEDSBRON_LABELS: Record<GebiedsvoorkeurBron, string> = {
  manual: 'Vooraf handmatig gekozen',
  signal_frequency: 'Vaker voorkomend in signalen',
  market_research: 'Marktonderzoek',
  relationship_network: 'Relatie- of kopersnetwerk',
  other: 'Overig',
};

export function gebiedsnaam(item: Pick<
  Gebiedsvoorkeur | Gebiedsfrequentie,
  'location_level' | 'province_name' | 'municipality_name' | 'district_name' | 'neighbourhood_name'
>): string {
  if (item.location_level === 'province') return item.province_name ?? 'Naamloze provincie';
  if (item.location_level === 'municipality') return item.municipality_name ?? 'Naamloze gemeente';
  if (item.location_level === 'district') return item.district_name ?? 'Naamloze wijk';
  return item.neighbourhood_name ?? 'Naamloze buurt';
}

export function gebiedspad(item: Pick<
  Gebiedsvoorkeur | Gebiedsfrequentie,
  'location_level' | 'province_name' | 'municipality_name' | 'district_name' | 'neighbourhood_name'
>): string {
  const parts = [item.province_name, item.municipality_name, item.district_name, item.neighbourhood_name]
    .filter((value): value is string => Boolean(value?.trim()));
  return parts.join(' › ') || gebiedsnaam(item);
}

export function buildLocationKey(input: {
  locationLevel: Gebiedsniveau;
  provinceCode?: string | null;
  provinceName?: string | null;
  municipalityCode?: string | null;
  municipalityName?: string | null;
  districtCode?: string | null;
  districtName?: string | null;
  neighbourhoodCode?: string | null;
  neighbourhoodName?: string | null;
}): string {
  const official = input.locationLevel === 'province'
    ? input.provinceCode
    : input.locationLevel === 'municipality'
      ? input.municipalityCode
      : input.locationLevel === 'district'
        ? input.districtCode
        : input.neighbourhoodCode;
  if (official?.trim()) return official.trim();

  const name = input.locationLevel === 'province'
    ? input.provinceName
    : input.locationLevel === 'municipality'
      ? input.municipalityName
      : input.locationLevel === 'district'
        ? input.districtName
        : input.neighbourhoodName;
  if (!name?.trim()) throw new Error('Vul een officiële gebiedscode of gebiedsnaam in.');
  const municipality = input.municipalityName?.trim().toLocaleLowerCase('nl-NL') ?? '';
  return `${input.locationLevel}:${municipality}:${name.trim().toLocaleLowerCase('nl-NL')}`;
}

export function buildGebiedsvoorkeurPayload(draft: GebiedsvoorkeurDraft): Record<string, unknown> {
  const motivation = draft.motivation.trim();
  if (!motivation) throw new Error('Leg kort vast waarom dit gebied interessant, te volgen of uit te sluiten is.');
  if (!Number.isInteger(Number(draft.priority)) || Number(draft.priority) < 1 || Number(draft.priority) > 5) {
    throw new Error('Prioriteit moet tussen 1 en 5 liggen.');
  }
  const locationKey = buildLocationKey({
    locationLevel: draft.location_level,
    provinceCode: draft.province_code,
    provinceName: draft.province_name,
    municipalityCode: draft.municipality_code,
    municipalityName: draft.municipality_name,
    districtCode: draft.district_code,
    districtName: draft.district_name,
    neighbourhoodCode: draft.neighbourhood_code,
    neighbourhoodName: draft.neighbourhood_name,
  });
  return {
    ...draft,
    location_key: locationKey,
    priority: Number(draft.priority),
    asset_type_codes: Array.from(new Set(draft.asset_type_codes ?? [])),
    strategy_codes: Array.from(new Set(draft.strategy_codes ?? [])),
    motivation,
    notes: draft.notes?.trim() || null,
  };
}

export function frequentieSignaal(count: number): 'laag' | 'opvallend' | 'hoog' {
  if (count >= 10) return 'hoog';
  if (count >= 3) return 'opvallend';
  return 'laag';
}
