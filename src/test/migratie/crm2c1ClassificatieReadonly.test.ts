import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { CRM_SCHEMA_BUNDELS } from '@/lib/migratie/crmSchemaManifest';

const probePath = path.resolve(process.cwd(), 'scripts/migratie/crm-2c1-classificatie-readonly.sql');
const probe = readFileSync(probePath, 'utf8');

describe('CRM-MIG-2C-1 classificatiedelta', () => {
  it('bevat alleen read-only metadataqueries', () => {
    const zonderComments = probe.replace(/--.*$/gm, '');
    expect(zonderComments).not.toMatch(/\b(insert|update|delete|alter|create|drop|truncate|grant|revoke|call)\b/i);
    expect(zonderComments).toMatch(/\bselect\b/i);
  });

  it('controleert alle vier classificatietabellen', () => {
    for (const tabel of ['property_types', 'property_subtypes', 'deal_types', 'property_type_aliases']) {
      expect(probe).toContain(`('${tabel}')`);
    }
  });

  it('controleert alle negen koppelingkolommen', () => {
    for (const kolom of [
      "('objecten','property_type_id')",
      "('objecten','property_subtype_ids')",
      "('objecten','deal_type_ids')",
      "('zoekprofielen','property_type_ids')",
      "('zoekprofielen','property_subtype_ids_v2')",
      "('zoekprofielen','deal_type_ids')",
      "('relaties','property_type_ids')",
      "('relaties','property_subtype_ids')",
      "('relaties','deal_type_ids')",
    ]) {
      expect(probe).toContain(kolom);
    }
  });

  it('legt beide bronmigraties voor 2B-1 vast', () => {
    const bundel = CRM_SCHEMA_BUNDELS.find((item) => item.id === '2B-1');
    expect(bundel?.bronMigraties).toEqual([
      '20260427140858_fd240c17-724e-4d95-b671-6e1ce3c6656c.sql',
      '20260427141800_9a9277fb-d354-4449-b307-117dc1f2ffa5.sql',
    ]);
  });
});
