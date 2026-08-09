import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const draftPath = path.resolve(
  process.cwd(),
  'supabase/migration-drafts/20260809_crm_mig_2c2_classificatie_schema.sql',
);
const draft = readFileSync(draftPath, 'utf8');

describe('CRM-MIG-2C-2 classificatie DDL-draft', () => {
  it('blijft bewust buiten de uitvoerbare migrations-map', () => {
    expect(draftPath).toContain('/supabase/migration-drafts/');
    expect(draftPath).not.toContain('/supabase/migrations/');
  });

  it('faalt gesloten vóór de eerste DDL', () => {
    const sentinel = draft.indexOf("raise exception 'CRM-MIG-2C-2 is een niet-goedgekeurde DDL-draft");
    const eersteDdl = draft.toLowerCase().indexOf('create table');
    expect(sentinel).toBeGreaterThan(-1);
    expect(eersteDdl).toBeGreaterThan(sentinel);
    expect(draft.toLowerCase()).toContain('begin;');
  });

  it('bevat geen classificatie-seeddata', () => {
    const zonderComments = draft.replace(/--.*$/gm, '');
    expect(zonderComments).not.toMatch(/\binsert\s+into\b/i);
  });

  it('is beperkt tot de vier classificatietabellen en negen koppelingkolommen', () => {
    for (const tabel of ['property_types', 'property_subtypes', 'deal_types', 'property_type_aliases']) {
      expect(draft).toContain(`public.${tabel}`);
    }
    for (const kolom of [
      'property_type_id', 'property_subtype_ids', 'deal_type_ids',
      'property_type_ids', 'property_subtype_ids_v2',
    ]) {
      expect(draft).toContain(kolom);
    }
  });

  it('noemt uitsluitend het zelfstandige CRM-doelproject als uitvoeringsdoel', () => {
    expect(draft).toContain('vyjocdlwfxrblusfngfq');
    expect(draft).not.toContain('ljudxyrqoifhfikueric');
    expect(draft).not.toContain('wzkhmjuasyuvzhhycnym');
    expect(draft).not.toContain('xfygspvpeugxowxbcvnm');
  });
});
