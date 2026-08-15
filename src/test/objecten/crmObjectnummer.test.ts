import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  isCrmObjectnummer,
  normalizeCrmObjectnummerQuery,
  objectMatchesCrmSearch,
} from '@/lib/objecten/crmObjectnummer';

describe('CRM-objectnummer', () => {
  it('accepteert het vaste OBJ-formaat met minimaal zes cijfers', () => {
    expect(isCrmObjectnummer('OBJ-000001')).toBe(true);
    expect(isCrmObjectnummer('OBJ-1000000')).toBe(true);
    expect(isCrmObjectnummer('obj-000001')).toBe(false);
    expect(isCrmObjectnummer('OBJ-1')).toBe(false);
  });

  it('normaliseert zoekinvoer zonder het opgeslagen nummer te wijzigen', () => {
    expect(normalizeCrmObjectnummerQuery(' obj-000123 ')).toBe('OBJ-000123');
    expect(normalizeCrmObjectnummerQuery('OBJ - 000123')).toBe('OBJ-000123');
  });

  it('zoekt op objectnummer, titel en plaats', () => {
    const object = {
      crmObjectnummer: 'OBJ-000123',
      titel: 'Kantoorpand Stationsstraat',
      plaats: 'Breda',
    };

    expect(objectMatchesCrmSearch(object, 'obj-000123')).toBe(true);
    expect(objectMatchesCrmSearch(object, 'Stationsstraat')).toBe(true);
    expect(objectMatchesCrmSearch(object, 'breda')).toBe(true);
    expect(objectMatchesCrmSearch(object, 'Tilburg')).toBe(false);
  });

  it('legt de databasegaranties vast in de migratie', () => {
    const sql = readFileSync(
      resolve(process.cwd(), 'supabase/migration-archive/pre-baseline-snapshot/20260802021000_add_crm_objectnummer.sql'),
      'utf-8',
    );

    expect(sql).toContain('CREATE SEQUENCE IF NOT EXISTS public.crm_objectnummer_seq');
    expect(sql).toContain("'OBJ-' || lpad(nextval('public.crm_objectnummer_seq')::text, 6, '0')");
    expect(sql).toContain('CREATE UNIQUE INDEX IF NOT EXISTS objecten_crm_objectnummer_key');
    expect(sql).toContain('ALTER COLUMN crm_objectnummer SET NOT NULL');
    expect(sql).toContain('objecten_crm_objectnummer_immutable');
    expect(sql).toContain('ORDER BY created_at, id');
  });
});
