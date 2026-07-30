import type {
  SourceImportColumnMapping,
  SourceImportField,
} from '@/lib/vastgoedrekenen/sourceImport';

export const SOURCE_IMPORT_MAPPING_PROFILE_SCHEMA_VERSION = 1 as const;

export type SourceImportMappingProfile = {
  id: string;
  naam: string;
  bron_naam: string | null;
  kolommen: Partial<Record<SourceImportField, string>>;
  actief: boolean;
  system_managed: boolean;
  schema_version: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type SourceImportMappingProfileDraft = {
  naam: string;
  bron_naam: string | null;
  kolommen: Partial<Record<SourceImportField, string>>;
};

export type AppliedSourceImportMappingProfile = {
  mapping: SourceImportColumnMapping;
  matchedFields: SourceImportField[];
  missingFields: SourceImportField[];
};

function normalizeHeader(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

export function mappingProfileColumns(
  mapping: SourceImportColumnMapping,
  headers: readonly string[],
): Partial<Record<SourceImportField, string>> {
  return Object.fromEntries(
    Object.entries(mapping)
      .map(([field, index]) => [field, headers[Number(index)]?.trim() ?? ''] as const)
      .filter(([, header]) => Boolean(header)),
  ) as Partial<Record<SourceImportField, string>>;
}

export function applySourceImportMappingProfile(
  profile: Pick<SourceImportMappingProfile, 'kolommen'>,
  headers: readonly string[],
): AppliedSourceImportMappingProfile {
  const normalizedHeaders = headers.map(normalizeHeader);
  const mapping: SourceImportColumnMapping = {};
  const matchedFields: SourceImportField[] = [];
  const missingFields: SourceImportField[] = [];

  Object.entries(profile.kolommen).forEach(([field, header]) => {
    const typedField = field as SourceImportField;
    const normalized = normalizeHeader(String(header));
    const index = normalizedHeaders.findIndex((candidate) => candidate === normalized);
    if (index >= 0) {
      mapping[typedField] = index;
      matchedFields.push(typedField);
    } else {
      missingFields.push(typedField);
    }
  });

  return { mapping, matchedFields, missingFields };
}

export function sourceImportHeaderSignature(headers: readonly string[]): string {
  return headers.map(normalizeHeader).join('|');
}

export function mappingProfileMatchScore(
  profile: Pick<SourceImportMappingProfile, 'bron_naam' | 'kolommen'>,
  headers: readonly string[],
  packageSourceName?: string | null,
): number {
  const applied = applySourceImportMappingProfile(profile, headers);
  const total = Object.keys(profile.kolommen).length;
  if (total === 0) return 0;
  const headerScore = applied.matchedFields.length / total;
  const sourceMatch = profile.bron_naam && packageSourceName
    && normalizeHeader(profile.bron_naam) === normalizeHeader(packageSourceName)
    ? 0.15
    : 0;
  return Math.min(1, headerScore * 0.85 + sourceMatch);
}

export function bestSourceImportMappingProfile(
  profiles: readonly SourceImportMappingProfile[],
  headers: readonly string[],
  packageSourceName?: string | null,
): SourceImportMappingProfile | null {
  const ranked = profiles
    .filter((profile) => profile.actief)
    .map((profile) => ({ profile, score: mappingProfileMatchScore(profile, headers, packageSourceName) }))
    .sort((left, right) => right.score - left.score || left.profile.naam.localeCompare(right.profile.naam, 'nl-NL'));
  return ranked[0]?.score === 1 ? ranked[0].profile : null;
}

export function mappingProfileHasRequiredFields(
  profile: Pick<SourceImportMappingProfile, 'kolommen'>,
  requiredFields: readonly SourceImportField[],
): boolean {
  return requiredFields.every((field) => Boolean(profile.kolommen[field]?.trim()));
}
