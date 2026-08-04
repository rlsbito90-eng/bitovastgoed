import type {
  ObjectIdentitySourceRecord,
  ObjectIdentitySourceType,
} from './sourceInventory';

export type UnknownRow = Record<string, unknown>;

export interface ObjectIdentitySourceAdapter {
  sourceType: ObjectIdentitySourceType;
  tableName: string;
  selectedColumns: readonly string[];
  readOnly: true;
  adapt(row: UnknownRow): ObjectIdentitySourceRecord;
}

function text(row: UnknownRow, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function record(
  sourceType: ObjectIdentitySourceType,
  row: UnknownRow,
  mapping: {
    sourceId: string[];
    bagVerblijfsobjectId?: string[];
    bagPandId?: string[];
    adres?: string[];
    postcode?: string[];
    plaats?: string[];
    bestaandObjectId?: string[];
  },
): ObjectIdentitySourceRecord {
  return {
    sourceType,
    sourceId: text(row, ...mapping.sourceId) ?? '',
    bagVerblijfsobjectId: text(row, ...(mapping.bagVerblijfsobjectId ?? [])),
    bagPandId: text(row, ...(mapping.bagPandId ?? [])),
    adres: text(row, ...(mapping.adres ?? [])),
    postcode: text(row, ...(mapping.postcode ?? [])),
    plaats: text(row, ...(mapping.plaats ?? [])),
    bestaandObjectId: text(row, ...(mapping.bestaandObjectId ?? [])),
  };
}

export const OBJECT_IDENTITY_SOURCE_ADAPTERS = {
  vastgoedkans: {
    sourceType: 'vastgoedkans',
    tableName: 'vastgoedkansen',
    selectedColumns: [
      'id',
      'bag_verblijfsobject_id',
      'bag_pand_id',
      'adres',
      'postcode',
      'plaats',
      'object_id',
    ],
    readOnly: true,
    adapt: row => record('vastgoedkans', row, {
      sourceId: ['id'],
      bagVerblijfsobjectId: ['bag_verblijfsobject_id', 'bag_vbo_id'],
      bagPandId: ['bag_pand_id'],
      adres: ['adres'],
      postcode: ['postcode'],
      plaats: ['plaats'],
      bestaandObjectId: ['object_id', 'crm_objectregistratie_id'],
    }),
  },
  object: {
    sourceType: 'object',
    tableName: 'objecten',
    selectedColumns: [
      'id',
      'bag_verblijfsobject_id',
      'bag_pand_id',
      'adres',
      'postcode',
      'plaats',
      'crm_objectregistratie_id',
    ],
    readOnly: true,
    adapt: row => record('object', row, {
      sourceId: ['id'],
      bagVerblijfsobjectId: ['bag_verblijfsobject_id', 'bag_vbo_id'],
      bagPandId: ['bag_pand_id'],
      adres: ['adres'],
      postcode: ['postcode'],
      plaats: ['plaats'],
      bestaandObjectId: ['crm_objectregistratie_id', 'object_id'],
    }),
  },
  off_market_signaal: {
    sourceType: 'off_market_signaal',
    tableName: 'off_market_signalen',
    selectedColumns: [
      'id',
      'bag_verblijfsobject_id',
      'bag_pand_id',
      'adres',
      'postcode',
      'plaats',
      'object_id',
    ],
    readOnly: true,
    adapt: row => record('off_market_signaal', row, {
      sourceId: ['id'],
      bagVerblijfsobjectId: ['bag_verblijfsobject_id', 'bag_vbo_id'],
      bagPandId: ['bag_pand_id'],
      adres: ['adres'],
      postcode: ['postcode'],
      plaats: ['plaats'],
      bestaandObjectId: ['object_id', 'crm_objectregistratie_id'],
    }),
  },
  deal: {
    sourceType: 'deal',
    tableName: 'deals',
    selectedColumns: [
      'id',
      'bag_verblijfsobject_id',
      'bag_pand_id',
      'adres',
      'postcode',
      'plaats',
      'object_id',
    ],
    readOnly: true,
    adapt: row => record('deal', row, {
      sourceId: ['id'],
      bagVerblijfsobjectId: ['bag_verblijfsobject_id', 'bag_vbo_id'],
      bagPandId: ['bag_pand_id'],
      adres: ['adres'],
      postcode: ['postcode'],
      plaats: ['plaats'],
      bestaandObjectId: ['object_id', 'crm_objectregistratie_id'],
    }),
  },
  acquisitie_target: {
    sourceType: 'acquisitie_target',
    tableName: 'acquisitie_targets',
    selectedColumns: [
      'id',
      'bag_verblijfsobject_id',
      'bag_pand_id',
      'adres',
      'postcode',
      'plaats',
      'object_id',
    ],
    readOnly: true,
    adapt: row => record('acquisitie_target', row, {
      sourceId: ['id'],
      bagVerblijfsobjectId: ['bag_verblijfsobject_id', 'bag_vbo_id'],
      bagPandId: ['bag_pand_id'],
      adres: ['adres'],
      postcode: ['postcode'],
      plaats: ['plaats'],
      bestaandObjectId: ['object_id', 'crm_objectregistratie_id'],
    }),
  },
} as const satisfies Record<ObjectIdentitySourceType, ObjectIdentitySourceAdapter>;

export function maakReadOnlySelectContract(adapter: ObjectIdentitySourceAdapter) {
  return {
    table: adapter.tableName,
    columns: [...adapter.selectedColumns],
    operation: 'select' as const,
    readOnly: true as const,
    writes: 0 as const,
  };
}

export function adapteerBronRijen(
  adapter: ObjectIdentitySourceAdapter,
  rows: UnknownRow[],
): ObjectIdentitySourceRecord[] {
  return rows.map(row => adapter.adapt(row));
}
