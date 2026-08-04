export const OBJECT_IDENTITY_SOURCE_TYPES = [
  'vastgoedkans',
  'object',
  'off_market_signaal',
  'deal',
  'acquisitie_target',
] as const;

export type ObjectIdentitySourceType = (typeof OBJECT_IDENTITY_SOURCE_TYPES)[number];

export interface ObjectIdentitySourceRecord {
  sourceType: ObjectIdentitySourceType;
  sourceId: string;
  bagVerblijfsobjectId: string | null;
  bagPandId: string | null;
  adres: string | null;
  postcode: string | null;
  plaats: string | null;
  bestaandObjectId: string | null;
}

export type SourceInventoryIssueCode =
  | 'ontbrekende_bron_id'
  | 'ontbrekende_identiteit'
  | 'ongeldig_bag_verblijfsobject_id'
  | 'ongeldig_bag_pand_id'
  | 'onvolledig_adres'
  | 'bestaand_object_id_zonder_identiteit';

export interface SourceInventoryIssue {
  sourceType: ObjectIdentitySourceType;
  sourceId: string | null;
  code: SourceInventoryIssueCode;
  toelichting: string;
}

export interface SourceInventorySummary {
  sourceType: ObjectIdentitySourceType;
  totaal: number;
  metBagVerblijfsobjectId: number;
  metBagPandId: number;
  metVolledigAdres: number;
  metBestaandObjectId: number;
  koppelbaar: number;
  handmatigBeoordelen: number;
}

export interface SourceInventoryReport {
  status: 'inventory_ready' | 'inventory_blocked';
  readOnly: true;
  automaticWrites: 0;
  summaries: SourceInventorySummary[];
  issues: SourceInventoryIssue[];
}

const BAG_ID_PATTERN = /^\d{16}$/;

function schoon(value: string | null | undefined): string | null {
  const result = value?.trim() ?? '';
  return result.length > 0 ? result : null;
}

export function normaliseerObjectIdentitySourceRecord(
  record: ObjectIdentitySourceRecord,
): ObjectIdentitySourceRecord {
  return {
    ...record,
    sourceId: schoon(record.sourceId) ?? '',
    bagVerblijfsobjectId: schoon(record.bagVerblijfsobjectId),
    bagPandId: schoon(record.bagPandId),
    adres: schoon(record.adres),
    postcode: schoon(record.postcode)?.replace(/\s+/g, '').toUpperCase() ?? null,
    plaats: schoon(record.plaats),
    bestaandObjectId: schoon(record.bestaandObjectId),
  };
}

export function inventariseerObjectIdentityBronnen(
  records: ObjectIdentitySourceRecord[],
): SourceInventoryReport {
  const normalized = records.map(normaliseerObjectIdentitySourceRecord);
  const issues: SourceInventoryIssue[] = [];

  for (const record of normalized) {
    const sourceId = record.sourceId || null;
    const volledigAdres = Boolean(record.adres && record.postcode && record.plaats);
    const geldigeVbo = Boolean(record.bagVerblijfsobjectId && BAG_ID_PATTERN.test(record.bagVerblijfsobjectId));
    const geldigPand = Boolean(record.bagPandId && BAG_ID_PATTERN.test(record.bagPandId));

    if (!sourceId) {
      issues.push({
        sourceType: record.sourceType,
        sourceId: null,
        code: 'ontbrekende_bron_id',
        toelichting: 'Bronrecord heeft geen stabiele primaire sleutel.',
      });
    }
    if (record.bagVerblijfsobjectId && !geldigeVbo) {
      issues.push({
        sourceType: record.sourceType,
        sourceId,
        code: 'ongeldig_bag_verblijfsobject_id',
        toelichting: 'BAG-verblijfsobject-ID moet exact 16 cijfers bevatten.',
      });
    }
    if (record.bagPandId && !geldigPand) {
      issues.push({
        sourceType: record.sourceType,
        sourceId,
        code: 'ongeldig_bag_pand_id',
        toelichting: 'BAG-pand-ID moet exact 16 cijfers bevatten.',
      });
    }
    if ((record.adres || record.postcode || record.plaats) && !volledigAdres) {
      issues.push({
        sourceType: record.sourceType,
        sourceId,
        code: 'onvolledig_adres',
        toelichting: 'Adresmatch vereist adres, postcode en plaats.',
      });
    }
    if (!geldigeVbo && !geldigPand && !volledigAdres) {
      issues.push({
        sourceType: record.sourceType,
        sourceId,
        code: 'ontbrekende_identiteit',
        toelichting: 'Geen geldige BAG-ID of volledig adres beschikbaar.',
      });
    }
    if (record.bestaandObjectId && !geldigeVbo && !geldigPand && !volledigAdres) {
      issues.push({
        sourceType: record.sourceType,
        sourceId,
        code: 'bestaand_object_id_zonder_identiteit',
        toelichting: 'Bestaand object_id kan niet onafhankelijk worden gevalideerd.',
      });
    }
  }

  const summaries = OBJECT_IDENTITY_SOURCE_TYPES.map(sourceType => {
    const sourceRecords = normalized.filter(record => record.sourceType === sourceType);
    const issueIds = new Set(
      issues
        .filter(issue => issue.sourceType === sourceType && issue.sourceId)
        .map(issue => issue.sourceId as string),
    );
    return {
      sourceType,
      totaal: sourceRecords.length,
      metBagVerblijfsobjectId: sourceRecords.filter(record =>
        Boolean(record.bagVerblijfsobjectId && BAG_ID_PATTERN.test(record.bagVerblijfsobjectId)),
      ).length,
      metBagPandId: sourceRecords.filter(record =>
        Boolean(record.bagPandId && BAG_ID_PATTERN.test(record.bagPandId)),
      ).length,
      metVolledigAdres: sourceRecords.filter(record =>
        Boolean(record.adres && record.postcode && record.plaats),
      ).length,
      metBestaandObjectId: sourceRecords.filter(record => Boolean(record.bestaandObjectId)).length,
      koppelbaar: sourceRecords.filter(record => record.sourceId && !issueIds.has(record.sourceId)).length,
      handmatigBeoordelen: sourceRecords.filter(record => !record.sourceId || issueIds.has(record.sourceId)).length,
    } satisfies SourceInventorySummary;
  });

  return {
    status: issues.length === 0 ? 'inventory_ready' : 'inventory_blocked',
    readOnly: true,
    automaticWrites: 0,
    summaries,
    issues,
  };
}
